export type NotificationType = 'MESSAGE' | 'MENTION' | 'ROOM_INVITE' | 'ROLE_CHANGE' | 'PLATFORM';

export interface Notification {
  notificationId: number;
  recipientId: number;
  senderId?: number;
  type: NotificationType;
  title: string;
  message: string;
  relatedId?: number;
  relatedType?: string;
  isRead: boolean;
  sentAt: Date;
}
