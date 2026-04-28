import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../../core/services/auth.service';
import { User } from '../../../core/models/user.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  user: User | null = null;
  greetingText = '';
  unreadCount = 0;
  recentChats: any[] = [];
  userRooms: any[] = [];
  notifications: any[] = [];
  private sub?: Subscription;

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.sub = this.authService.currentUser$.subscribe(user => {
      this.user = user;
    });
    this.greetingText = this.getGreeting();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  get displayName(): string {
    if (!this.user) return 'User';
    if (this.user.displayName && this.user.displayName.trim()) return this.user.displayName;
    if (this.user.userName && this.user.userName.trim()) return this.user.userName;
    if (this.user.email && this.user.email.includes('@')) return this.user.email.split('@')[0];
    return 'User';
  }

  getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }
}