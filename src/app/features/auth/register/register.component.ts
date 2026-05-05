import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { RouterModule } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { Router } from '@angular/router';

function passwordMatchValidator(control: AbstractControl) {
  const password = control.get('password');
  const confirm = control.get('confirmPassword');
  return password && confirm && password.value === confirm.value ? null : { mismatch: true };
}

@Component({
  selector: 'app-register',
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
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent {
  registerForm: FormGroup;
  loading = false;
  error: string | null = null;
  showPassword = false;
  showConfirmPassword = false;
  passwordStrength: 'weak' | 'fair' | 'strong' = 'weak';
  passwordStrengthLabel = '';

  constructor(private fb: FormBuilder, private authService: AuthService, private router: Router) {
    this.registerForm = this.fb.group({
      userName: ['', Validators.required],
      displayName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required]
    }, { validators: passwordMatchValidator });
  }

  onPasswordInput() {
    const value = this.registerForm.get('password')?.value || '';
    let classes = 0;
    if (/[a-z]/.test(value)) classes++;
    if (/[A-Z]/.test(value)) classes++;
    if (/\d/.test(value)) classes++;
    if (/[^A-Za-z0-9]/.test(value)) classes++;
    if (value.length >= 8 && classes >= 3) {
      this.passwordStrength = 'strong';
      this.passwordStrengthLabel = 'Strong';
    } else if (classes >= 2) {
      this.passwordStrength = 'fair';
      this.passwordStrengthLabel = 'Fair';
    } else if (value.length > 0) {
      this.passwordStrength = 'weak';
      this.passwordStrengthLabel = 'Weak';
    } else {
      this.passwordStrength = 'weak';
      this.passwordStrengthLabel = '';
    }
  }

  onSubmit() {
    if (this.registerForm.invalid) return;
    this.loading = true;
    this.error = null;
    const { confirmPassword, ...data } = this.registerForm.value;
    const normalizedData = {
      ...data,
      userName: String(data.userName || '').trim(),
      displayName: String(data.displayName || '').trim(),
      email: String(data.email || '').trim().toLowerCase(),
      password: String(data.password || '')
    };

    this.authService.register(normalizedData).subscribe({
      next: () => {
        this.authService.login({
          email: normalizedData.email,
          password: normalizedData.password
        }).subscribe({
          next: () => {
            this.loading = false;
            this.router.navigate(['/dashboard']);
          },
          error: () => {
            this.loading = false;
            this.router.navigate(['/login'], {
              queryParams: { registered: 'true', email: normalizedData.email }
            });
          }
        });
      },
      error: err => {
        this.error = err.error?.message || 'Registration failed';
        this.loading = false;
      }
    });
  }
}
