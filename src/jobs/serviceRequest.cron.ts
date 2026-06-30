/* eslint-disable no-console */
/**
 * Service request expiration cron job.
 *
 * Runs every hour and marks open service requests as expired after their
 * deadline passes.
 */

import cron from 'node-cron';
import { ServiceRequest } from '../models/serviceRequest.model.js';

let isRunning = false;

async function runServiceRequestExpiration(): Promise<void> {
  if (isRunning) {
    console.warn(
      '[ServiceRequestCron] Previous execution is still running. Skipping this cycle.',
    );
    return;
  }

  isRunning = true;

  try {
    const result = await ServiceRequest.updateMany(
      {
        status: 'open',
        deadline: { $lte: new Date() },
      },
      { $set: { status: 'expired' } },
    );

    if (result.modifiedCount > 0) {
      console.log(
        `[ServiceRequestCron] Marked ${result.modifiedCount} service request(s) as expired.`,
      );
    }
  } catch (err) {
    console.error(
      '[ServiceRequestCron] Failed to expire service requests:',
      err,
    );
  } finally {
    isRunning = false;
  }
}

export function startServiceRequestCron(): void {
  console.log('[ServiceRequestCron] Expiration job initialized.');

  void runServiceRequestExpiration();

  cron.schedule('0 * * * *', () => {
    console.log(
      '[ServiceRequestCron] Executing scheduled hourly expiration check...',
    );
    void runServiceRequestExpiration();
  });
}
