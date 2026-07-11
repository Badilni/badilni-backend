import { asyncHandler } from '../../utils/asyncHandler.js';
import * as adminActionService from './adminAction.service.js';
import { AuditLogQuery } from './adminAction.schema.js';

export const getAuditLog = asyncHandler(async (req, res) => {
  const result = await adminActionService.getAuditLog(
    req.query as unknown as AuditLogQuery,
  );

  res.status(200).json({
    status: 'success',
    pagination: result.pagination,
    data: { logs: result.logs },
  });
});
