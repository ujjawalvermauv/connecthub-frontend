import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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
  } | null;
  unreadCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class MessageService {

  private apiUrl = '/api/messages';
  private draftChats: RecentChat[] = [];

  constructor(private http: HttpClient) {}

  addDraftChat(chat: RecentChat): void {
    if (!this.draftChats.some(d => d.user.userId === chat.user.userId)) {
      this.draftChats.push(chat);
    }
  }

  getDraftChats(): RecentChat[] {
    return this.draftChats;
  }

  // ✅ GET RECENT
  getRecentChats(userId: number): Observable<RecentChat[]> {
    return this.http.get<RecentChat[]>(`${this.apiUrl}/recent-chats/${userId}`);
  }

  // ✅ GET HISTORY
  getMessages(senderId: number, receiverId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/direct?senderId=${senderId}&receiverId=${receiverId}`);
  }

  // ✅ SEND (REST fallback or for history)
  sendMessage(message: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}`, message);
  }
}