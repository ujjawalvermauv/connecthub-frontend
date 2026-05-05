import { User } from './user.model';

export type MessageType = 'TEXT' | 'IMAGE' | 'FILE' | 'AUDIO';

export interface Message {
  messageId: number;
  senderId: number;
  receiverId?: number;
  roomId?: number;
  content: string;
  messageType: MessageType;
  isRead: boolean;
  isDeleted: boolean;
  isEdited: boolean;
  sentAt: Date;
  readAt?: Date;
  editedAt?: Date;
  mediaUrl?: string;
  replyToMessageId?: number;
  sender?: User;
}

export interface SendMessageRequest {
  receiverId?: number;
  roomId?: number;
  content: string;
  messageType: MessageType;
  mediaUrl?: string;
}
