import { AdminAction } from '../../models/adminAction.model.js';
import { LogAdminActionParams } from './adminAction.types.js';
import { AuditLogQuery } from './adminAction.schema.js';

// Called by every other admin-facing module - mirrors notificationService's
// create() pattern: this is fire-and-forget and must never fail the caller.
export const logAction = async (params: LogAdminActionParams): Promise<void> => {
  try {
    await AdminAction.create({
      admin: params.adminId,
      action: params.action,
      targetId: params.targetId ?? null,
      targetModel: params.targetModel ?? null,
      details: params.details ?? null,
    });
  } catch (err) {
    // Log but never propagate - a failed audit log entry must not fail the caller
    console.error('[AdminActionService] Failed to record admin action:', err);
  }
};

export const getAuditLog = async (query: AuditLogQuery) => {
  const { page, limit, action, admin, targetId } = query;
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};
  if (action) {
    filter.action = action;
  }
  if (admin) {
    filter.admin = admin;
  }
  if (targetId) {
    filter.targetId = targetId;
  }

  const [logs, total] = await Promise.all([
    AdminAction.find(filter)
      .populate('admin', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    AdminAction.countDocuments(filter),
  ]);

  return {
    logs,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  };
};
