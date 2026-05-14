# Real-Time Messaging Fix - Debugging Guide

## Problem Identified

**Symptoms:**

- Messages only appear after page refresh
- New messages don't arrive in real-time
- Refresh triggers HTTP fetch which loads messages

**Root Cause:**
The WebSocket connection was using **polling** to acquire the JWT token instead of waiting for the `token$` observable. This caused:

1. **Inconsistent connection timing**: Token polling could timeout or race with auth state changes
2. **Connection dropouts**: If token wasn't available immediately, connection attempt would proceed with empty token
3. **Real-time events not delivered**: Even if hub connection established, messages weren't being broadcast to clients

## Changes Made

### 1. Chat Hub Service (`chat-hub.service.ts`)

**Before:**

```typescript
accessTokenFactory: async () => {
  let t = this.authService.getToken();
  const maxWait = 3000;
  const interval = 100;
  let waited = 0;
  while (!t && waited < maxWait) {
    // ❌ POLLING
    await new Promise((r) => setTimeout(r, interval));
    waited += interval;
    t = this.authService.getToken();
  }
  return t || "";
};
```

**After:**

```typescript
private async createConnection(): Promise<HubConnection> {
  // ✅ Wait for token via observable (no polling)
  const token = await firstValueFrom(
    this.authService.token$.pipe(
      filter(t => !!t),
      first(),
      timeout(5000)
    )
  ).catch(() => '');

  // Connection setup with token factory fallback
  const withUrlOptions = {
    accessTokenFactory: async () => {
      const currentToken = this.authService.getToken();
      return currentToken || '';
    },
    transport: HttpTransportType.WebSockets | HttpTransportType.LongPolling
  };

  return new HubConnectionBuilder()...build();
}
```

### 2. Notification Hub Service (`notification-hub.service.ts`)

Applied the same fix - upgraded `createConnection()` to be async and use `token$` observable.

### 3. Connection Startup

Both services now properly `await this.createConnection()` instead of calling it synchronously.

## How It Works Now

```
1. User logs in → token$ BehaviorSubject emits token
2. Component triggers chatHubService.start()
3. createConnection() awaits token$ (not polling)
4. Token received → Hub connects via WebSocket/LongPolling
5. OnConnectedAsync() fires on backend → tracks user connection
6. User sends message:
   a. Frontend calls hub.invoke('SendDirectMessage', receiverId, content)
   b. Backend receives → saves to DB → broadcasts to receiver
   c. Receiver's ReceiveMessage handler fires immediately (real-time)
7. Frontend receiveMessageHandler appends message to UI (no refresh needed)
```

## Testing the Fix

### Browser Console Checks

**Step 1: Look for connection logs**

```
Open DevTools → Console tab
Look for these SUCCESS indicators:

✅ '[ChatHubService] Token acquired, establishing connection'
✅ '[ChatHubService] Connected successfully, hub is ready for real-time messaging'
✅ '[ChatHubService] ReceiveMessage event received'
```

**Step 2: Look for failure indicators**

```
❌ '[ChatHubService] Error starting connection'
❌ 'Failed to complete negotiation with the server'
❌ 'Reconnect blocked for XXXs'
```

### Functional Testing

**Test 1: Real-Time Message Delivery**

1. Open chat with User B in Browser A
2. Send message from Browser B to User A
3. **Expected**: Message appears immediately in Browser A (without refresh)
4. **Before fix**: Would need refresh to see message

**Test 2: Connection State**

1. Open DevTools → Network tab
2. Filter for `/hubs/chat`
3. Send a message
4. **Expected**: WebSocket connection should show as `101 Switching Protocols`
5. **Before fix**: Might see negotiation endpoint but websocket upgrade fails

**Test 3: Multi-Device Sync**

1. Open chat in Browser A and Browser B (same user logged in)
2. Send message from Browser A
3. **Expected**: Appears in Browser B immediately
4. **Tests**: Real-time broadcasting is working

### Network Tab Inspection

**Look for this flow:**

```
1. POST /hubs/chat/negotiate → 200 OK (returns connection details)
2. WebSocket /hubs/chat → 101 Switching Protocols (real-time connection)
3. Binary frame messages (real-time events)
```

**NOT this:**

```
❌ POST /hubs/chat/negotiate → 404 (negotiation fails)
❌ Multiple negotiation attempts (race condition)
```

## Logs to Monitor

Enable detailed logging in `environment.ts`:

```typescript
export const environment = {
  production: false,
  chatHubUrl: "https://apigateway-isze.onrender.com/hubs/chat",
  signalrLogLevel: "Debug", // Changes LogLevel in chat-hub.service
};
```

### Key Log Messages (in order)

**Healthy connection:**

```
[ChatHubService] Creating connection to https://...
[ChatHubService] Token acquired, establishing connection. Token present: true
[ChatHubService] Creating new connection (waiting for token...)
[ChatHubService] Starting connection from state: 1
[ChatHubService] Connected successfully, hub is ready for real-time messaging
[ChatHubService] ReceiveMessage event received { messageId: 123, senderId: 5, content: 'Hello' }
```

**Problem signs:**

```
[ChatHubService] start skipped: authenticated but token not available after wait
[ChatHubService] Error starting connection: (specific error)
[ChatHubService] Connection already in progress, skipping start() (race condition)
```

## Troubleshooting

### Messages still don't appear in real-time

1. **Check console for connection errors**
   - If "Failed to complete negotiation with the server (404)", the gateway route is misconfigured
   - Solution: Ensure gateway appsettings.json has explicit `/hubs/chat` and `/hubs/chat/{**catch-all}` routes

2. **Check WebSocket connection established**
   - DevTools Network tab → Filter `/hubs/chat` → Should see 101 Switching Protocols
   - If missing, WebSocket upgrade failed

3. **Check token is present**
   - Console: `localStorage.getItem('auth_token')` should return a JWT string
   - If empty, login flow has an issue

4. **Check backend is receiving connection**
   - Backend ChatHub logs should show: `User {UserId} connected successfully`
   - If not, JWT validation failing on server side

### Connection keeps reconnecting

1. Look for `[ChatHubService] Reconnecting...` logs
2. Check if `lastObservedUserId` guard is working (should log only on actual user change)
3. If reconnecting on every auth state change, the `lastObservedUserId` tracking needs review

## Deployment Note

When deploying to Render:

1. **Ensure gateway service** uses `ConnectHub.Gateway/ConnectHub.Gateway/` as root (not parent)
2. **Set environment variable** on gateway service:
   ```
   ReverseProxy__Clusters__signalr-cluster__Destinations__signalr-dest__Address=https://<your-chathub-service>.onrender.com/
   ```
3. **Verify appsettings.json** has explicit hub routes (not just generic `/hubs/{**catch-all}`)

## Metrics to Track

- Real-time message latency (should be <100ms typically)
- WebSocket connection uptime (should stay connected unless user logs out)
- Message delivery success rate (should be 99.9%+)
- Connection retry attempts (should stabilize after initial attempts)

---

## Files Modified

- `src/app/core/services/chat-hub.service.ts` - Fixed token handling to use async createConnection
- `src/app/core/services/notification-hub.service.ts` - Same fixes applied
- Build: ✅ Successful (no TypeScript errors)

## Next Steps

1. Deploy frontend build to Render
2. Open browser DevTools Console
3. Send messages and verify real-time delivery
4. Check logs match "Healthy connection" pattern above
