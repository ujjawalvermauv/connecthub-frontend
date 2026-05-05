import { User } from './user.model';

export type RoomType = 'PUBLIC' | 'PRIVATE' | 'DIRECT';
export type MemberRole = 'ADMIN' | 'MODERATOR' | 'MEMBER';

export interface ChatRoom {
  roomId: number;
  roomName: string;
  description?: string;
  roomType: RoomType;
  avatarUrl?: string;
  createdBy: number;
  createdAt: Date;
  isActive: boolean;
  maxMembers: number;
  memberCount?: number;
}

export interface RoomMember {
  memberId: number;
  roomId: number;
  userId: number;
  role: MemberRole;
  joinedAt: Date;
  isActive: boolean;
  user?: User;
}
