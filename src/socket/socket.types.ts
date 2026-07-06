export const SOCKET_EVENTS = {
  NOTIFICATION_NEW: 'notification:new',
  MESSAGE_NEW: 'message:new',
  MESSAGE_READ: 'message:read',
  TYPING_START: 'typing:start',
  TYPING_STOP: 'typing:stop',
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

export interface AttachmentPayload {
  url: string;
  publicId: string;
  fileName: string;
  fileSize: number;
  fileType: 'image' | 'document' | 'archive' | 'other';
}

export interface MessagePayload {
  _id: string;
  conversation?: string;
  booking?: string;
  sender: string;
  body?: string;
  attachments?: AttachmentPayload[];
  isRead: boolean;
  referenceType?: string;
  reference?: { _id: string; title: string };
  createdAt: string;
}

export interface ReadReceiptPayload {
  conversation?: string;
  booking?: string;
  readBy: string;
}

export interface TypingPayload {
  conversation?: string;
  booking?: string;
  recipientId: string;
  userId?: string; // stamped by server before forwarding
}
