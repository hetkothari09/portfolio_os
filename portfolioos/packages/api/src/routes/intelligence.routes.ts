import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { asyncHandler } from '../middleware/validate.js';
import {
  getHealthScore,
  getNetWorthHistoryHandler,
  triggerNetWorthSnapshotHandler,
} from '../controllers/intelligence.controller.js';

export const intelligenceRouter = Router();
intelligenceRouter.use(authenticate);

intelligenceRouter.get('/health-score', asyncHandler(getHealthScore));
intelligenceRouter.get('/net-worth/history', asyncHandler(getNetWorthHistoryHandler));
// Manual trigger — lets QA/backfill create a snapshot without waiting for
// the 23:45 IST cron (spec §Goal 2).
intelligenceRouter.post('/net-worth/snapshot', asyncHandler(triggerNetWorthSnapshotHandler));
