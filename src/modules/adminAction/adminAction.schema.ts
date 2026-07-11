import { z } from 'zod';
import { objectIdSchema, paginationSchema } from '../../utils/common.schema.js';
import { AdminActionType } from './adminAction.types.js';

const adminActionTypes = [
  'suspend',
  'unsuspend',
  'delete',
  'credit_adjust',
  'resolve_dispute',
  'create_category',
  'update_category',
  'delete_category',
  'send_notification',
] as const satisfies readonly AdminActionType[];

export const adminActionQuerySchema = paginationSchema
  .pick({ page: true, limit: true })
  .extend({
    action: z.enum(adminActionTypes).optional(),
    admin: objectIdSchema.optional(),
    targetId: objectIdSchema.optional(),
  });

export type AdminActionQuery = z.infer<typeof adminActionQuerySchema>;
