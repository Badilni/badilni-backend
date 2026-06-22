import { asyncHandler } from '../../utils/asyncHandler.js';
import * as matchService from './match.service.js';
import { MatchParams, MatchQuery } from './match.schema.js';

export const getMyMatches = asyncHandler(async (req, res, _next) => {
  const { docs: matches, pagination } = await matchService.getMyMatches(
    req.user!.id,
    req.query as unknown as MatchQuery,
  );

  res.status(200).json({
    status: 'success',
    pagination,
    data: { matches },
  });
});

export const acceptMatch = asyncHandler(async (req, res, _next) => {
  const match = await matchService.respondToMatch(
    (req.params as MatchParams).id,
    req.user!,
    'accepted',
  );

  res.status(200).json({ status: 'success', data: { match } });
});

export const dismissMatch = asyncHandler(async (req, res, _next) => {
  const match = await matchService.respondToMatch(
    (req.params as MatchParams).id,
    req.user!,
    'dismissed',
  );

  res.status(200).json({ status: 'success', data: { match } });
});

// Admin-only manual trigger, useful for verifying match generation before
// enabling the cron schedule (see Badilni plan §6.10 deployment order).
export const triggerMatchmaker = asyncHandler(async (req, res, _next) => {
  const createdCount = await matchService.runMatchmaker();
  res.status(200).json({ status: 'success', data: { createdCount } });
});
