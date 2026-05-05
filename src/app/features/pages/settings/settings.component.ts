import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';

import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MatButtonModule, MatInputModule, MatFormFieldModule, MatDividerModule, MatIconModule],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit {
  user: any = {
    displayName: '',
    email: '',
    userName: '',
    bio: ''
  };
  activeTab = 'profile';
  isDarkMode = false;
  selectedAvatarFile: File | null = null;
  avatarPreviewUrl: string | null = null;

  constructor(private authService: AuthService) {}

  setActiveTab(tab: string): void {
    this.activeTab = tab;
  }

  ngOnInit(): void {
    // 1. Listen to the current user stream
    this.authService.currentUser$.subscribe(u => {
      if (u) {
        this.user = { ...u, bio: u.bio || '' };
      }
    });

    // 2. Force a fresh fetch from the server to "Auto-Repair" missing names/usernames
    this.authService.getProfile().subscribe(u => {
      if (u) {
        this.user = { ...u, bio: u.bio || '' };
      }
    });
  }

  saveProfile(): void {
    if (!this.user.userId) return;
    
    // 1. Update text profile
    this.authService.updateProfile(this.user.userId, this.user).subscribe({
      next: () => {
        // 2. If we have a pending avatar, upload it
        if (this.selectedAvatarFile) {
          this.authService.uploadAvatar(this.user.userId, this.selectedAvatarFile).subscribe({
            next: (res) => {
              this.user.avatarUrl = res.url;
              this.selectedAvatarFile = null;
              this.avatarPreviewUrl = null;
              alert('Profile updated successfully!');
            },
            error: (err) => {
              console.error('Avatar upload failed', err);
              alert('Profile saved, but avatar upload failed.');
            }
          });
        } else {
          alert('Profile updated successfully!');
        }
      },
      error: (err) => {
        console.error('Failed to update profile', err);
        alert('Error updating profile. Please try again.');
      }
    });
  }

  onAvatarSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.selectedAvatarFile = file;
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.avatarPreviewUrl = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  logout(): void {
    this.authService.logout();
  }

  removeAvatar(): void {
    if (!this.user.userId) return;
    
    // Clear any pending local preview
    this.selectedAvatarFile = null;
    this.avatarPreviewUrl = null;

    if (confirm('Are you sure you want to remove your profile picture?')) {
      this.authService.removeAvatar(this.user.userId).subscribe({
        next: () => {
          this.user.avatarUrl = null;
          alert('Profile picture removed successfully!');
        },
        error: (err) => {
          console.error('Failed to remove avatar', err);
          alert('Error removing avatar.');
        }
      });
    }
  }

  toggleDarkMode(): void {
    this.isDarkMode = !this.isDarkMode;
    if (this.isDarkMode) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
    localStorage.setItem('theme', this.isDarkMode ? 'dark' : 'light');
  }
}
