import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { AuthResponse } from '../../../core/models/user.model';

@Component({
  selector: 'app-auth-callback',
  templateUrl: './callback.component.html',
  styleUrls: ['./callback.component.scss']
})
export class CallbackComponent implements OnInit {
  constructor(
    private auth: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const hash = window.location.hash || '';
    const fragment = hash.startsWith('#') ? hash.substring(1) : hash;
    const params = new URLSearchParams(fragment);
    const token = params.get('token');
    const refreshToken = params.get('refreshToken') || params.get('refresh_token') || '';

    if (!token) {
      this.router.navigate(['/login']);
      return;
    }

    let payload: any = {};
    try {
      const parts = token.split('.');
      if (parts.length > 1) payload = JSON.parse(atob(parts[1]));
    } catch {
      payload = {};
    }

    const userIdRaw = payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] || payload['sub'] || payload['nameid'] || '0';
    const userName = payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] || payload['name'] || payload['unique_name'] || '';
    const userId = parseInt(userIdRaw as string, 10) || 0;

    const auth: AuthResponse = {
      token,
      refreshToken,
      userId,
      userName: userName || '',
      displayName: payload['name'] || userName || '',
      avatarUrl: ''
    };

    this.auth.setSession(auth);
    this.router.navigate(['/dashboard']);
  }
}
