import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuthResponse, LoginRequest, RegisterRequest, User } from '../models/user.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private apiUrl = environment.apiBaseUrl;

  private token: string | null = null;
  private refreshTokenValue: string | null = null;

  // 🔥 STATE
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  currentUser$ = this.currentUserSubject.asObservable();

  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    this.restoreSession(); // 🔥 IMPORTANT
  }

  // ================= LOGIN =================
  login(req: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(
      `${this.apiUrl}/api/users/login`,
      req
    ).pipe(
      tap(auth => this.setSession(auth))
    );
  }

  // ================= REGISTER =================
  register(req: RegisterRequest): Observable<User> {
    return this.http.post<User>(
      `${this.apiUrl}/api/users/register`,
      req
    );
  }

  // ================= LOGOUT =================
  logout(): void {
    this.token = null;
    this.refreshTokenValue = null;

    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);

    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_refresh');

    this.router.navigate(['/login']);

    this.http.post(`${this.apiUrl}/api/users/logout`, {}).subscribe();
  }

  // ================= REFRESH =================
  refreshToken(): Observable<AuthResponse> {
    if (!this.refreshTokenValue) {
      return of({} as AuthResponse);
    }

    return this.http.post<AuthResponse>(
      `${this.apiUrl}/api/users/refresh`,
      { refreshToken: this.refreshTokenValue }
    ).pipe(
      tap(auth => this.setSession(auth))
    );
  }

  // ================= SET SESSION =================
  private setSession(auth: AuthResponse): void {
    this.token = auth.token;
    this.refreshTokenValue = auth.refreshToken;

    this.isAuthenticatedSubject.next(true);

    // Save tokens
    localStorage.setItem('auth_token', auth.token);
    localStorage.setItem('auth_refresh', auth.refreshToken || '');

    const email = this.extractEmailFromToken(auth.token);

    // 🔥 FALLBACK LOGIC (MAIN FIX)
    const displayName =
      auth.displayName ||
      auth.userName ||
      (email ? email.split('@')[0] : '') ||
      'User';

    this.currentUserSubject.next({
      userId: auth.userId,
      userName: auth.userName,
      displayName: displayName,
      avatarUrl: auth.avatarUrl || '',
      email: email,
      isOnline: true,
      isActive: true
    });
  }

  // ================= RESTORE SESSION =================
  private restoreSession(): void {
    try {
      const token = localStorage.getItem('auth_token');
      const refresh = localStorage.getItem('auth_refresh');

      if (!token) return;

      this.token = token;
      this.refreshTokenValue = refresh;
      this.isAuthenticatedSubject.next(true);

      const payload = JSON.parse(atob(token.split('.')[1]));
      const email = this.extractEmailFromToken(token);

      const displayName =
        payload.name ||
        payload.unique_name ||
        (email ? email.split('@')[0] : '') ||
        'User';

      this.currentUserSubject.next({
        userId: payload.sub || payload.nameid || 0,
        userName: payload.unique_name || payload.name || '',
        displayName: displayName,
        email: email,
        avatarUrl: '',
        isOnline: true,
        isActive: true
      });

    } catch {
      this.logout();
    }
  }

  // ================= HELPERS =================
  private extractEmailFromToken(token: string): string {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return (
        payload.email ||
        payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] ||
        ''
      );
    } catch {
      return '';
    }
  }

  getToken(): string | null {
    return this.token;
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  getCurrentUserId(): number | null {
    return this.currentUserSubject.value?.userId ?? null;
  }

  isTokenExpired(): boolean {
    if (!this.token) return true;

    try {
      const payload = JSON.parse(atob(this.token.split('.')[1]));
      return payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }

  // ================= PROFILE =================
  getProfile(userId: number): Observable<User> {
    return this.http.get<User>(
      `${this.apiUrl}/api/users/${userId}`
    );
  }

  updateProfile(data: Partial<User>): Observable<User> {
    return this.http.put<User>(
      `${this.apiUrl}/api/users/profile`,
      data
    );
  }

  // ================= GOOGLE =================
  googleLogin(): void {
    window.location.href = `${this.apiUrl}/api/auth/google`;
  }
}