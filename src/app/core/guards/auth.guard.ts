import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(): boolean | UrlTree | Observable<boolean | UrlTree> {
    if (this.auth.isAuthenticated) {
      return true;
    }

    // If not authenticated, try to restore session from storage
    if (this.auth.hasValidToken()) {
      // Token exists, session should have been restored by AuthService constructor
      // Return true to allow the navigation
      return true;
    }

    // No authentication state available - redirect to login
    return this.router.parseUrl('/login');
  }
}
