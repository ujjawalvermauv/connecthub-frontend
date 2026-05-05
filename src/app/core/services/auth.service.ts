import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { tap, map } from 'rxjs/operators';
import { Router } from '@angular/router';
import { User } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private apiUrl = 'http://localhost:5000/api/users';

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  currentUser$ = this.currentUserSubject.asObservable();

  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  constructor(private http: HttpClient, private router: Router) {
    this.restoreSession();
  }

  get isAuthenticated(): boolean {
    return this.isAuthenticatedSubject.value;
  }

  get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  getProfile(): Observable<User | null> {
    return this.http.get<User>(`${this.apiUrl}/profile`).pipe(
      tap(u => {
        // If we got a real user, update the local state
        if (u && u.userId) {
          this.updateCurrentUser(u);
        }
      })
    );
  }

  private restoreSession(): void {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        this.currentUserSubject.next(user);
        this.isAuthenticatedSubject.next(true);
      } catch (e) {
        localStorage.removeItem('currentUser');
      }
    }
  }

  login(credentials: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/login`, credentials).pipe(
      tap(res => this.setSession(res))
    );
  }

  googleLogin(idToken: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/google-login`, { idToken }).pipe(
      tap(res => this.setSession(res))
    );
  }

  register(userData: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/register`, userData);
  }

  setSession(authResult: any): void {
    if (authResult.token) {
      localStorage.setItem('token', authResult.token);
    }
    
    // Extract user info from token or response
    const user: User = authResult.user || {};
    
    // Robustly parse the User info from JWT
    const token = authResult.token || localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        console.log('AuthService: Decoded token payload', payload);
        
        // 1. User ID
        const userId = payload.nameid || payload.sub || payload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"];
        if (userId && (!user.userId || user.userId === 0)) {
          user.userId = parseInt(userId);
        }

        // 2. Display Name
        const name = payload.displayName || payload.unique_name || payload.name || payload.given_name;
        if (name && !user.displayName) {
          user.displayName = name;
        }

        // 3. Email
        const email = payload.email || payload.upn || payload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"];
        if (email && !user.email) {
          user.email = email;
        }

        // 4. Avatar (if using Google Login)
        const picture = payload.picture || payload.avatar;
        if (picture && !user.avatarUrl) {
          user.avatarUrl = picture;
        }

      } catch (e) {
        console.error("Failed to parse user info from token", e);
      }
    }

    if (user.userId) {
      localStorage.setItem('currentUser', JSON.stringify(user));
      this.currentUserSubject.next(user);
      this.isAuthenticatedSubject.next(true);
    }
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
    this.router.navigate(['/login']);
  }

  searchUsers(query: string): Observable<User[]> {
    if (!query || query.trim() === '') {
      return this.getAllUsers();
    }
    return this.http.get<User[]>(`${this.apiUrl}/search?query=${query}`);
  }

  getAllUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/all`);
  }

  updateProfile(userId: number, user: User): Observable<any> {
    return this.http.put(`${this.apiUrl}/update/${userId}`, user).pipe(
      tap((updatedUser: any) => {
        this.updateCurrentUser(updatedUser);
      })
    );
  }

  uploadAvatar(userId: number, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post(`${this.apiUrl}/${userId}/avatar`, formData).pipe(
      tap((res: any) => {
        if (res.url) {
          this.updateCurrentUser({ avatarUrl: res.url });
        }
      })
    );
  }

  removeAvatar(userId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${userId}/avatar`).pipe(
      tap(() => {
        this.updateCurrentUser({ avatarUrl: null });
      })
    );
  }

  updateCurrentUser(updates: Partial<User>): void {
    const current = this.currentUserSubject.value;
    if (current) {
      const updated = { ...current, ...updates };
      this.currentUserSubject.next(updated);
      localStorage.setItem('currentUser', JSON.stringify(updated));
    }
  }
}