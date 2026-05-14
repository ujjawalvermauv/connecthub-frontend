import { Injectable } from '@angular/core';
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel
} from '@microsoft/signalr';
import { BehaviorSubject, Subject } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ChatHubService {
  private connection: HubConnection | null = null;
  private isConnecting = false;  // Connection state guard to prevent concurrent start() calls
  private reconnectBlockedUntil = 0;
  public connectionState$ = new BehaviorSubject<HubConnectionState>(HubConnectionState.Disconnected);
  
  // Real-time message subjects - Using Subject instead of BehaviorSubject 
  // to ensure events are only received once and not re-emitted on subscription.
  private messageReceivedSubject = new Subject<any>();
  public messageReceived$ = this.messageReceivedSubject.asObservable();
  
  private messageSentSubject = new Subject<any>();
  public messageSent$ = this.messageSentSubject.asObservable();

  private roomMessageReceivedSubject = new Subject<any>();
  public roomMessageReceived$ = this.roomMessageReceivedSubject.asObservable();

  private eventHandlers = new Map<string, Set<(data: any) => void>>();

  constructor(private authService: AuthService) {
    // Monitor auth state changes and reconnect if needed
    this.authService.isAuthenticated$.subscribe(isAuth => {
      if (isAuth) {
        this.ensureConnected();
      } else {
        this.stop();
      }
    });

    // Monitor token changes to recreate connection
    this.authService.currentUser$.subscribe(() => {
      // Force reconnection when user changes (e.g., login in another window)
      if (this.authService.isAuthenticated) {
        this.reconnect();
      }
    });
  }

  private createConnection(): HubConnection {
    const token = this.authService.getToken();
    console.log('[ChatHubService] Creating connection to', environment.chatHubUrl, 'with token present:', !!token);

    // SignalR negotiate requests must use http/https schemes (fetch doesn't accept ws/wss).
    // Convert ws:// -> http:// and wss:// -> https:// for the negotiation URL; the SignalR client
    // will automatically upgrade to WebSocket (wss) when appropriate for transport.
    const hubUrl = (environment.chatHubUrl || '').replace(/^wss:/i, 'https:').replace(/^ws:/i, 'http:');

    return new HubConnectionBuilder()
      .withUrl(hubUrl, {
        // accessTokenFactory may return a Promise<string> - wait briefly for token to be available
        accessTokenFactory: async () => {
          let t = this.authService.getToken();
          const maxWait = 3000; // ms
          const interval = 100; // ms
          let waited = 0;
          while (!t && waited < maxWait) {
            await new Promise(r => setTimeout(r, interval));
            waited += interval;
            t = this.authService.getToken();
          }
          console.log('[ChatHubService] accessTokenFactory returning token present:', !!t, 'waited:', waited);
          return t || '';
        }
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(LogLevel.Information)
      .build();
  }

  private setupConnectionHandlers(conn: HubConnection): void {
    conn.onreconnecting(() => {
      console.log('[ChatHubService] Reconnecting...');
      this.connectionState$.next(HubConnectionState.Reconnecting);
    });
    conn.onreconnected(() => {
      console.log('[ChatHubService] Reconnected');
      this.connectionState$.next(HubConnectionState.Connected);
    });
    conn.onclose(() => {
      console.log('[ChatHubService] Connection closed');
      this.connectionState$.next(HubConnectionState.Disconnected);
    });
  }

  private attachPersistedHandlers(conn: HubConnection): void {
    this.eventHandlers.forEach((handlers, event) => {
      handlers.forEach(handler => conn.on(event, handler));
    });

    // Ensure core messaging events are always listened to
    conn.on('ReceiveMessage', (data) => {
      console.log('[ChatHubService] ReceiveMessage event received', data);
      this.messageReceivedSubject.next(data);
    });

    conn.on('MessageSent', (data) => {
      console.log('[ChatHubService] MessageSent event received', data);
      this.messageSentSubject.next(data);
    });

    conn.on('ReceiveRoomMessage', (data) => {
      console.log('[ChatHubService] ReceiveRoomMessage event received', data);
      this.roomMessageReceivedSubject.next(data);
    });

    // User presence events
    conn.on('UserOnline', (data) => {
      console.log('[ChatHubService] UserOnline event received', data);
    });

    conn.on('UserOffline', (data) => {
      console.log('[ChatHubService] UserOffline event received', data);
    });
  }

  async ensureConnected(): Promise<void> {
    if (this.connection && this.connection.state === HubConnectionState.Connected) {
      return;
    }
    await this.start();
  }

  private async reconnect(): Promise<void> {
    console.log('ChatHubService: Reconnecting due to auth change');
    if (Date.now() < this.reconnectBlockedUntil) {
      console.warn('[ChatHubService] reconnect skipped: hub negotiate previously failed with 404, waiting before retry');
      return;
    }
    await this.stop();
    await this.ensureConnected();
  }

  async start(): Promise<void> {
    // Guard: prevent concurrent connection attempts
    if (this.isConnecting) {
      console.log('[ChatHubService] Connection already in progress, skipping start()');
      return;
    }

    if (Date.now() < this.reconnectBlockedUntil) {
      const seconds = Math.ceil((this.reconnectBlockedUntil - Date.now()) / 1000);
      console.warn(`[ChatHubService] start skipped: retry cooldown active (${seconds}s remaining)`);
      return;
    }

    // Ensure authenticated and token available. Wait briefly for token if auth is true but token missing.
    if (!this.authService.isAuthenticated) {
      console.warn('[ChatHubService] start skipped: not authenticated');
      return;
    }

    // Wait up to 3s for token to appear (e.g., restoreSession races)
    let token = this.authService.getToken();
    const maxWait = 3000;
    const interval = 100;
    let waited = 0;
    while (!token && waited < maxWait) {
      await new Promise(r => setTimeout(r, interval));
      waited += interval;
      token = this.authService.getToken();
    }

    if (!token) {
      console.warn('[ChatHubService] start skipped: authenticated but token not available after wait');
      return;
    }

    this.isConnecting = true;
    try {
      // Create a new connection if we don't have one or it's dead
      if (!this.connection || this.connection.state === HubConnectionState.Disconnected) {
        console.log('[ChatHubService] Creating new connection');
        this.connection = this.createConnection();
        this.setupConnectionHandlers(this.connection);
        this.attachPersistedHandlers(this.connection);
      }

      if (this.connection.state !== HubConnectionState.Connected) {
        console.log('[ChatHubService] Starting connection from state:', this.connection.state);
        await this.connection.start();
        this.connectionState$.next(this.connection.state);
        console.log('[ChatHubService] Connected successfully');
      } else {
        console.log('[ChatHubService] Already connected, skipping start');
      }
    } catch (err) {
      console.error('[ChatHubService] Error starting connection:', err);

      const message = String((err as any)?.message || err || '').toLowerCase();
      if (message.includes('failed to complete negotiation') && message.includes('404')) {
        // Avoid hammering an unavailable/misrouted hub endpoint.
        this.reconnectBlockedUntil = Date.now() + 30000;
        console.error('[ChatHubService] Hub negotiate returned 404. Check hub URL/proxy route. Reconnect attempts paused for 30s.');
      }

      this.connectionState$.next(HubConnectionState.Disconnected);
    } finally {
      this.isConnecting = false;
    }
  }

  async stop(): Promise<void> {
    if (this.connection && this.connection.state !== HubConnectionState.Disconnected) {
      try {
        await this.connection.stop();
      } catch (err) {
        console.error('Error stopping ChatHub connection:', err);
      }
    }
    this.connectionState$.next(HubConnectionState.Disconnected);
  }

  on<T>(event: string, callback: (data: T) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }

    this.eventHandlers.get(event)?.add(callback as (data: any) => void);

    if (this.connection) {
      this.connection.on(event, callback);
    }
  }

  off(event: string, callback?: (data: any) => void): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      if (callback) {
        handlers.delete(callback);
      } else {
        handlers.clear();
      }

      if (handlers.size === 0) {
        this.eventHandlers.delete(event);
      }
    }

    if (this.connection) {
      if (callback) {
        this.connection.off(event, callback);
      } else {
        this.connection.off(event);
      }
    }
  }

  invoke<T>(method: string, ...args: any[]): Promise<T> {
    if (!this.connection) {
      return Promise.reject(new Error('SignalR connection not established'));
    }

    if (this.connection.state !== HubConnectionState.Connected) {
      return Promise.reject(new Error(`SignalR connection is ${this.connection.state}, expected Connected`));
    }

    // Mapping frontend-friendly names to backend names if necessary
    let backendMethod = method;
    if (method === 'SendMessage') backendMethod = 'SendDirectMessage';
    
    return this.connection.invoke<T>(backendMethod, ...args);
  }

  /**
   * Send a direct message to another user.
   * @param receiverId The ID of the recipient
   * @param content The message content
   */
  async sendDirectMessage(receiverId: number, content: string): Promise<void> {
    console.log('[ChatHubService] Invoking SendDirectMessage', { receiverId, contentLength: content.length });
    try {
      await this.invoke('SendDirectMessage', receiverId, content);
      console.log('[ChatHubService] SendDirectMessage completed successfully');
    } catch (error) {
      console.error('[ChatHubService] SendDirectMessage failed', error);
      throw error;
    }
  }

  /**
   * Send a typing indicator to another user.
   * @param recipientId The ID of the user to notify
   * @param isTyping Whether the user is typing or stopped
   */
  async sendTypingIndicator(recipientId: number, isTyping: boolean): Promise<void> {
    try {
      await this.invoke('SendTypingIndicator', recipientId, isTyping);
      console.log('[ChatHubService] Typing indicator sent', { recipientId, isTyping });
    } catch (error) {
      console.warn('[ChatHubService] Failed to send typing indicator', error);
      // Don't throw - typing indicator is not critical
    }
  }

  /**
   * Send a message to a room.
   * @param roomId The ID of the room
   * @param content The message content
   */
  async sendRoomMessage(roomId: number, content: string): Promise<void> {
    console.log('[ChatHubService] Invoking SendRoomMessage', { roomId, contentLength: content.length });
    try {
      await this.invoke('SendRoomMessage', roomId, content);
      console.log('[ChatHubService] SendRoomMessage completed successfully');
    } catch (error) {
      console.error('[ChatHubService] SendRoomMessage failed', error);
      throw error;
    }
  }

  /**
   * Join a room.
   * @param roomId The ID of the room
   */
  async joinRoom(roomId: number): Promise<void> {
    console.log('[ChatHubService] Invoking JoinRoom', { roomId });
    try {
      await this.invoke('JoinRoom', roomId);
      console.log('[ChatHubService] JoinRoom completed successfully');
    } catch (error) {
      console.error('[ChatHubService] JoinRoom failed', error);
      throw error;
    }
  }

  /**
   * Leave a room.
   * @param roomId The ID of the room
   */
  async leaveRoom(roomId: number): Promise<void> {
    console.log('[ChatHubService] Invoking LeaveRoom', { roomId });
    try {
      await this.invoke('LeaveRoom', roomId);
      console.log('[ChatHubService] LeaveRoom completed successfully');
    } catch (error) {
      console.error('[ChatHubService] LeaveRoom failed', error);
      throw error;
    }
  }

  getConnectionState(): string {
    return this.connection?.state.toString() || HubConnectionState.Disconnected.toString();
  }
}
