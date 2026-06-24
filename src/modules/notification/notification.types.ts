export enum NotificationType {
  // Booking lifecycle
  BOOKING_REQUEST = 'BOOKING_REQUEST',
  BOOKING_ACCEPTED = 'BOOKING_ACCEPTED',
  BOOKING_DECLINED = 'BOOKING_DECLINED',
  BOOKING_CANCELLED = 'BOOKING_CANCELLED',
  BOOKING_COMPLETED = 'BOOKING_COMPLETED',

  // Credits
  CREDITS_RELEASED = 'CREDITS_RELEASED',
  CREDITS_REFUNDED = 'CREDITS_REFUNDED',
  CREDITS_WELCOME_BONUS = 'CREDITS_WELCOME_BONUS',
  CREDITS_ADMIN_ADJUSTMENT = 'CREDITS_ADMIN_ADJUSTMENT',

  // Reviews
  NEW_REVIEW = 'NEW_REVIEW',

  // AI
  AI_MATCH = 'AI_MATCH',
}

export type RelatedEntityType =
  | 'Booking'
  | 'SkillListing'
  | 'ServiceRequest'
  | 'Review'
  | 'Match';

export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  relatedId?: string;
  relatedType?: RelatedEntityType;
}
