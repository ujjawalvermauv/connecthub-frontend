import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ChatRoom {
  id: number;
  name: string;
  description?: string;
  memberCount: number;
  type: 'PUBLIC' | 'PRIVATE';
  lastActive?: string;
}

@Injectable({
  providedIn: 'root'
})
export class RoomService {

  private apiUrl = environment.apiBaseUrl ? `${environment.apiBaseUrl}/api/rooms` : '/api/rooms';

  constructor(private http: HttpClient) {}

  getRooms(): Observable<ChatRoom[]> {
    return this.http.get<ChatRoom[]>(this.apiUrl);
  }

  getUserRooms(): Observable<ChatRoom[]> {
    // For now, returning all rooms as a placeholder for user's rooms
    return this.http.get<ChatRoom[]>(this.apiUrl);
  }

  getRoomById(id: number): Observable<ChatRoom> {
    return this.http.get<ChatRoom>(`${this.apiUrl}/${id}`);
  }

  createRoom(room: Partial<ChatRoom>): Observable<ChatRoom> {
    return this.http.post<ChatRoom>(this.apiUrl, room);
  }

  joinRoom(roomId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${roomId}/join`, {});
  }
}