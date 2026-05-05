import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Notification } from '../models/notification.model';
import { NotificationHubService } from './notification-hub.service';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private apiUrl = '/api/notifications';
  
  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  notifications$ = this.notificationsSubject.asObservable();
  
  private unreadCountSubject = new BehaviorSubject<number>(0);
  unreadCount$ = this.unreadCountSubject.asObservable();

  constructor(
    private http: HttpClient,
    private notificationHub: NotificationHubService,
    private authService: AuthService
  ) {
    this.notificationHub.on<number>('NotificationCount', count => {
      this.unreadCountSubject.next(count);
      // Auto-refresh notifications when count changes
      const user = this.authService.currentUserValue;
      if (user && user.userId) {
        this.getNotifications(user.userId).subscribe();
      }
    });
  }

  getNotifications(userId: number): Observable<Notification[]> {
    return this.http.get<Notification[]>(`${this.apiUrl}/byRecipient/${userId}`).pipe(
      tap(notifications => {
        this.notificationsSubject.next(notifications);
        this.updateUnreadCount(notifications);
      })
    );
  }

  markAsRead(notificationId: number): Observable<any> {
    return this.http.put(`${this.apiUrl}/markAsRead/${notificationId}`, {}).pipe(
      tap(() => {
        const current = this.notificationsSubject.value.map(n => 
          n.notificationId === notificationId ? { ...n, isRead: true } : n
        );
        this.notificationsSubject.next(current);
        this.updateUnreadCount(current);
      })
    );
  }

  markAllAsRead(userId: number): Observable<any> {
    return this.http.put(`${this.apiUrl}/markAllRead/${userId}`, {}).pipe(
      tap(() => {
        const current = this.notificationsSubject.value.map(n => ({ ...n, isRead: true }));
        this.notificationsSubject.next(current);
        this.updateUnreadCount(current);
      })
    );
  }

  private updateUnreadCount(notifications: Notification[]): void {
    const count = notifications.filter(n => !n.isRead).length;
    this.unreadCountSubject.next(count);
  }
}
