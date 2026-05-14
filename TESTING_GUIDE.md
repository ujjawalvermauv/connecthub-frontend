# ConnectHub Real-Time Messaging - Testing & Validation Guide

## Summary of Changes

### Phase 1: Fixed ✅

1. **DirectMessagesComponent** - Added MessageSent listener and comprehensive logging
2. **DashboardComponent** - Enhanced logging and error handling
3. **ChatHubService** - Added helper methods for all SignalR operations
4. **Real-time Documentation** - Created comprehensive fix guide

### Phase 2: Ready for Testing

All frontend event handlers are now properly registered and logging is in place.

---

## Testing Instructions

### Prerequisites

- [ ] Backend services running on correct ports
  - ChatHub: http://localhost:5000 or ws://localhost:5003/hubs/chat
  - Message Service: http://localhost:5002
  - Notification Service: http://localhost:5076
- [ ] Database migrations applied
- [ ] Frontend built and running on localhost:4200

### Test 1: Connection Establishment

**Objective:** Verify SignalR connection is established

**Steps:**

1. Open browser DevTools → Console
2. Navigate to Direct Messages page in ConnectHub
3. Wait for page to load

**Expected Results:**

```
✅ "[ChatHubService] Creating connection to [URL] with token present: true"
✅ "[ChatHubService] accessTokenFactory returning token present: true, waited: 0"
✅ "[ChatHubService] Successfully parsed userId: [ID]"
✅ "[ChatHubService] Connected successfully"
✅ "Dashboard: Setting up SignalR. Current state: Connected"
✅ "Dashboard: ReceiveMessage handler registered"
✅ "DirectMessages: SignalR event handlers registered successfully"
✅ "WebSocket connected to ws://localhost:5003/hubs/chat"
```

### Test 2: Send Direct Message - Sender Perspective

**Objective:** Verify message sending from sender's perspective

**Setup:**

1. In Browser 1: Login as User A, navigate to Direct Messages
2. Select User B from recent chats (or search and start new chat)
3. Keep DevTools Console open

**Steps:**

1. Type a message: "Hello from User A"
2. Click Send button

**Expected Results - Console Logs:**

```
✅ "Invoking SignalR: SendDirectMessage"
✅ "SignalR: Message sent successfully"
✅ "Invoking SignalR: SendDirectMessage"
✅ "SendDirectMessage completed successfully"
✅ "DirectMessages: MessageSent acknowledgement received"
✅ "DirectMessages: Updated optimistic message with confirmation"
```

**Expected Results - UI:**

- [ ] Message appears immediately in chat (optimistic UI)
- [ ] Message has correct content
- [ ] Message shows timestamp
- [ ] Message is on the right side (from user)
- [ ] Recent chats list updates with new message preview

### Test 3: Send Direct Message - Receiver Perspective

**Objective:** Verify message reception on receiver's side

**Setup:**

1. In Browser 2: Login as User B, navigate to Direct Messages
2. Select User A (should see recent chat or no chat yet)
3. Keep DevTools Console open

**Expected Results - Console Logs:**

```
✅ "DirectMessages: ReceiveMessage event received"
  {
    messageId: [ID],
    senderId: [UserA_ID],
    receiverId: [UserB_ID],
    currentUserId: [UserB_ID],
    selectedUserId: [UserA_ID],
    content: "Hello from User A"
  }
✅ "DirectMessages: Appending incoming message to messages array"
✅ "loadRecentChats: raw data received"
```

**Expected Results - UI:**

- [ ] Message appears in chat window
- [ ] Message shows "Hello from User A"
- [ ] Message is on the left side (from other user)
- [ ] Message has correct timestamp
- [ ] Chat automatically scrolls to show new message
- [ ] Recent chats list updates with the new conversation

### Test 4: Multiple Messages Exchange

**Objective:** Verify continuous real-time messaging

**Setup:**

1. Both browsers should have Direct Messages open with each other selected
2. Keep both consoles visible

**Steps:**

1. User A sends: "First message"
2. User B sends: "Reply from B"
3. User A sends: "Second message from A"
4. User B sends: "Another reply"

**Expected Results:**

- [ ] All messages appear instantly on both sides
- [ ] No messages are duplicated
- [ ] Correct message ordering
- [ ] All messages have correct sender/receiver info
- [ ] No errors in console

### Test 5: Message with Special Characters

**Objective:** Verify message encoding and special characters

**Setup:**
Same as Test 3

**Steps:**

1. User A sends: "Test with emojis: 😀 🎉 ✅"
2. User A sends: "Test with symbols: @#$%^&\*()"
3. User A sends: "Test with newlines:\nLine 2\nLine 3"

**Expected Results:**

- [ ] All special characters render correctly
- [ ] Emojis display properly
- [ ] Symbols are not escaped
- [ ] Newlines create line breaks

### Test 6: Recent Chats Update

**Objective:** Verify recent chats list stays synchronized

**Setup:**

1. User A opens Dashboard
2. Keep console open

**Steps:**

1. User B sends a message to User A
2. Check recent chats list on Dashboard
3. Send another message
4. Check recent chats list updates again

**Expected Results:**

- [ ] Recent chats list shows conversation with User B
- [ ] Latest message preview shows most recent message
- [ ] Unread count appears if message is unread
- [ ] Clicking on recent chat opens conversation
- [ ] Console shows "loadRecentChats: raw data received"

### Test 7: Long Message

**Objective:** Verify handling of longer messages

**Setup:**
Same previous tests

**Steps:**

1. User A sends message longer than 200 characters
2. User A sends message with multiple paragraphs (using Shift+Enter)
3. User A sends message with code block content

**Expected Results:**

- [ ] Full message is sent and received
- [ ] Message is not truncated
- [ ] Formatting is preserved
- [ ] Message renders correctly in UI

### Test 8: Rapid Message Sending

**Objective:** Verify handling of rapid succession messages

**Setup:**
Same previous tests

**Steps:**

1. User A rapidly sends 5 messages in quick succession (no delays)
2. Watch both sides

**Expected Results:**

- [ ] All 5 messages arrive on both sides
- [ ] No messages are lost or duplicated
- [ ] Messages appear in correct order
- [ ] No console errors

### Test 9: Connection Recovery

**Objective:** Verify handling of connection issues

**Setup:**

1. Open DevTools → Network tab
2. Users A and B in active conversation

**Steps:**

1. Check "Disable cache" in Network tab
2. Throttle network to "Slow 3G"
3. User A sends message
4. User B replies
5. Restore network to normal

**Expected Results:**

- [ ] Messages eventually arrive despite slow network
- [ ] Status remains "Connected" in console
- [ ] UI shows loading state (optional)
- [ ] No error messages in console

### Test 10: Different User Combinations

**Objective:** Verify messaging works with different user combinations

**Setup:**
Create test users: User1, User2, User3, User4

**Steps:**

1. User1 sends to User2 ✅
2. User2 sends to User1 ✅
3. User1 sends to User3 ✅
4. User3 sends to User1 ✅
5. User2 sends to User3 ✅
6. User3 sends to User2 ✅

**Expected Results:**

- [ ] All combinations work without interference
- [ ] Each conversation shows correct messages
- [ ] No cross-conversation message mixing

---

## Debugging Checklist

### If Messages Don't Appear on Receiver

1. **Check Backend Logs**

   ```
   Look for:
   ✓ "Message {MessageId} persisted from user {SenderId}"
   ✓ "Message received by online user {ReceiverId}"
   ✗ Check if "ℹ Message queued for offline user" instead - means receiver is offline
   ```

2. **Check Frontend Console**

   ```
   ✓ "DirectMessages: ReceiveMessage event received" should appear
   ✗ If not appearing - handler not registered
   ✓ Message should be in the received event
   ✗ If messageId/senderId missing - check backend payload
   ✓ "Appending incoming message to messages array" should follow
   ✗ If not - check isForActiveChat logic
   ```

3. **Check Connection State**

   ```
   ✓ Connection state should be "Connected"
   ✗ If "Disconnected" - reconnect by refreshing page
   ```

4. **Check Current User ID**
   ```
   ✓ currentUserId should match logged-in user
   ✗ If null/undefined - auth not loaded yet
   ```

### If MessageSent Event Not Appearing

1. **Check Backend ChatHub.cs Line 321**
   - Verify `await Clients.Caller.SendAsync("MessageSent", messagePayload);`
   - Ensure parameter name is exactly "MessageSent"

2. **Check Frontend Handler**
   - Verify `this.chatHubService.on<any>('MessageSent', this.messageSentHandler);`
   - Handler should be registered in ngOnInit

3. **Check Console for Error**
   - "Warning: No client method with the name 'messagesent'" = naming mismatch
   - Solution: Verify exact casing on both backend and frontend

### If Optimistic UI Not Updating

1. **Check Message Append Logic**
   - Should show in console: "Appending incoming message to messages array"
   - Message should be visible immediately

2. **Check Array Immutability**
   - Code uses: `this.messages = [...this.messages, newMessage]`
   - This triggers Angular change detection

### If Recent Chats Not Updating

1. **Check messageService.handleIncomingMessage**
   - Should be called for all incoming messages
   - Should update recentChats$ subject

2. **Check Dashboard Subscription**
   - Dashboard should be subscribed to messageService.recentChats$
   - Should reload recent chats when new messages arrive

---

## Performance Metrics

### Expected Performance

| Metric                          | Expected Value         | Actual Value |
| ------------------------------- | ---------------------- | ------------ |
| Message Send to Receive Latency | < 100ms                |              |
| Message Delivery Reliability    | 100% for online users  |              |
| Complete Recent Chats Refresh   | < 500ms                |              |
| First Message Appearance        | Immediate (optimistic) |              |
| Confirmed Message ID Update     | < 100ms                |              |

---

## Browser Compatibility

### Tested Browsers

- [ ] Chrome 120+
- [ ] Firefox 121+
- [ ] Safari 17+
- [ ] Edge 120+

### Known Issues

- None documented yet

---

## Common Issues & Solutions

### Issue: "WebSocket connection closed (code: 1000)"

**Symptom:** Connection closes immediately after connecting
**Cause:** JWT token expired or invalid
**Solution:** Clear localStorage and refresh page to re-authenticate

### Issue: "Failed to send message - Database error"

**Symptom:** Message sends but backend returns error
**Cause:** Message Service not running or database error
**Solution:** Check backend Message Service logs (port 5002)

### Issue: Messages appearing on sender but not receiver

**Symptom:** Sender sees optimistic message but receiver gets nothing
**Cause:** IsUserOnline check failing
**Solution:** Verify receiver has active SignalR connection

---

## Sign-Off

- [ ] All 10 test cases passed
- [ ] No console errors or warnings
- [ ] No network errors
- [ ] Messages deliver instantly
- [ ] Recent chats update in real-time
- [ ] Ready for production

---

**Tested By:** ******\_\_\_******  
**Date:** ******\_\_\_******  
**Status:** ✅ READY / ❌ BLOCKED
