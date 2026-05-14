import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit, ViewChild, ElementRef } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { ChatHubService } from '../../../core/services/chat-hub.service';
import { MessageService } from '../../../core/services/message.service';
import { AuthService } from '../../../core/services/auth.service';
import { ActivatedRoute } from '@angular/router';
import { User } from '../../../core/models/user.model';
import { firstValueFrom, Subscription } from 'rxjs';
import { environment } from '../../../../environments/environment';

interface ChatMessage {
  messageId: number | null;
  senderId: number | null;
  receiverId: number | null;
  content: string;
  createdAt: string;
  isRead?: boolean;
  mediaUrl?: string | null;
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
  
  // ✅ PHASE 4: Image preview state variables
  selectedImageFile: File | null = null;
  selectedImagePreview: string | null = null;
  
  showSearchModal = false;
  searchQuery = '';
  searchResults: any[] = [];
  private userById = new Map<number, User>();
  private subscriptions = new Subscription();

  /**
   * Handler for incoming messages from the receiver.
   * Called when another user sends a message to us.
   */
  private receiveMessageHandler = (message: any) => {
    if (!this.currentUserId || !message) {
      console.warn('DirectMessages: receiveMessageHandler - Invalid currentUserId or message', { 
        currentUserId: this.currentUserId, 
        messageExists: !!message 
      });
      return;
    }

    // ✅ DETAILED LOGGING: Incoming realtime payload
    console.log('Incoming realtime payload:', message);
    console.log('Current User:', this.currentUserId);
    console.log('Selected User:', this.selectedUserId);

    console.log('DirectMessages: ReceiveMessage event received', {
      messageId: message.messageId,
      senderId: message.senderId,
      receiverId: message.receiverId,
      currentUserId: this.currentUserId,
      selectedUserId: this.selectedUserId,
      content: message.content?.substring(0, 50) + '...',
      mediaUrl: message?.mediaUrl ?? null
    });

    // ✅ BIDIRECTIONAL FILTERING: Replace strict filtering with Number() conversions
    const belongsToCurrentChat =
      (
        Number(message.senderId) === Number(this.selectedUserId)
        &&
        Number(message.receiverId) === Number(this.currentUserId)
      )
      ||
      (
        Number(message.senderId) === Number(this.currentUserId)
        &&
        Number(message.receiverId) === Number(this.selectedUserId)
      );

    // Update recent chats for all incoming/outgoing messages
    if (message.senderId !== this.currentUserId || message.receiverId) {
      this.messageService.handleIncomingMessage(message, this.currentUserId);
    }

    // Only append to message list if it's for the active chat AND we didn't send it
    if (belongsToCurrentChat && Number(message.senderId) !== Number(this.currentUserId)) {
      // ✅ PREVENT DUPLICATE: Check by messageId before appending
      const isDuplicate = this.messages.some(msg => msg.messageId === message.messageId);
      
      if (!isDuplicate) {
        const newMessage: ChatMessage = {
          messageId: message?.messageId ?? null,
          senderId: message?.senderId ?? null,
          receiverId: message?.receiverId ?? null,
          content: message?.content ?? message?.message ?? '',
          createdAt: message?.sentAt ?? message?.createdAt ?? new Date().toISOString(),
          isRead: message?.isRead ?? false,
          mediaUrl: message?.mediaUrl ?? null
        };

        // ✅ LOGGING: Appending realtime message
        console.log('Appending realtime message:', newMessage);
        this.messages = [...this.messages, newMessage];

        // Scroll to show new message
        setTimeout(() => this.scrollToBottom(), 100);
      } else {
        console.log('Duplicate message detected, skipping:', message.messageId);
      }
    } else if (!belongsToCurrentChat) {
      console.log('DirectMessages: Message is not for active chat, only updating recent chats');
    }

    // Refresh recent chats list
    this.loadRecentChats();
  };

  /**
   * Handler for message sent acknowledgement.
   * Called when our message is successfully delivered to backend.
   */
  private messageSentHandler = (message: any) => {
    if (!this.currentUserId || !message) {
      return;
    }

    console.log('DirectMessages: MessageSent acknowledgement received', {
      messageId: message.messageId,
      receiverId: message.receiverId,
      content: message.content?.substring(0, 50) + '...'
    });

    // Update recent chats for the sender as well
    this.messageService.recordOutgoingMessage(message, this.currentUserId);

    // Check if this message belongs to the currently active chat
    const isForActiveChat = this.selectedUserId && (
      (message.senderId === this.selectedUserId && message.receiverId === this.currentUserId) ||
      (message.senderId === this.currentUserId && message.receiverId === this.selectedUserId)
    );

    if (isForActiveChat) {
      // 1. Try to find and update an optimistic message
      const optimisticIndex = this.messages.findIndex(m => this.isSamePayload(m, message));
      
      if (optimisticIndex !== -1) {
        // Replace the optimistic message with confirmed message from backend
        this.messages[optimisticIndex] = {
          ...this.messages[optimisticIndex],
          messageId: message.messageId,
          createdAt: message.sentAt || message.createdAt || this.messages[optimisticIndex].createdAt,
          mediaUrl: message.mediaUrl ?? this.messages[optimisticIndex].mediaUrl ?? null
        };
        console.log('DirectMessages: Updated optimistic message at index', optimisticIndex);
      } else {
        // 2. If no optimistic message (e.g., from another tab), append it
        // Only if it's not already in the list (checking by messageId)
        const exists = this.messages.some(m => m.messageId === message.messageId);
        if (!exists) {
          const newMessage: ChatMessage = {
            messageId: message.messageId,
            senderId: message.senderId,
            receiverId: message.receiverId,
            content: message.content,
            createdAt: message.sentAt || message.createdAt || new Date().toISOString(),
            isRead: message.isRead || false,
            mediaUrl: message.mediaUrl ?? null
          };
          this.messages = [...this.messages, newMessage];
          console.log('DirectMessages: Appended message from another tab/device');
          setTimeout(() => this.scrollToBottom(), 100);
        }
      }
    }

    // Refresh recent chats list to show updated preview
    this.loadRecentChats();
  };

  /**
   * Handler for message read status updates.
   * Called when receiver reads our message.
   */
  private messageReadHandler = (data: any) => {
    if (!data?.messageId) {
      return;
    }

    console.log('DirectMessages: MessageRead event received', { messageId: data.messageId });

    const msg = this.messages.find(m => m.messageId === data.messageId);
    if (msg) {
      msg.isRead = true;
      console.log('DirectMessages: Marked message as read', data.messageId);
    }
  };

  constructor(
  private chatHubService: ChatHubService,
  private messageService: MessageService,
  private authService: AuthService,
  private router: Router,
  private route: ActivatedRoute,
  private http: HttpClient
) {}

  async ngOnInit(): Promise<void> {
    this.subscriptions.add(
      this.authService.getAllUsers().subscribe({
        next: (users: User[]) => {
          this.userById = new Map(users.map(u => [u.userId, u]));
          this.loadRecentChats();
        },
        error: () => {
          this.userById.clear();
        }
      })
    );

    this.subscriptions.add(
      this.authService.currentUser$.subscribe(user => {
        this.currentUserId = user?.userId ?? null;
        console.log('DirectMessages: currentUserId updated', this.currentUserId);
        if (this.currentUserId) {
          this.loadRecentChats();
          if (this.selectedUserId) {
            void this.loadHistory();
          }
        }
      })
    );

    this.subscriptions.add(
      this.messageService.recentChats$.subscribe(chats => {
        this.recentChats = chats;
        if (!this.selectedUserId) {
          const storedUserId = this.messageService.getSelectedChatUserIdSnapshot();
          if (storedUserId) {
            const storedChat = this.recentChats.find(chat => chat.user?.userId === storedUserId);
            if (storedChat) {
              this.selectUser(
                storedUserId,
                storedChat.user.displayName || storedChat.user.userName,
                storedChat.user.avatarUrl || null,
                true
              );
            }
          }
        }
      })
    );

    this.subscriptions.add(
      this.route.queryParams.subscribe(params => {
        if (params['userId']) {
          this.selectUser(Number(params['userId']), undefined, undefined, true);
        }
      })
    );

    const storedUserId = this.messageService.getSelectedChatUserIdSnapshot();
    if (storedUserId) {
      this.selectedUserId = storedUserId;
    }

    try {
      if (this.chatHubService.getConnectionState() === 'Disconnected') {
        await this.chatHubService.start();
      }
      
      // Subscribe to real-time message observables from ChatHubService
      this.subscriptions.add(
        this.chatHubService.messageReceived$.subscribe(data => {
          if (data) this.receiveMessageHandler(data);
        })
      );

      this.subscriptions.add(
        this.chatHubService.messageSent$.subscribe(data => {
          if (data) this.messageSentHandler(data);
        })
      );
      
      this.chatHubService.on<any>('MessageRead', this.messageReadHandler);
      
      console.log('DirectMessages: SignalR event subscriptions established successfully');
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
    this.subscriptions.unsubscribe();
    
    // MessageRead is still handled via manual listener as it's less frequent
    this.chatHubService.off('MessageRead', this.messageReadHandler);
  }

  loadRecentChats(): void {
    if (!this.currentUserId) {
      console.warn('loadRecentChats: currentUserId is null, skipping.');
      return;
    }
    this.subscriptions.add(
      this.messageService.getRecentChats(this.currentUserId).subscribe({
        next: (data: any[]) => {
        console.log('loadRecentChats: raw data received', data);
        
        // 1. Normalize raw messages/recent-chat rows into a stable shape.
        let processedChats: any[] = data.map(item => {
          const otherUserId = this.getOtherUserId(item);
          const knownUser = otherUserId ? this.userById.get(otherUserId) : undefined;

          return {
            user: {
              userId: otherUserId,
              displayName: this.resolveUserName(item, knownUser, otherUserId),
              userName: knownUser?.userName || item.user?.userName || '',
              avatarUrl: this.resolveUserAvatar(item, knownUser)
            },
            lastMessage: item.lastMessage || { content: item.content, createdAt: item.sentAt || item.createdAt },
            unreadCount: item.unreadCount ?? 0
          };
        });

        // 2. Merge with session drafts
        const sessionDrafts = this.messageService.getDraftChats();
        sessionDrafts.forEach(draft => {
          if (!processedChats.some(c => c.user?.userId === draft.user?.userId)) {
            processedChats.push(draft);
          }
        });

        if (this.selectedUserId) {
          processedChats = processedChats.map(chat => ({
            ...chat,
            unreadCount: chat.user?.userId === this.selectedUserId ? 0 : chat.unreadCount
          }));
        }

        this.recentChats = processedChats;
        this.messageService.setRecentChats(this.recentChats as any);

        if (!this.selectedUserId) {
          const storedUserId = this.messageService.getSelectedChatUserIdSnapshot();
          if (storedUserId) {
            const storedChat = this.recentChats.find(chat => chat.user?.userId === storedUserId);
            if (storedChat) {
              this.selectUser(
                storedUserId,
                storedChat.user.displayName || storedChat.user.userName,
                storedChat.user.avatarUrl || null,
                true
              );
            }
          }
        }

        if (this.selectedUserId) {
          const chat = processedChats.find(c => c.user?.userId === this.selectedUserId);
          if (chat) {
            // Update header info
            this.selectedUserName = chat.user.displayName || chat.user.userName || this.selectedUserName;
            this.selectedUserAvatarUrl = chat.user.avatarUrl || null;
          }
        }
      },
      error: (err) => console.error('loadRecentChats: error', err)
    }));
  }

  async loadHistory(): Promise<void> {
    if (!this.currentUserId || !this.selectedUserId) return;
    this.messageService.getMessages(this.currentUserId, this.selectedUserId).subscribe(async msgs => {
      this.messages = msgs.map(m => ({
        messageId: m.messageId,
        senderId: m.senderId,
        receiverId: m.receiverId,
        content: m.content,
        createdAt: m.sentAt || m.createdAt,
        isRead: m.isRead,
        mediaUrl: m.mediaUrl ?? null
      })).sort((a, b) => this.toTime(a.createdAt) - this.toTime(b.createdAt));

      setTimeout(() => this.scrollToBottom(), 50);

      // Mark unread messages as read (Safely check connection)
      const unread = msgs.filter(m => m.receiverId === this.currentUserId && !m.isRead);
      if (unread.length > 0) {
        await this.chatHubService.ensureConnected();
      }
      if (this.chatHubService.getConnectionState() === 'Connected') {
        this.loadRecentChats();
      } else {
        console.warn('loadHistory: SignalR not connected. Marking messages as read locally.');
      }
    });
  }

  private toTime(value?: string): number {
    if (!value) return 0;
    const t = new Date(value).getTime();
    return Number.isNaN(t) ? 0 : t;
  }

  selectUser(userId: number, name?: string, avatarUrl?: string, skipRouteUpdate = false): void {
    this.selectedUserId = userId;
    this.messages = [];
    this.messageService.setSelectedChatUserId(userId);

    if (!skipRouteUpdate) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { userId },
        queryParamsHandling: 'merge'
      });
    }

    this.recentChats = this.recentChats.map(chat => ({
      ...chat,
      unreadCount: chat.user?.userId === userId ? 0 : chat.unreadCount
    }));
    this.messageService.setRecentChats(this.recentChats as any);
    
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

    if (this.currentUserId) {
      void this.loadHistory();
    }
  }
  // ✅ PHASE 4: Handle file selection - show preview immediately, no upload yet
  onFileSelected(event: any): void {
    const file = event.target.files[0];

    if (!file) {
      return;
    }

    // Validate file is actually an image
    if (!file.type.startsWith('image/')) {
      console.warn('Selected file is not an image:', file.type);
      return;
    }

    console.log('Image selected for preview:', file.name);

    this.selectedImageFile = file;

    // Create preview immediately using FileReader
    const reader = new FileReader();

    reader.onload = (e: any) => {
      this.selectedImagePreview = e.target.result as string;
      console.log('Image preview created, awaiting user confirmation to send');
    };

    reader.readAsDataURL(file);
  }

  // ✅ PHASE 4: Remove selected image and preview
  removeSelectedImage(): void {
    this.selectedImageFile = null;
    this.selectedImagePreview = null;
    console.log('Selected image removed');
  }

  private getStoredSelectedUserId(): number | null {
    return this.messageService.getSelectedChatUserIdSnapshot();
  }

  async send(): Promise<void> {
    const content = this.draft.trim();
    
    // Detailed logging for debugging
    console.log('--- SEND ATTEMPT ---');
    console.log('Content:', content);
    console.log('Has image:', !!this.selectedImageFile);
    console.log('Selected User ID:', this.selectedUserId);
    console.log('Current User ID:', this.currentUserId);
    
    // Allow sending either text or image (not both required)
    if (!content && !this.selectedImageFile) {
      console.warn('Send aborted: No message content or image selected');
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

    // ✅ PHASE 5: If image selected, upload it first
    let uploadedMediaUrl: string | null = null;
    
    if (this.selectedImageFile) {
      console.log('Image selected, uploading before sending message...');
      
      const formData = new FormData();
      formData.append('file', this.selectedImageFile);

      try {
        const response = await this.http.post<any>(
          `${environment.mediaApiUrl}/api/media/upload`,
          formData
        ).toPromise();

        uploadedMediaUrl = response?.url;
        console.log('Image uploaded successfully:', uploadedMediaUrl);
      } catch (error) {
        console.error('Image upload failed:', error);
        alert('Image upload failed. Please try again.');
        return;
      }
    }

    // ✅ PHASE 5: Send message with or without image
    const newMsg: ChatMessage = {
      messageId: null, // Temporary until server confirms
      senderId: this.currentUserId,
      receiverId: this.selectedUserId,
      content,
      createdAt: new Date().toISOString(),
      isRead: false,
      mediaUrl: uploadedMediaUrl || null
    };
    
    this.messages = [...this.messages, newMsg];
    this.messageService.recordOutgoingMessage(newMsg, this.currentUserId);
    
    // Clear input and preview
    this.draft = '';
    this.selectedImageFile = null;
    this.selectedImagePreview = null;
    
    // Scroll to bottom immediately
    setTimeout(() => this.scrollToBottom(), 50);

    try {
      if (this.chatHubService.getConnectionState() === 'Disconnected') {
        await this.chatHubService.ensureConnected();
      }

      const state = this.chatHubService.getConnectionState();

      if (state === 'Connected') {
        if (uploadedMediaUrl) {
          // Send image message
          console.log('Sending image message via SignalR');
          await this.chatHubService.invoke(
            'SendDirectMedia',
            this.selectedUserId,
            uploadedMediaUrl,
            content
          );
          console.log('Image message sent successfully');
        } else if (content) {
          // Send text message
          console.log('Sending text message via SignalR');
          await this.chatHubService.invoke('SendDirectMessage', this.selectedUserId, content);
          console.log('Text message sent successfully');
        }
        return;
      }

      console.warn(`SignalR unavailable (state=${state}). Falling back to HTTP direct message API.`);

      await firstValueFrom(
        this.messageService.sendDirectMessage({
          senderId: Number(this.currentUserId),
          receiverId: Number(this.selectedUserId),
          content: content || '',
          mediaUrl: uploadedMediaUrl || null,
          messageType: uploadedMediaUrl ? 'IMAGE' : 'TEXT'
        })
      );

      console.log('Message persisted via HTTP fallback');
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

  private getOtherUserId(item: any): number | null {
    if (!item) return null;
    if (item.user?.userId) return item.user.userId;
    if (item.userId) return item.userId;
    if (item.receiverId != null && item.senderId != null && this.currentUserId != null) {
      return item.senderId === this.currentUserId ? item.receiverId : item.senderId;
    }
    return item.senderId ?? item.receiverId ?? null;
  }

  private resolveUserName(item: any, knownUser?: User, userId?: number | null): string {
    return (
      knownUser?.displayName ||
      knownUser?.userName ||
      knownUser?.email?.split('@')[0] ||
      item.user?.displayName ||
      item.user?.userName ||
      item.user?.email?.split('@')[0] ||
      (userId ? `User ${userId}` : 'Conversation')
    );
  }

  private resolveUserAvatar(item: any, knownUser?: User): string | null {
    return knownUser?.avatarUrl || item.user?.avatarUrl || null;
  }

  private isSamePayload(message: ChatMessage, payload: any): boolean {
    if (message.messageId != null && payload?.messageId != null) {
      return message.messageId === payload.messageId;
    }

    const messageContent = (message.content || '').trim();
    const payloadContent = (payload?.content || payload?.message || '').trim();
    const messageMediaUrl = message.mediaUrl || '';
    const payloadMediaUrl = payload?.mediaUrl || '';

    return (
      message.senderId === (payload?.senderId ?? null) &&
      message.receiverId === (payload?.receiverId ?? null) &&
      messageContent === payloadContent &&
      messageMediaUrl === payloadMediaUrl
    );
  }
}
