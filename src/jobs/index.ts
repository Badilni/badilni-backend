import cron from 'node-cron';

import * as bookingService from '../modules/booking/booking.service.js';
import * as matchService from '../modules/match/match.service.js';

// Runs the AI matchmaker every 6 hours (see Badilni plan §6.6).
const MATCHMAKER_CRON = '0 */6 * * *';

// Auto-resolves bookings stuck unconfirmed past their 48h window, favouring
// the provider, checked hourly (see Badilni plan §6.3).
const AUTO_RESOLVE_CRON = '0 * * * *';

export const registerJobs = () => {
  cron.schedule(MATCHMAKER_CRON, async () => {
    try {
      const createdCount = await matchService.runMatchmaker();
      console.log(`[matchmaker] created/updated ${createdCount} match suggestions`);
    } catch (err) {
      console.error('[matchmaker] job failed:', err);
    }
  });

  cron.schedule(AUTO_RESOLVE_CRON, async () => {
    try {
      const resolvedCount = await bookingService.autoResolveStaleBookings();
      console.log(`[booking-auto-resolve] resolved ${resolvedCount} stale bookings`);
    } catch (err) {
      console.error('[booking-auto-resolve] job failed:', err);
    }
  });
};