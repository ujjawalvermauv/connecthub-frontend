import { Component } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { SidebarService } from './core/services/sidebar.service';
import { Location } from '@angular/common';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  standalone: false,
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'connecthub-frontend';
  showGlobalSidebar = false;

  constructor(
    private router: Router, 
    private sidebarService: SidebarService,
    private location: Location
  ) {
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe((e: any) => {
      const url: string = e.urlAfterRedirects || e.url || '';
      const excluded = ['/login', '/register'];
      this.showGlobalSidebar = !excluded.some(path => url.startsWith(path));
    });
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
