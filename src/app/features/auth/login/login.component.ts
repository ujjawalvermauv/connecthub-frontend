import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { RouterModule, Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { environment } from '../../../../environments/environment';
import { ActivatedRoute } from '@angular/router';

declare var google: any;

import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {

  loginForm: FormGroup;
  loading = false;
  error: string | null = null;
  showPassword = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  ngOnInit(): void {
    const email = this.route.snapshot.queryParamMap.get('email');
    if (email) {
      this.loginForm.patchValue({ email });
    }

    this.initializeGoogleSignIn();
  }

  private initializeGoogleSignIn(): void {
    if (typeof google !== 'undefined') {
      google.accounts.id.initialize({
        client_id: environment.googleClientId,
        callback: this.handleGoogleResponse.bind(this),
        auto_select: false,
        cancel_on_tap_outside: true
      });

      // Render the official Google button
      google.accounts.id.renderButton(
        document.getElementById('googleBtn'),
        { 
          theme: 'outline', 
          size: 'large', 
          width: 350, 
          text: 'signin_with',
          shape: 'rectangular',
          logo_alignment: 'left'
        }
      );
    }
  }

  private handleGoogleResponse(response: any): void {
    if (response.credential) {
      this.loading = true;
      this.error = null;
      this.authService.googleLogin(response.credential).subscribe({
        next: () => {
          this.loading = false;
          this.router.navigate(['/dashboard']);
        },
        error: (err: any) => {
          this.loading = false;
          this.error = 'Google authentication failed. Please try again.';
          console.error('Google Auth Error:', err);
        }
      });
    }
  }

  // UI helpers
  get errorMessage() {
    return this.error;
  }

  get isLoading() {
    return this.loading;
  }

  // ✅ FINAL LOGIN METHOD (fixed)
  onLogin(): void {
    if (this.loginForm.invalid) return;

    this.loading = true;
    this.error = null;

    const payload = {
      email: String(this.loginForm.value.email || '').trim(),
      password: String(this.loginForm.value.password || '')
    };

    this.authService.login(payload).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/dashboard']);
      },
      error: (err: any) => {
        this.loading = false;
        this.error = err?.error?.message || 'Invalid email or password';
      }
    });
  }

  // optional toggle
  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }
}