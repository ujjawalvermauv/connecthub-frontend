import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RoomService, ChatRoom } from '../../../core/services/room.service';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';

import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-rooms',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, MatButtonModule, MatIconModule, MatCardModule],
  templateUrl: './rooms.component.html',
  styleUrls: ['./rooms.component.scss']
})
export class RoomsComponent implements OnInit {
  rooms: ChatRoom[] = [];
  loading = false;
  
  showCreateModal = false;
  newRoom: { name: string; description: string; type: 'PUBLIC' | 'PRIVATE' } = { name: '', description: '', type: 'PUBLIC' };

  constructor(private roomService: RoomService) {}

  ngOnInit(): void {
    this.loadRooms();
  }

  loadRooms(): void {
    this.loading = true;
    this.roomService.getRooms().subscribe({
      next: (data) => {
        this.rooms = data;
        this.loading = false;
      },
      error: () => {
        // Fallback for demo if API fails
        this.rooms = [
          { id: 1, name: 'General', description: 'General discussion', memberCount: 150, type: 'PUBLIC', lastActive: '2m ago' },
          { id: 2, name: 'Dev Team', description: 'Technical discussions', memberCount: 12, type: 'PRIVATE', lastActive: '1h ago' },
          { id: 3, name: 'Random', description: 'Anything goes', memberCount: 89, type: 'PUBLIC', lastActive: '12m ago' }
        ];
        this.loading = false;
      }
    });
  }

  joinRoom(roomId: number): void {
    this.roomService.joinRoom(roomId).subscribe(() => {
      alert('You have successfully joined the community!');
      this.loadRooms();
    });
  }

  viewRoom(roomId: number): void {
    alert('Entering community view for ID: ' + roomId);
    // Future: this.router.navigate(['/rooms', roomId]);
  }

  createRoom(): void {
    this.showCreateModal = true;
    this.newRoom = { name: '', description: '', type: 'PUBLIC' };
  }

  submitCreateRoom(): void {
    if (!this.newRoom.name) return;
    
    this.roomService.createRoom(this.newRoom as Partial<ChatRoom>).subscribe({
      next: () => {
        this.loadRooms();
        this.showCreateModal = false;
      },
      error: (err) => alert('Failed to create community: ' + err.message)
    });
  }
}
