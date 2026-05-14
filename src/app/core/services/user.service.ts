import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UserService {

  private apiUrl = environment.apiBaseUrl ? `${environment.apiBaseUrl}/api/users` : '/api/users';

  constructor(private http: HttpClient) {}

  // In a real app, this might be a search or a list of friends
  // For now, let's assume there's a search endpoint or just a demo list
  searchUsers(query: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/search?query=${query}`);
  }

  // Get all users for the sidebar in DM
  getAllUsers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}`);
  }
}
