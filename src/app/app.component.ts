import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { SidebarService } from './core/services/sidebar.service';
import { Location } from '@angular/common';
import { Subscription } from 'rxjs';
import { ChatHubService } from './core/services/chat-hub.service';
import { AuthService } from './core/services/auth.service';
import { MessageService } from './core/services/message.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  standalone: false,
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'connecthub-frontend';
  showGlobalSidebar = false;
  private subscriptions = new Subscription();
  private receiveMessageHandler = (message: any) => {
    if (this.router.url.startsWith('/messages')) {
      return;
    }

    const currentUser = this.authService.currentUserValue;
    if (!currentUser?.userId) {
      return;
    }

    this.messageService.handleIncomingMessage(message, currentUser.userId);
  };

  constructor(
    private router: Router, 
    private sidebarService: SidebarService,
    private location: Location,
    private chatHubService: ChatHubService,
    private authService: AuthService,
    private messageService: MessageService
  ) {
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe((e: any) => {
      const url: string = e.urlAfterRedirects || e.url || '';
      const excluded = ['/login', '/register'];
      this.showGlobalSidebar = !excluded.some(path => url.startsWith(path));
    });
  }

  ngOnInit(): void {
    this.subscriptions.add(this.authService.currentUser$.subscribe(user => {
      if (!user?.userId) {
        this.chatHubService.off('ReceiveMessage', this.receiveMessageHandler);
        return;
      }

      this.chatHubService.on('ReceiveMessage', this.receiveMessageHandler);
    }));
  }

  ngOnDestroy(): void {
    this.chatHubService.off('ReceiveMessage', this.receiveMessageHandler);
    this.subscriptions.unsubscribe();
  }

  toggleSidebar(): void {
    this.sidebarService.setOpen(true);
  }

  goBack(): void {
    this.location.back();
  }

  showBackButton(): boolean {
    const url = this.router.url;
    // Show back button if NOT on primary dashboard/messenger roots
    return !['/dashboard', '/messages', '/login', '/register', '/'].includes(url);
  }
}
