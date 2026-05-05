import { Component, OnDestroy, OnInit, ViewChild, ElementRef } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { ChatHubService } from '../../../core/services/chat-hub.service';
import { MessageService } from '../../../core/services/message.service';
import { AuthService } from '../../../core/services/auth.service';
import { ActivatedRoute } from '@angular/router';

interface ChatMessage {
  messageId: number | null;
  senderId: number | null;
  receiverId: number | null;
  content: string;
  createdAt: string;
  isRead?: boolean;
}

@Component({
  selector: 'app-direct-messages',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatInputModule, MatListModule, MatIconModule, RouterModule],
  templateUrl: './direct-messages.component.html',
  styleUrls: ['./direct-messages.component.scss']
})
export class DirectMessagesComponent implements OnInit, OnDestroy {
  @ViewChild('messageContainer') messageContainer!: ElementRef;

  recentChats: any[] = [];
  selectedUserId: number | null = null;
  selectedUserName = 'Select a user';
  draft: string = '';
  messages: ChatMessage[] = [];
  selectedUserAvatarUrl: string | null = null;
  currentUserId: number | null = null;
  
  showSearchModal = false;
  searchQuery = '';
  searchResults: any[] = [];

  constructor(
    private chatHubService: ChatHubService,
    private messageService: MessageService,
    private authService: AuthService,
    private route: ActivatedRoute
  ) {}

  async ngOnInit(): Promise<void> {
    this.authService.currentUser$.subscribe(user => {
      this.currentUserId = user?.userId ?? null;
      console.log('DirectMessages: currentUserId updated', this.currentUserId);
      if (this.currentUserId) {
        this.loadRecentChats();
      }
    });

    this.route.queryParams.subscribe(params => {
      if (params['userId']) {
        this.selectUser(Number(params['userId']));
      }
    });

    try {
      if (this.chatHubService.getConnectionState() === 'Disconnected') {
        await this.chatHubService.start();
      }
      this.chatHubService.on<any>('ReceiveMessage', message => {
        // If message is for the currently selected chat, add it
        if (
          (message.senderId === this.selectedUserId && message.receiverId === this.currentUserId) ||
          (message.senderId === this.currentUserId && message.receiverId === this.selectedUserId)
        ) {
          this.messages = [...this.messages, {
            messageId: message?.messageId ?? null,
            senderId: message?.senderId ?? null,
            receiverId: message?.receiverId ?? null,
            content: message?.content ?? message?.message ?? '',
            createdAt: message?.sentAt ?? message?.createdAt ?? new Date().toISOString(),
            isRead: message?.isRead ?? false
          }];
          
          // Scroll to bottom
          setTimeout(() => this.scrollToBottom(), 100);
        }
        // Refresh recent chats list
        this.loadRecentChats();
      });

      this.chatHubService.on<any>('MessageRead', data => {
        const msg = this.messages.find(m => m.messageId === data.messageId);
        if (msg) {
          msg.isRead = true;
        }
      });
    } catch (error) {
      console.error('SignalR connection failed', error);
    }
  }

  scrollToBottom(): void {
    if (this.messageContainer) {
      try {
        this.messageContainer.nativeElement.scrollTop = this.messageContainer.nativeElement.scrollHeight;
      } catch (err) {}
    }
  }

  ngOnDestroy(): void {
    this.chatHubService.off('ReceiveMessage');
  }

  loadRecentChats(): void {
    if (!this.currentUserId) {
      console.warn('loadRecentChats: currentUserId is null, skipping.');
      return;
    }
    this.messageService.getRecentChats(this.currentUserId).subscribe({
      next: (data: any[]) => {
        console.log('loadRecentChats: raw data received', data);
        
        // 1. Transform raw messages into RecentChat objects if they aren't already
        let processedChats: any[] = data.map(item => {
          // If it's already a RecentChat (has .user), keep it
          if (item.user) return item;

          // If it's a raw Message object, transform it
          const otherUserId = item.senderId === this.currentUserId ? item.receiverId : item.senderId;
          return {
            user: { userId: otherUserId, displayName: 'Loading...', userName: '' },
            lastMessage: { content: item.content, createdAt: item.sentAt || item.createdAt },
            unreadCount: item.isRead ? 0 : 1 // Simple heuristic
          };
        });

        // 2. Merge with session drafts
        const sessionDrafts = this.messageService.getDraftChats();
        sessionDrafts.forEach(draft => {
          if (!processedChats.some(c => c.user?.userId === draft.user?.userId)) {
            processedChats.push(draft);
          }
        });

        this.recentChats = processedChats;

        // 3. Optimized Lookup: Fetch user list once and fill in all missing names
        const needsLookup = this.recentChats.some(chat => !chat.user?.userName || chat.user?.displayName === 'Loading...');
        
        if (needsLookup) {
          this.authService.getAllUsers().subscribe(allUsers => {
            this.recentChats.forEach(chat => {
              if (!chat.user?.userName || chat.user?.displayName === 'Loading...') {
                const found = allUsers.find(u => u.userId === chat.user?.userId);
                if (found) {
                  chat.user.displayName = found.displayName || found.userName;
                  chat.user.userName = found.userName;
                  chat.user.avatarUrl = found.avatarUrl;

                  // Update header if this is the active chat
                  if (this.selectedUserId === chat.user.userId) {
                    this.selectedUserName = chat.user.displayName;
                    this.selectedUserAvatarUrl = chat.user.avatarUrl || null;
                  }
                }
              }
            });
          });
        }
        
        if (this.selectedUserId) {
          const chat = processedChats.find(c => c.user?.userId === this.selectedUserId);
          if (chat) {
            // Update header info
            if (chat.user?.displayName !== 'Loading...') {
              this.selectedUserName = chat.user.displayName || chat.user.userName;
              this.selectedUserAvatarUrl = chat.user.avatarUrl || null;
            }
            // Clear unread count locally for the active chat
            chat.unreadCount = 0;
          }
        }
      },
      error: (err) => console.error('loadRecentChats: error', err)
    });
  }

  loadHistory(): void {
    if (!this.currentUserId || !this.selectedUserId) return;
    this.messageService.getMessages(this.currentUserId, this.selectedUserId).subscribe(msgs => {
      this.messages = msgs.map(m => ({
        messageId: m.messageId,
        senderId: m.senderId,
        receiverId: m.receiverId,
        content: m.content,
        createdAt: m.sentAt || m.createdAt,
        isRead: m.isRead
      }));

      // Mark unread messages as read (Safely check connection)
      const unread = msgs.filter(m => m.receiverId === this.currentUserId && !m.isRead);
      if (this.chatHubService.getConnectionState() === 'Connected') {
        unread.forEach(m => {
          this.chatHubService.invoke('MarkMessageRead', m.messageId, m.senderId);
        });
      } else {
        console.warn('loadHistory: SignalR not connected. Marking messages as read locally.');
      }
    });
  }

  selectUser(userId: number, name?: string, avatarUrl?: string): void {
    this.selectedUserId = userId;
    this.messages = [];
    this.loadHistory();
    
    if (name) {
      this.selectedUserName = name;
    }
    if (avatarUrl) {
      this.selectedUserAvatarUrl = avatarUrl;
    }

    if (!name || !avatarUrl) {
      const chat = this.recentChats.find(c => c.user.userId === userId);
      if (chat) {
        if (!name) this.selectedUserName = chat.user.displayName || chat.user.userName;
        if (!avatarUrl) this.selectedUserAvatarUrl = chat.user.avatarUrl || null;
      }
    }
  }

  async send(): Promise<void> {
    const content = this.draft.trim();
    
    // Detailed logging for debugging
    console.log('--- SEND ATTEMPT ---');
    console.log('Content:', content);
    console.log('Selected User ID:', this.selectedUserId);
    console.log('Current User ID:', this.currentUserId);
    console.log('Auth State:', this.authService.isAuthenticated);
    
    if (!content) {
      console.warn('Send aborted: Message content is empty');
      return;
    }

    if (this.selectedUserId === null || this.selectedUserId === undefined) {
      console.warn('Send aborted: No recipient (selectedUserId) identified');
      return;
    }

    if (!this.currentUserId) {
      console.warn('Send aborted: Current user ID is missing. Attempting to restore from service...');
      const user = this.authService.currentUserValue;
      if (user && user.userId) {
        this.currentUserId = user.userId;
        console.log('Restored currentUserId:', this.currentUserId);
      } else {
        console.error('CRITICAL: Cannot send message. User session is invalid or incomplete.');
        return;
      }
    }

    // Optimistic UI update
    const newMsg: ChatMessage = {
      messageId: null, // Temporary until server confirms
      senderId: this.currentUserId,
      receiverId: this.selectedUserId,
      content,
      createdAt: new Date().toISOString(),
      isRead: false
    };
    
    this.messages = [...this.messages, newMsg];
    this.draft = '';
    
    // Scroll to bottom immediately
    setTimeout(() => this.scrollToBottom(), 50);

    try {
      console.log('Invoking SignalR: SendDirectMessage', { recipient: this.selectedUserId, text: content });
      await this.chatHubService.invoke('SendDirectMessage', this.selectedUserId, content);
      console.log('SignalR: Message sent successfully');
    } catch (error) {
      console.error('SignalR Error: Failed to send message', error);
    }
  }

  getAvatarGradient(index: number): string {
    const gradients = [
      'linear-gradient(135deg, #6e8efb 0%, #a777e3 100%)',
      'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
      'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
    ];
    return gradients[index % gradients.length];
  }

  toggleNewChat(): void {
    this.showSearchModal = !this.showSearchModal;
    if (this.showSearchModal) {
      this.searchQuery = '';
      this.searchResults = [];
    }
  }

  onSearchUsers(): void {
    if (this.searchQuery.length < 2) {
      this.searchResults = [];
      return;
    }
    this.authService.searchUsers(this.searchQuery).subscribe(users => {
      this.searchResults = users.filter(u => u.userId !== this.currentUserId);
    });
  }

  startChat(user: any): void {
    const tempChat = {
      user: {
        userId: user.userId,
        displayName: user.displayName || user.userName,
        userName: user.userName,
        avatarUrl: user.avatarUrl
      },
      lastMessage: null,
      unreadCount: 0
    };

    // 1. Save to session drafts so it survives navigation
    this.messageService.addDraftChat(tempChat);

    // 2. Add to current view immediately
    const exists = this.recentChats.some(c => c.user?.userId === user.userId);
    if (!exists) {
      this.recentChats = [tempChat, ...this.recentChats];
    }

    // 3. Select and close
    this.selectUser(user.userId, tempChat.user.displayName, user.avatarUrl);
    this.showSearchModal = false;
  }
}
