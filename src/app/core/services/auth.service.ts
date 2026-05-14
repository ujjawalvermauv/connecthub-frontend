import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { switchMap, tap, map } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { User } from '../models/user.model';
import { MessageService } from './message.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private apiUrl = environment.apiBaseUrl ? `${environment.apiBaseUrl}/api/users` : '/api/users';

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  currentUser$ = this.currentUserSubject.asObservable();

  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  constructor(private http: HttpClient, private router: Router, private messageService: MessageService) {
    this.restoreSession();
    // Expose dev helper to manually inject token in non-production
    try {
      if (!environment.production) {
        (window as any).devSetToken = (token: string, persist = false) => this.setToken(token, persist);
        (window as any).devClearAuth = () => this.clearToken();
        console.log('[AuthService] dev helpers attached: devSetToken(), devClearAuth()');
      }
    } catch {}
  }

  get isAuthenticated(): boolean {
    return this.isAuthenticatedSubject.value;
  }

  get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  getToken(): string | null {
    // Prefer sessionStorage for current session; fall back to localStorage for persisted logins
    const session = sessionStorage.getItem('token');
    if (session) return session;
    return localStorage.getItem('token');
  }

  // Returns true if there is a token and it's not expired (if exp claim present)
  hasValidToken(): boolean {
    const token = this.getToken();
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload && payload.exp) {
        const now = Math.floor(Date.now() / 1000);
        return now < Number(payload.exp);
      }
      return true;
    } catch (e) {
      return false;
    }
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
    const savedUser = sessionStorage.getItem('currentUser') || localStorage.getItem('currentUser');
    const token = this.getToken() || localStorage.getItem('token');

    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser) as Partial<User>;
        if (token) {
          // Ensure token is available in sessionStorage for immediate SignalR access
          try { sessionStorage.setItem('token', token); } catch {}
          console.log('[AuthService] restoreSession: token loaded (from storage) len=', token?.length || 0);
          this.hydrateUserFromToken(parsedUser, token);
        }

        if (parsedUser.userId) {
          this.currentUserSubject.next(parsedUser as User);
          this.isAuthenticatedSubject.next(true);
          return;
        }
      } catch (e) {
        sessionStorage.removeItem('currentUser');
        localStorage.removeItem('currentUser');
      }
    }

    if (token) {
      try {
        const parsedUser = {} as Partial<User>;
        this.hydrateUserFromToken(parsedUser, token);
        if (parsedUser.userId) {
          parsedUser.userName = parsedUser.userName || parsedUser.displayName || parsedUser.email?.split('@')[0] || `user${parsedUser.userId}`;
          parsedUser.displayName = parsedUser.displayName || parsedUser.userName || `User ${parsedUser.userId}`;
          parsedUser.isActive = parsedUser.isActive ?? true;
          parsedUser.isOnline = parsedUser.isOnline ?? true;

          this.currentUserSubject.next(parsedUser as User);
          this.isAuthenticatedSubject.next(true);
          // ensure token placed into session storage for immediate SignalR access
          try { sessionStorage.setItem('token', token); } catch {}
          console.log('[AuthService] restoreSession: session established for user', parsedUser.userId);
        }
      } catch (e) {
        console.warn('[AuthService] restoreSession: failed to restore from token, clearing stored auth', e);
        try { sessionStorage.removeItem('currentUser'); localStorage.removeItem('currentUser'); sessionStorage.removeItem('token'); localStorage.removeItem('token'); } catch {}
      }
    }
  }

  // Persist token into storage and mark authenticated. Use persist=true to save to localStorage.
  setToken(token: string, persist = false): void {
    try {
      sessionStorage.setItem('token', token);
      if (persist) localStorage.setItem('token', token);
    } catch (e) {
      console.warn('[AuthService] setToken: storage failure', e);
    }
    console.log('[AuthService] setToken: persist=', persist, 'len=', token?.length || 0);
    this.isAuthenticatedSubject.next(true);
  }

  clearToken(): void {
    try { sessionStorage.removeItem('token'); localStorage.removeItem('token'); } catch {}
    console.log('[AuthService] clearToken');
    this.isAuthenticatedSubject.next(false);
    this.currentUserSubject.next(null);
  }

  login(credentials: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/login`, credentials).pipe(
      tap(res => this.setSession(res)),
      switchMap(res => {
        if (this.currentUserValue?.userId) {
          return of(res);
        }
        return this.getProfile().pipe(map(() => res));
      })
    );
  }

  googleLogin(idToken: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/google-login`, { idToken }).pipe(
      tap(res => this.setSession(res)),
      switchMap(res => {
        if (this.currentUserValue?.userId) {
          return of(res);
        }
        return this.getProfile().pipe(map(() => res));
      })
    );
  }

  register(userData: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/register`, userData);
  }

  setSession(authResult: any): void {
    if (authResult.token) {
      sessionStorage.setItem('token', authResult.token);
    }
    
    // Extract user info from token or response
    const user = authResult.user || {} as Partial<User>;
    
    // Robustly parse the User info from JWT
    const token = authResult.token || sessionStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        console.log('AuthService: Decoded token payload', payload);
        
        // 1. User ID
        const userId = payload.nameid || payload.sub || payload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"];
        if (userId && (!user.userId || user.userId === 0)) {
          user.userId = parseInt(userId);
        }

        // 2. User name
        const userName = payload.userName || payload.unique_name || payload.name || payload.given_name;
        if (userName && !user.userName) {
          user.userName = userName;
        }

        // 3. Display Name
        const displayName = payload.displayName || userName || payload.name || payload.given_name;
        if (displayName && !user.displayName) {
          user.displayName = displayName;
        }

        // 4. Email
        const email = payload.email || payload.upn || payload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"];
        if (email && !user.email) {
          user.email = email;
        }

        // 5. Avatar (if using Google Login)
        const picture = payload.picture || payload.avatar;
        if (picture && !user.avatarUrl) {
          user.avatarUrl = picture;
        }
      } catch (e) {
        console.error("Failed to parse user info from token", e);
      }
    }

    if (user.userId) {
      user.userName = user.userName || user.displayName || user.email?.split('@')[0] || `user${user.userId}`;
      user.displayName = user.displayName || user.userName || `User ${user.userId}`;
      user.isOnline = true;
      user.isActive = true;

      const normalizedUser = user as User;
      sessionStorage.setItem('currentUser', JSON.stringify(normalizedUser));
      this.currentUserSubject.next(normalizedUser);
      this.isAuthenticatedSubject.next(true);
    }
  }

  private hydrateUserFromToken(user: Partial<User>, token: string): void {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));

      const userId = payload.nameid || payload.sub || payload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"];
      if (userId && (!user.userId || user.userId === 0)) {
        user.userId = parseInt(userId, 10);
      }

      const userName = payload.userName || payload.unique_name || payload.name || payload.given_name;
      if (userName && !user.userName) {
        user.userName = userName;
      }

      const displayName = payload.displayName || userName || payload.name || payload.given_name;
      if (displayName && !user.displayName) {
        user.displayName = displayName;
      }

      const email = payload.email || payload.upn || payload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"];
      if (email && !user.email) {
        user.email = email;
      }

      const picture = payload.picture || payload.avatar;
      if (picture && !user.avatarUrl) {
        user.avatarUrl = picture;
      }
    } catch (error) {
      console.error('Failed to hydrate user from token', error);
    }
  }

  logout(): void {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('currentUser');
    sessionStorage.removeItem('selectedDirectMessageUserId');
    localStorage.removeItem('selectedDirectMessageUserId');
    this.messageService.clearState();
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
      sessionStorage.setItem('currentUser', JSON.stringify(updated));
      localStorage.setItem('currentUser', JSON.stringify(updated));
    }
  }
}