export type AdminActionType =
  | 'suspend'
  | 'unsuspend'
  | 'delete'
  | 'credit_adjust'
  | 'resolve_dispute'
  | 'create_category'
  | 'update_category'
  | 'delete_category'
  | 'send_notification';

export type AdminActionTargetModel =
  | 'User'
  | 'Category'
  | 'Booking'
  | 'Transaction'
  | 'Notification';

export interface LogAdminActionParams {
  adminId: string;
  action: AdminActionType;
  targetId?: string;
  targetModel?: AdminActionTargetModel;
  details?: Record<string, unknown>;
}