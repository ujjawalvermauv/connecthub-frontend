import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import jwtDecode from 'jwt-decode';

@Injectable({ providedIn: 'root' })
export class AdminGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(): boolean {
    const token = this.authService.getToken();
    if (token) {
      const decoded: any = jwtDecode(token);
      if (decoded.role === 'Admin') {
        return true;
      }
    }
    this.router.navigate(['/dashboard']);
    return false;
  }
}
