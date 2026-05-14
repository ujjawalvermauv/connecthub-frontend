import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { AuthService } from '../../../core/services/auth.service';
import { MessageService, RecentChat } from '../../../core/services/message.service';
import { RoomService, ChatRoom } from '../../../core/services/room.service';
import { SidebarService } from '../../../core/services/sidebar.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ChatHubService } from '../../../core/services/chat-hub.service';
import { User } from '../../../core/models/user.model';
import { Router } from '@angular/router';

import { Subscription, Observable } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {

  displayName = 'User';
  greetingText = '';
  unreadCount = 0;
  currentUser: any = null;
  notificationCount$: Observable<number>;
  private userById = new Map<number, User>();

  // view-model for template (mapped from API RecentChat)
  recentChats: Array<{ userId?: number; name: string; avatarUrl?: string | null; preview: string; timeAgo: string; isOnline?: boolean; unreadCount: number }> = [];
  userRooms: ChatRoom[] = [];

  private sub?: Subscription;
  private chatSub?: Subscription;
  private roomSub?: Subscription;
  private recentChatsSub?: Subscription;
  
  /**
   * Handler for incoming messages.
   * Updates recent chats list when a new message arrives.
   */
  private receiveMessageHandler = (message: any) => {
    if (!this.currentUser?.userId || !message) {
      console.warn('Dashboard: receiveMessageHandler - Invalid currentUser or message');
      return;
    }
    
    console.log('Dashboard: ReceiveMessage event - updating recent chats', {
      messageId: message.messageId,
      senderId: message.senderId,
      receiverId: message.receiverId,
      content: message.content?.substring(0, 50) + '...'
    });
    
    this.messageService.handleIncomingMessage(message, this.currentUser.userId);
    this.reloadRecentChats(this.currentUser.userId);
  };

  constructor(
    private authService: AuthService,
    private messageService: MessageService,
    private roomService: RoomService,
    private sidebarService: SidebarService,
    private notificationService: NotificationService,
    private chatHubService: ChatHubService,
    private router: Router
  ) { 
    this.notificationCount$ = this.notificationService.unreadCount$;
  }

  toggleSidebar(): void {
    console.log('Dashboard: toggleSidebar clicked');
    this.sidebarService.toggle();
  }

  ngOnInit(): void {

    this.recentChatsSub = this.messageService.recentChats$.subscribe(() => {
      this.applyCachedRecentChats();
    });

    this.greetingText = this.getGreeting();

    this.authService.getAllUsers().subscribe({
      next: (users: User[]) => {
        this.userById = new Map(users.map(u => [u.userId, u]));
        this.applyCachedRecentChats();
        if (this.currentUser?.userId && !isNaN(this.currentUser.userId)) {
          this.reloadRecentChats(this.currentUser.userId);
        }
      },
      error: () => {
        this.userById.clear();
      }
    });

    // ✅ USER + CHAT FIX HERE
    this.sub = this.authService.currentUser$.subscribe(user => {
      if (!user) return;

      this.currentUser = user;
      this.displayName =
        user.displayName ||
        user.userName ||
        user.email?.split('@')[0] ||
        'User';

      this.applyCachedRecentChats();

      if (!user.userId || isNaN(user.userId)) return;

      this.reloadRecentChats(user.userId);

      // rooms
      this.roomSub = this.roomService.getUserRooms().subscribe({
        next: (rooms: ChatRoom[]) => {
          this.userRooms = rooms.slice(0, 3);
        },
        error: () => {
          this.userRooms = [];
        }
      });
      // notifications
      this.notificationService.getNotifications(user.userId).subscribe();

      // Setup SignalR for real-time message updates
      this.setupSignalR();
    });
  }

  private reloadRecentChats(userId: number): void {
    this.chatSub?.unsubscribe();
    this.chatSub = this.messageService.getRecentChats(userId).subscribe({
        next: (chats: RecentChat[]) => {
          this.messageService.setRecentChats(chats);
          const slice = Array.isArray(chats) ? chats.slice(0, 5) : [];
          this.recentChats = slice.map(c => ({
            userId: c.user?.userId ?? (c as any)?.userId ?? this.getOtherUserId(c as any),
            name: this.resolveChatName(c as any),
            avatarUrl: this.resolveChatAvatar(c as any),
            preview: c.lastMessage?.content || '',
            timeAgo: this.timeAgo(c.lastMessage?.createdAt),
            isOnline: false,
            unreadCount: c.unreadCount || 0
          }));
          this.unreadCount = slice.reduce((s, c) => s + (c.unreadCount || 0), 0);
        },
        error: (err) => {
          console.error('reloadRecentChats error:', err);
          // Keep cached chats on error
          this.applyCachedRecentChats();
        }
      });
  }

  private applyCachedRecentChats(): void {
    const chats = this.messageService.getRecentChatsSnapshot();
    const slice = Array.isArray(chats) ? chats.slice(0, 5) : [];
    if (slice.length === 0) {
      this.recentChats = [];
      this.unreadCount = 0;
      return;
    }

    this.recentChats = slice.map(c => ({
      userId: c.user?.userId ?? (c as any)?.userId ?? this.getOtherUserId(c as any),
      name: this.resolveChatName(c as any),
      avatarUrl: this.resolveChatAvatar(c as any),
      preview: c.lastMessage?.content || '',
      timeAgo: this.timeAgo(c.lastMessage?.createdAt),
      isOnline: false,
      unreadCount: c.unreadCount || 0
    }));
    this.unreadCount = slice.reduce((s, c) => s + (c.unreadCount || 0), 0);
  }

  private async setupSignalR(): Promise<void> {
    try {
      const currentState = this.chatHubService.getConnectionState();
      console.log('Dashboard: Setting up SignalR. Current state:', currentState);
      
      if (currentState === 'Disconnected') {
        console.log('Dashboard: Starting SignalR connection...');
        await this.chatHubService.start();
        console.log('Dashboard: SignalR connection started successfully');
      } else {
        console.log('Dashboard: SignalR already connected or connecting');
      }
      
      // Register message handler
      this.chatHubService.on<any>('ReceiveMessage', this.receiveMessageHandler);
      console.log('Dashboard: ReceiveMessage handler registered');
    } catch (error) {
      console.error('Dashboard: SignalR connection failed', error);
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.chatSub?.unsubscribe();
    this.roomSub?.unsubscribe();
    this.recentChatsSub?.unsubscribe();
    
    // Unregister SignalR handlers
    this.chatHubService.off('ReceiveMessage', this.receiveMessageHandler);
    console.log('Dashboard: Component destroyed, SignalR handlers unregistered');
  }

  private getGreeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }

  // Template helpers / computed properties
  get totalUnread(): number {
    return this.unreadCount;
  }

  getAvatarGradient(i: number): string {
    const colors = [
      ['#7F00FF', '#E100FF'],
      ['#FF7A18', '#AF002D'],
      ['#00C9FF', '#92FE9D'],
      ['#FBD3E9', '#BB377D']
    ];
    const c = colors[i % colors.length];
    return `linear-gradient(135deg, ${c[0]} 0%, ${c[1]} 100%)`;
  }

  get initials(): string {
    const parts = (this.displayName || '').trim().split(/\s+/);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  get dateText(): string {
    const now = new Date();
    return now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  }

  get roomCount(): number {
    return this.userRooms?.length || 0;
  }

  get activeRooms(): ChatRoom[] {
    return this.userRooms || [];
  }

  getInitials(name?: string): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  goTo(path: string): void {
    if (!path) return;
    this.router.navigateByUrl(path);
  }

  goToNotifications(): void {
    this.router.navigateByUrl('/notifications');
  }

  private timeAgo(dateStr?: string): string {
    if (!dateStr) return '';
    const then = new Date(dateStr).getTime();
    if (isNaN(then)) return '';
    const diff = Date.now() - then;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `${days}d`;
  }

  private getOtherUserId(chat: any): number | null {
    if (!chat) return null;
    if (chat.user?.userId) return chat.user.userId;
    if (chat.userId) return chat.userId;
    if (chat.senderId && this.currentUser?.userId && chat.senderId !== this.currentUser.userId) return chat.senderId;
    if (chat.receiverId && this.currentUser?.userId && chat.receiverId !== this.currentUser.userId) return chat.receiverId;
    return chat.senderId ?? chat.receiverId ?? null;
  }

  private resolveChatName(chat: any): string {
    const userId = this.getOtherUserId(chat);
    const known = userId ? this.userById.get(userId) : undefined;
    return (
      known?.displayName ||
      known?.userName ||
      known?.email?.split('@')[0] ||
      chat?.user?.displayName ||
      chat?.user?.userName ||
      chat?.user?.email?.split('@')[0] ||
      (userId ? `User ${userId}` : 'Conversation')
    );
  }

  private resolveChatAvatar(chat: any): string | null {
    const userId = this.getOtherUserId(chat);
    const known = userId ? this.userById.get(userId) : undefined;
    return known?.avatarUrl || chat?.user?.avatarUrl || null;
  }
}