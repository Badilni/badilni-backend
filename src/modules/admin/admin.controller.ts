import { asyncHandler } from '../../utils/asyncHandler.js';
import * as adminService from './admin.service.js';
import { AuditLogQuery } from './admin.schema.js';

export const getAuditLog = asyncHandler(async (req, res) => {
  const result = await adminService.getAuditLog(
    req.query as unknown as AuditLogQuery,
  );

  res.status(200).json({
    status: 'success',
    pagination: result.pagination,
    data: { logs: result.logs },
  });
});