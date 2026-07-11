/* eslint-disable no-console */
import cron from 'node-cron';

import { Match } from '../models/match.model.js';
import { ServiceRequest } from '../models/serviceRequest.model.js';
import { runMatchmakerForLoadedRequest } from '../modules/match/match.service.js';

const RECENT_MATCH_WINDOW_MS = 24 * 60 * 60 * 1000;
const REQUEST_LIMIT_PER_RUN = 25;

let isRunning = false;

async function runMatchmakerCron(): Promise<number> {
  const cutoff = new Date(Date.now() - RECENT_MATCH_WINDOW_MS);
  const recentlyMatchedRequestIds = await Match.distinct('request', {
    createdAt: { $gte: cutoff },
  });

  // Only retry requests that have not produced a match recently, keeping Gemini usage bounded per run.
  const requests = await ServiceRequest.find({
    status: 'open',
    _id: { $nin: recentlyMatchedRequestIds },
  })
    .populate<{ category: { name: string } }>('category', 'name')
    .limit(REQUEST_LIMIT_PER_RUN);

  let createdCount = 0;

  for (const request of requests) {
    try {
      console.log(
        '---------------------------------------------------------------------',
      );
      console.log(`Run for request ${request.id}`);
      createdCount += await runMatchmakerForLoadedRequest(request);
      console.log(`Count: ${createdCount}`);
      console.log(
        '---------------------------------------------------------------------',
      );
    } catch (err) {
      console.error(
        `[Matchmaker] Failed to process request ${request._id} during cron:`,
        err,
      );
    }
  }

  return createdCount;
}

export function startMatchmakerCron(): void {
  console.log('[Matchmaker] Scheduled matching job initialized.');

  cron.schedule('0 */6 * * *', async () => {
    if (isRunning) {
      console.warn(
        '[Matchmaker] Previous scheduled run is still running. Skipping this cycle.',
      );
      return;
    }

    isRunning = true;
    console.log('[Matchmaker] Starting scheduled run...');

    try {
      const count = await runMatchmakerCron();
      console.log(`[Matchmaker] Done. Created ${count} match(es).`);
    } catch (err) {
      console.error('[Matchmaker] Fatal error:', err);
    } finally {
      isRunning = false;
    }
  });
}
