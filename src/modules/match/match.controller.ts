import { asyncHandler } from '../../utils/asyncHandler.js';
import * as matchService from './match.service.js';
import { MatchParams, MatchQuery } from './match.schema.js';

export const getMyMatches = asyncHandler(async (req, res, _next) => {
  const { matches, pagination } = await matchService.getMyMatches(
    req.user!.id,
    req.query as unknown as MatchQuery,
  );

  res.status(200).json({
    status: 'success',
    pagination,
    data: { matches },
  });
});

export const getMatch = asyncHandler(async (req, res, _next) => {
  const match = await matchService.getMatch(
    (req.params as MatchParams).id,
    req.user!.id,
  );

  res.status(200).json({ status: 'success', data: { match } });
});
