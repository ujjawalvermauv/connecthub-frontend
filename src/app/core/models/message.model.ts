import { User } from './user.model';

export interface Message {
  messageId: number;
  senderId: number;
  receiverId?: number;
  roomId?: number;
  content: string;
  mediaUrl?: string;
  isRead: boolean;
  isDeleted: boolean;
  isEdited: boolean;
  createdAt: Date;
  readAt?: Date;
  editedAt?: Date;
  replyToMessageId?: number;
  sender?: User;
}

export interface SendMessageRequest {
  receiverId?: number;
  roomId?: number;
  content: string;
  mediaUrl?: string;
}
