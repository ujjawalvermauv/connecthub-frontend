import { Injectable } from '@angular/core';
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel
} from '@microsoft/signalr';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class NotificationHubService {
  private connection: HubConnection;
  public connectionState$ = new BehaviorSubject<HubConnectionState>(HubConnectionState.Disconnected);

  constructor(private authService: AuthService) {
    this.connection = new HubConnectionBuilder()
      .withUrl('/hubs/notifications', {
        accessTokenFactory: () => this.authService.getToken() || ''
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(LogLevel.Warning)
      .build();

    this.connection.onreconnecting(() => {
      this.connectionState$.next(HubConnectionState.Reconnecting);
    });
    this.connection.onreconnected(() => {
      this.connectionState$.next(HubConnectionState.Connected);
    });
    this.connection.onclose(() => {
      this.connectionState$.next(HubConnectionState.Disconnected);
    });

    this.authService.isAuthenticated$.subscribe(isAuth => {
      if (isAuth) this.start();
      else this.stop();
    });
  }

  async start(): Promise<void> {
    if (this.connection.state === HubConnectionState.Connected) return;
    try {
      await this.connection.start();
      this.connectionState$.next(this.connection.state);
    } catch (err) {
      console.error('Error starting NotificationHub connection:', err);
    }
  }

  async stop(): Promise<void> {
    if (this.connection.state !== HubConnectionState.Disconnected) {
      await this.connection.stop();
      this.connectionState$.next(HubConnectionState.Disconnected);
    }
  }

  on<T>(event: string, callback: (data: T) => void): void {
    this.connection.on(event, callback);
  }

  off(event: string): void {
    this.connection.off(event);
  }

  getConnectionState(): string {
    return this.connection.state;
  }
}
