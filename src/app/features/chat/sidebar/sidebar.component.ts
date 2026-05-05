import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';

import { MessageService } from '../../../core/services/message.service';
import { AuthService } from '../../../core/services/auth.service';
import { SidebarService } from '../../../core/services/sidebar.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatListModule,
    MatIconModule
  ],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent implements OnInit {

  currentUser: any = null;
  totalUnread = 0;
  isOpen = false;

  constructor(
    private authService: AuthService,
    private messageService: MessageService,
    private sidebarService: SidebarService,
    private notificationService: NotificationService,
    public router: Router
  ) { }

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (user) {
        this.loadUnreadCount();
      }
    });

    this.sidebarService.sidebarOpen$.subscribe((open: boolean) => {
      this.isOpen = open;
    });

    // Subscribe to notification count for real-time badge updates
    this.notificationService.unreadCount$.subscribe(count => {
      this.totalUnread = count;
    });
  }

  closeSidebar(): void {
    this.sidebarService.setOpen(false);
  }

  loadUnreadCount(): void {
    if (!this.currentUser || !this.currentUser.userId || isNaN(this.currentUser.userId)) return;
    this.messageService.getRecentChats(this.currentUser.userId).subscribe(chats => {
      this.totalUnread = chats.reduce((acc, chat) => acc + chat.unreadCount, 0);
    });
  }

  get initials(): string {
    if (!this.currentUser?.displayName) return 'U';
    return this.currentUser.displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  }

  get displayName(): string {
    const u = this.currentUser;
    if (!u) return 'User';
    return u.displayName || u.userName || u.email?.split('@')[0] || 'User';
  }

  isActive(path: string): boolean {
    return this.router.url === path || (path !== '/dashboard' && this.router.url.startsWith(path));
  }

  getAvatarGradient(): string {
    return 'linear-gradient(135deg, #6e8efb 0%, #a777e3 100%)';
  }

  goTo(path: string): void {
    this.router.navigateByUrl(path);
  }

  logout(): void {
    this.authService.logout();
  }
}