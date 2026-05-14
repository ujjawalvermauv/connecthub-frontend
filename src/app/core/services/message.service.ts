import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

interface DirectMessageEvent {
  messageId?: number | null;
  senderId?: number | null;
  receiverId?: number | null;
  content?: string;
  message?: string;
  sentAt?: string;
  createdAt?: string;
  isRead?: boolean;
  mediaUrl?: string | null;
  user?: {
    userId?: number | null;
    userName?: string;
    displayName?: string;
    avatarUrl?: string | null;
  };
  displayName?: string;
  userName?: string;
  avatarUrl?: string | null;
}

export interface RecentChat {
  user: {
    userId: number;
    userName: string;
    displayName?: string;
    avatarUrl?: string | null;
  };
  lastMessage: {
    content: string;
    createdAt: string;
    mediaUrl?: string | null;
  } | null;
  unreadCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class MessageService {

  private apiUrl: string;

  private readonly recentChatsStorageKey = 'recentDirectChats';
  private readonly draftChatsStorageKey = 'draftDirectChats';
  private readonly selectedChatStorageKey = 'selectedDirectMessageUserId';

  private draftChats: RecentChat[] = [];

  constructor(private http: HttpClient) {
    // Use the messageApiUrl from environment, falling back to relative path
    this.apiUrl = environment.messageApiUrl ? `${environment.messageApiUrl}/api/messages` : '/api/messages';
    this.restoreStateFromStorage();
  }

  private recentChatsSubject = new BehaviorSubject<RecentChat[]>([]);
  recentChats$ = this.recentChatsSubject.asObservable();

  private unreadCountSubject = new BehaviorSubject<number>(0);
  unreadCount$ = this.unreadCountSubject.asObservable();

  private selectedChatUserIdSubject =
    new BehaviorSubject<number | null>(
      this.readStoredSelectedChatUserId()
    );

  selectedChatUserId$ =
    this.selectedChatUserIdSubject.asObservable();



  private readStoredSelectedChatUserId(): number | null {

    const value =
      localStorage.getItem(this.selectedChatStorageKey) ||
      sessionStorage.getItem(this.selectedChatStorageKey);

    if (!value) {
      return null;
    }

    const parsed = Number(value);

    return Number.isNaN(parsed)
      ? null
      : parsed;
  }

  private readStoredChats(storageKey: string): RecentChat[] {

    const raw =
      localStorage.getItem(storageKey) ||
      sessionStorage.getItem(storageKey);

    if (!raw) {
      return [];
    }

    try {

      const parsed = JSON.parse(raw);

      return Array.isArray(parsed)
        ? parsed.map(item => this.normalizeRecentChat(item))
        : [];

    } catch {

      return [];

    }
  }

  private persistChats(
    storageKey: string,
    chats: RecentChat[]
  ): void {

    try {

      const serialized = JSON.stringify(chats);

      localStorage.setItem(storageKey, serialized);
      sessionStorage.setItem(storageKey, serialized);

    } catch {

      console.warn('Storage persist failed');

    }
  }

  private normalizeRecentChat(chat: any): RecentChat {

    const userId =
      chat?.user?.userId ??
      chat?.userId ??
      chat?.senderId ??
      chat?.receiverId ??
      null;

    const displayName =
      chat?.user?.displayName ||
      chat?.name ||
      chat?.user?.userName ||
      chat?.userName ||
      '';

    const userName =
      chat?.user?.userName ||
      chat?.userName ||
      chat?.name ||
      '';

    const avatarUrl =
      chat?.user?.avatarUrl ??
      chat?.avatarUrl ??
      null;

    const previewContent = chat?.preview || chat?.content || '';
    const previewMediaUrl = chat?.lastMessage?.mediaUrl || chat?.mediaUrl || null;

    const lastMessage =
      chat?.lastMessage ||
      (
        previewContent || previewMediaUrl
          ? {
              content: previewMediaUrl ? '📷 Photo' : previewContent,

              createdAt:
                chat?.lastMessage?.createdAt ||
                chat?.createdAt ||
                chat?.sentAt ||
                new Date().toISOString(),

              mediaUrl: previewMediaUrl
            }
          : null
      );

    return {
      user: {
        userId: Number(userId) || 0,
        userName,
        displayName,
        avatarUrl
      },

      lastMessage: lastMessage
        ? {
            content:
              lastMessage.mediaUrl
                ? '📷 Photo'
                : (lastMessage.content || ''),
            createdAt:
              lastMessage.createdAt ||
              new Date().toISOString(),
            mediaUrl:
              lastMessage.mediaUrl || null
          }
        : null,

      unreadCount:
        Number(chat?.unreadCount ?? 0) || 0
    };
  }

  private refreshUnreadCount(): void {

    const total =
      this.recentChatsSubject.value.reduce(
        (sum, chat) =>
          sum + (chat.unreadCount || 0),
        0
      );

    this.unreadCountSubject.next(total);
  }

  private upsertRecentChat(chat: RecentChat): void {

    const normalized =
      this.normalizeRecentChat(chat);

    const others =
      this.recentChatsSubject.value.filter(
        item =>
          item.user.userId !==
          normalized.user.userId
      );

    const updated = [
      normalized,
      ...others
    ];

    this.recentChatsSubject.next(updated);

    this.refreshUnreadCount();

    this.persistChats(
      this.recentChatsStorageKey,
      updated
    );
  }

  private restoreStateFromStorage(): void {

    const storedDrafts =
      this.readStoredChats(
        this.draftChatsStorageKey
      );

    const storedChats =
      this.readStoredChats(
        this.recentChatsStorageKey
      );

    if (storedDrafts.length > 0) {
      this.draftChats = storedDrafts;
    }

    if (storedChats.length > 0) {

      this.recentChatsSubject.next(
        storedChats
      );

      this.refreshUnreadCount();
    }
  }

  private getConversationUserId(
    message: DirectMessageEvent,
    currentUserId: number
  ): number | null {

    if (!message) {
      return null;
    }

    if (message.senderId === currentUserId) {
      return message.receiverId ?? null;
    }

    if (message.receiverId === currentUserId) {
      return message.senderId ?? null;
    }

    return (
      message.senderId ??
      message.receiverId ??
      null
    );
  }

  handleIncomingMessage(
    message: DirectMessageEvent,
    currentUserId: number
  ): void {

    if (!currentUserId) {
      return;
    }

    const otherUserId =
      this.getConversationUserId(
        message,
        currentUserId
      );

    if (!otherUserId) {
      return;
    }

    const currentChats =
      this.recentChatsSubject.value.slice();

    const existing =
      currentChats.find(
        chat =>
          chat.user.userId === otherUserId
      );

    const selectedUserId =
      this.selectedChatUserIdSubject.value;

    const isIncoming =
      message.senderId !== currentUserId;

    const createdAt =
      message.sentAt ||
      message.createdAt ||
      new Date().toISOString();

    const hasMedia = !!message.mediaUrl;
    const content = hasMedia
      ? '📷 Photo'
      : (message.content || message.message || '');

    const updatedChat: RecentChat = {

      user: {
        userId: otherUserId,

        userName:
          existing?.user.userName ||
          message.user?.userName ||
          '',

        displayName:
          existing?.user.displayName ||
          message.user?.displayName ||
          message.displayName ||
          existing?.user.userName ||
          `User ${otherUserId}`,

        avatarUrl:
          existing?.user.avatarUrl ??
          message.user?.avatarUrl ??
          message.avatarUrl ??
          null
      },

      lastMessage: {
        content,
        createdAt,
        mediaUrl: message.mediaUrl ?? null
      },

      unreadCount:
        isIncoming &&
        selectedUserId !== otherUserId
          ? (existing?.unreadCount || 0) + 1
          : 0
    };

    this.upsertRecentChat(updatedChat);
  }

  recordOutgoingMessage(
    message: DirectMessageEvent,
    currentUserId: number
  ): void {

    if (!currentUserId) {
      return;
    }

    const otherUserId =
      this.getConversationUserId(
        message,
        currentUserId
      );

    if (!otherUserId) {
      return;
    }

    const currentChats =
      this.recentChatsSubject.value.slice();

    const existing =
      currentChats.find(
        chat =>
          chat.user.userId === otherUserId
      );

    const createdAt =
      message.sentAt ||
      message.createdAt ||
      new Date().toISOString();

    const hasMedia = !!message.mediaUrl;
    const content = hasMedia
      ? '📷 Photo'
      : (message.content || message.message || '');

    const updatedChat: RecentChat = {

      user: {
        userId: otherUserId,

        userName:
          existing?.user.userName ||
          message.user?.userName ||
          '',

        displayName:
          existing?.user.displayName ||
          message.user?.displayName ||
          message.displayName ||
          existing?.user.userName ||
          `User ${otherUserId}`,

        avatarUrl:
          existing?.user.avatarUrl ??
          message.user?.avatarUrl ??
          message.avatarUrl ??
          null
      },

      lastMessage: {
        content,
        createdAt,
        mediaUrl: message.mediaUrl ?? null
      },

      unreadCount: 0
    };

    this.upsertRecentChat(updatedChat);
  }

  setSelectedChatUserId(
    userId: number | null
  ): void {

    this.selectedChatUserIdSubject.next(
      userId
    );

    if (
      userId === null ||
      userId === undefined
    ) {

      localStorage.removeItem(
        this.selectedChatStorageKey
      );

      sessionStorage.removeItem(
        this.selectedChatStorageKey
      );

      return;
    }

    localStorage.setItem(
      this.selectedChatStorageKey,
      String(userId)
    );

    sessionStorage.setItem(
      this.selectedChatStorageKey,
      String(userId)
    );
  }

  getSelectedChatUserIdSnapshot():
    number | null {

    return this.selectedChatUserIdSubject.value;
  }

  addDraftChat(chat: RecentChat): void {

    const normalized =
      this.normalizeRecentChat(chat);

    if (
      !this.draftChats.some(
        d =>
          d.user.userId ===
          normalized.user.userId
      )
    ) {

      this.draftChats.push(normalized);

      this.persistChats(
        this.draftChatsStorageKey,
        this.draftChats
      );
    }
  }

  getDraftChats(): RecentChat[] {
    return [...this.draftChats];
  }

  setRecentChats(chats: RecentChat[]): void {

    const normalized =
      Array.isArray(chats)
        ? chats.map(chat =>
            this.normalizeRecentChat(chat)
          )
        : [];

    this.recentChatsSubject.next(
      normalized
    );

    this.refreshUnreadCount();

    this.persistChats(
      this.recentChatsStorageKey,
      normalized
    );
  }

  getRecentChatsSnapshot():
    RecentChat[] {

    return [
      ...this.recentChatsSubject.value
    ];
  }

  clearState(): void {

    this.draftChats = [];

    this.recentChatsSubject.next([]);

    this.unreadCountSubject.next(0);

    this.selectedChatUserIdSubject.next(
      null
    );

    localStorage.removeItem(
      this.recentChatsStorageKey
    );

    sessionStorage.removeItem(
      this.recentChatsStorageKey
    );

    localStorage.removeItem(
      this.draftChatsStorageKey
    );

    sessionStorage.removeItem(
      this.draftChatsStorageKey
    );

    localStorage.removeItem(
      this.selectedChatStorageKey
    );

    sessionStorage.removeItem(
      this.selectedChatStorageKey
    );
  }

  restorePersistedState(): void {
    this.restoreStateFromStorage();
  }

  // ✅ GET RECENT CHATS
  getRecentChats(
    userId: number
  ): Observable<RecentChat[]> {

    return this.http.get<RecentChat[]>(
      `${this.apiUrl}/recent/${userId}`
    ).pipe(

      tap(chats => {

        console.log(
          'Recent chats loaded:',
          chats
        );

        this.setRecentChats(chats || []);

      })

    );
  }

  // ✅ GET HISTORY
  getMessages(
    senderId: number,
    receiverId: number
  ): Observable<any[]> {

    return this.http.get<any[]>(
      `${this.apiUrl}/direct?senderId=${senderId}&receiverId=${receiverId}`
    );
  }

  // ✅ SEND MESSAGE
  sendMessage(message: any): Observable<any> {

    return this.http.post<any>(
      `${this.apiUrl}`,
      message
    );
  }

  sendDirectMessage(payload: {
    senderId: number;
    receiverId: number;
    content: string;
    messageType?: 'TEXT' | 'IMAGE';
    mediaUrl?: string | null;
  }): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/direct`,
      {
        senderId: payload.senderId,
        receiverId: payload.receiverId,
        content: payload.content,
        messageType: payload.messageType || (payload.mediaUrl ? 'IMAGE' : 'TEXT'),
        mediaUrl: payload.mediaUrl ?? null
      }
    );
  }
}