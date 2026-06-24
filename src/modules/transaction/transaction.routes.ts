import { Router } from 'express';
import { protect, restrictTo } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as transactionController from './transaction.controller.js';
import {
  adminAdjustmentSchema,
  adminTransactionQuerySchema,
  transactionQuerySchema,
} from './transaction.schema.js';

const router = Router();

// All transaction routes require authentication
router.use(protect);

// User-facing (read-only)

router
  .route('/')
  .get(
    validate({ query: transactionQuerySchema }),
    transactionController.getWalletHistory,
  );

router.route('/balance').get(transactionController.getWalletBalance);

// Admin-only

router
  .route('/admin')
  .get(
    restrictTo('admin'),
    validate({ query: adminTransactionQuerySchema }),
    transactionController.getAllTransactionsAdmin,
  )
  .post(
    restrictTo('admin'),
    validate({ body: adminAdjustmentSchema }),
    transactionController.adminAdjustment,
  );

export { router as transactionRouter };
