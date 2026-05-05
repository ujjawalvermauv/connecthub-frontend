import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDividerModule } from '@angular/material/divider';
import { RouterModule } from '@angular/router';
import { ChatHubService } from '../../core/services/chat-hub.service';
import { AuthService } from '../../core/services/auth.service';
import { HubConnectionState } from '@microsoft/signalr';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatFormFieldModule,
    MatInputModule,
    MatDividerModule
  ],
  templateUrl: './shell.component.html',
  styleUrls: ['./shell.component.scss']
})
export class ShellComponent {
  get connectionState$() {
    return this.chatHubService.connectionState$;
  }
  HubConnectionState = HubConnectionState; // expose enum for template

  constructor(
    private chatHubService: ChatHubService,
    private authService: AuthService
  ) {}

  logout(): void {
    this.authService.logout();
  }
}
