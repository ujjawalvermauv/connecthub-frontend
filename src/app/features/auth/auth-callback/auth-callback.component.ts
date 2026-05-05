import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  template: `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif;">
      <h2 style="color: #2B3674;">Authenticating with Google...</h2>
      <p style="color: #707EAE;">Please wait while we set up your workspace.</p>
      <div class="loader"></div>
    </div>
  `,
  styles: [`
    .loader {
      border: 4px solid #f3f3f3;
      border-top: 4px solid #5D5FEF;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin-top: 20px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `]
})
export class AuthCallbackComponent implements OnInit {
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // The backend redirects to /auth/callback#token=...
    this.route.fragment.subscribe(fragment => {
      if (fragment) {
        const params = new URLSearchParams(fragment);
        const token = params.get('token');
        if (token) {
          // Manually handle session setup
          localStorage.setItem('token', token);
          // Get user details from backend (or decode token)
          // For now, let's just use the profile service to get full user data
          this.authService.getProfile().subscribe({
            next: (user: any) => {
              this.authService.updateCurrentUser(user);
              this.router.navigate(['/dashboard']);
            },
            error: () => {
              this.router.navigate(['/login'], { queryParams: { error: 'callback_failed' } });
            }
          });
        } else {
          this.router.navigate(['/login']);
        }
      }
    });
  }
}
