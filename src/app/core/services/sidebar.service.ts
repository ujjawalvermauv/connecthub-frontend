import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SidebarService {
  private sidebarOpenSubject = new BehaviorSubject<boolean>(true);
  sidebarOpen$ = this.sidebarOpenSubject.asObservable();

  toggle(): void {
    const newState = !this.sidebarOpenSubject.value;
    console.log('Toggling sidebar to:', newState);
    this.sidebarOpenSubject.next(newState);
  }

  setOpen(open: boolean): void {
    this.sidebarOpenSubject.next(open);
  }

  get isOpen(): boolean {
    return this.sidebarOpenSubject.value;
  }
}
