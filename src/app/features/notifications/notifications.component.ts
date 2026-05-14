import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { Notification } from '../../core/models/notification.model';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, MatButtonModule],
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.scss']
})
export class NotificationsComponent implements OnInit {
  notifications: Notification[] = [];
  loading = false;
  currentUserId: number | null = null;

  constructor(
    private authService: AuthService,
    private notificationService: NotificationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const user = this.authService.currentUserValue;
    this.currentUserId = user?.userId ?? null;
    if (!this.currentUserId) {
      this.router.navigateByUrl('/login');
      return;
    }

    this.loadNotifications();
    this.notificationService.notifications$.subscribe(items => {
      this.notifications = items || [];
    });
  }

  loadNotifications(): void {
    if (!this.currentUserId) return;
    this.loading = true;
    this.notificationService.getNotifications(this.currentUserId).subscribe({
      next: items => {
        this.notifications = items || [];
        this.loading = false;
      },
      error: err => {
        console.error('Failed to load notifications', err);
        this.loading = false;
      }
    });
  }

  markAsRead(notificationId: number): void {
    this.notificationService.markAsRead(notificationId).subscribe({
      next: () => {
        this.notifications = this.notifications.map(item =>
          item.notificationId === notificationId ? { ...item, isRead: true } : item
        );
      },
      error: err => console.error('Failed to mark notification as read', err)
    });
  }

  markAllAsRead(): void {
    if (!this.currentUserId) return;
    this.notificationService.markAllAsRead(this.currentUserId).subscribe({
      next: () => {
        this.notifications = this.notifications.map(item => ({ ...item, isRead: true }));
      },
      error: err => console.error('Failed to mark all notifications as read', err)
    });
  }

  get unreadCount(): number {
    return this.notifications.filter(n => !n.isRead).length;
  }

  getTypeLabel(type: string): string {
    switch (type) {
      case 'MESSAGE': return 'Message';
      case 'MENTION': return 'Mention';
      case 'ROOM_INVITE': return 'Room invite';
      case 'ROLE_CHANGE': return 'Role change';
      case 'PLATFORM': return 'Platform';
      default: return 'Notification';
    }
  }

  getTypeIcon(type: string): string {
    switch (type) {
      case 'MESSAGE': return 'chat_bubble_outline';
      case 'MENTION': return 'alternate_email';
      case 'ROOM_INVITE': return 'groups';
      case 'ROLE_CHANGE': return 'admin_panel_settings';
      case 'PLATFORM': return 'info';
      default: return 'notifications';
    }
  }

  goBack(): void {
    this.router.navigateByUrl('/dashboard');
  }
}
