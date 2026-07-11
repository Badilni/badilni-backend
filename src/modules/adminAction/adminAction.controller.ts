import { asyncHandler } from '../../utils/asyncHandler.js';
import * as adminActionService from './adminAction.service.js';
import { AdminActionQuery } from './adminAction.schema.js';

export const getAllAdminActions = asyncHandler(async (req, res) => {
  const result = await adminActionService.getAllAdminActions(
    req.query as unknown as AdminActionQuery,
  );

  res.status(200).json({
    status: 'success',
    pagination: result.pagination,
    data: { logs: result.logs },
  });
});
