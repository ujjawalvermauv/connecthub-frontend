import { Injectable } from '@angular/core';
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel
} from '@microsoft/signalr';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class NotificationHubService {
  private connection: HubConnection | null = null;
  private isConnecting = false;  // Connection state guard to prevent concurrent start() calls
  private reconnectBlockedUntil = 0;
  public connectionState$ = new BehaviorSubject<HubConnectionState>(HubConnectionState.Disconnected);

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
    // Ensure negotiate uses http/https scheme since fetch doesn't accept ws/wss schemes.
    const hubUrl = (environment.notificationHubUrl || '').replace(/^wss:/i, 'https:').replace(/^ws:/i, 'http:');

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
          return t || '';
        }
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(LogLevel.Warning)
      .build();
  }

  private setupConnectionHandlers(conn: HubConnection): void {
    conn.onreconnecting(() => {
      this.connectionState$.next(HubConnectionState.Reconnecting);
    });
    conn.onreconnected(() => {
      this.connectionState$.next(HubConnectionState.Connected);
    });
    conn.onclose(() => {
      this.connectionState$.next(HubConnectionState.Disconnected);
    });

    // Register event handlers
    conn.on('UserOnline', (data) => {
      console.log('NotificationHubService: UserOnline event received', data);
    });

    conn.on('UserOffline', (data) => {
      console.log('NotificationHubService: UserOffline event received', data);
    });

    conn.on('NotificationCount', (unreadCount) => {
      console.log('NotificationHubService: NotificationCount event received', unreadCount);
    });
  }

  async ensureConnected(): Promise<void> {
    if (this.connection && this.connection.state === HubConnectionState.Connected) {
      return;
    }
    await this.start();
  }

  private async reconnect(): Promise<void> {
    console.log('NotificationHubService: Reconnecting due to auth change');
    if (Date.now() < this.reconnectBlockedUntil) {
      console.warn('NotificationHubService: Reconnect skipped due to retry cooldown');
      return;
    }
    await this.stop();
    await this.ensureConnected();
  }

  async start(): Promise<void> {
    // Guard: prevent concurrent connection attempts
    if (this.isConnecting) {
      console.log('NotificationHubService: Connection already in progress, skipping start()');
      return;
    }

    if (Date.now() < this.reconnectBlockedUntil) {
      const seconds = Math.ceil((this.reconnectBlockedUntil - Date.now()) / 1000);
      console.warn(`NotificationHubService: start skipped due to retry cooldown (${seconds}s remaining)`);
      return;
    }

    this.isConnecting = true;
    try {
      // Create a new connection if we don't have one or it's dead
      if (!this.connection || this.connection.state === HubConnectionState.Disconnected) {
        this.connection = this.createConnection();
        this.setupConnectionHandlers(this.connection);
      }

      if (this.connection.state !== HubConnectionState.Connected) {
        console.log('NotificationHubService: Starting connection from state:', this.connection.state);
        await this.connection.start();
        this.connectionState$.next(this.connection.state);
        console.log('NotificationHubService: Connected successfully');
      }
    } catch (err) {
      console.error('Error starting NotificationHub connection:', err);

      const message = String((err as any)?.message || err || '').toLowerCase();
      if (message.includes('failed to complete negotiation') && message.includes('404')) {
        this.reconnectBlockedUntil = Date.now() + 30000;
        console.error('NotificationHubService: Hub negotiate returned 404. Check notification hub URL/proxy route. Reconnect attempts paused for 30s.');
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
        console.error('Error stopping NotificationHub connection:', err);
      }
    }
    this.connectionState$.next(HubConnectionState.Disconnected);
  }

  on<T>(event: string, callback: (data: T) => void): void {
    if (this.connection) {
      this.connection.on(event, callback);
    }
  }

  off(event: string): void {
    if (this.connection) {
      this.connection.off(event);
    }
  }

  getConnectionState(): string {
    return this.connection?.state.toString() || HubConnectionState.Disconnected.toString();
  }
}
