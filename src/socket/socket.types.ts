export const SOCKET_EVENTS = {
  // Server → Client
  NOTIFICATION_NEW: 'notification:new',
  MESSAGE_NEW: 'message:new',

  // Client → Server
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
} as const;

export type SocketEvent = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];

export interface NotificationPayload {
  _id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  relatedId?: string;
  relatedType?: string;
  createdAt: string;
}
