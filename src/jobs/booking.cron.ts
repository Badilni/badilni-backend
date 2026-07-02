/* eslint-disable no-console */
/**
 * Booking auto-confirmation cron job.
 *
 * Runs every hour at the top of the hour (e.g., 1:00, 2:00).
 * Finds accepted bookings whose session window
 * (scheduledAt + durationHours + 48h buffer) has elapsed without
 * both parties confirming, then resolves them.
 */

import mongoose from 'mongoose';
import cron from 'node-cron';
import { Booking } from '../models/booking.model.js';
import { BookingStatus } from '../modules/booking/booking.types.js';
import { releaseEscrow } from '../modules/transaction/transaction.service.js';
import {
  notifyBookingCompleted,
  notifyCreditsReleased,
} from '../modules/notification/notification.service.js';
import { ServiceRequest } from '../models/serviceRequest.model.js';
import { User } from '../models/user.model.js';
import { SkillListing } from '../models/skillListing.model.js';

const BUFFER_MS = 48 * 60 * 60 * 1000; // 48 hours in milliseconds
let isRunning = false; // Concurrency lock flag

async function runAutoConfirmation(): Promise<void> {
  if (isRunning) {
    console.warn(
      '[BookingCron] Previous execution is still running. Skipping this cycle.',
    );
    return;
  }

  isRunning = true;
  const now = new Date();

  try {
    // Matches: scheduledAt + (durationHours in ms) + 48 hours < now
    const candidates = await Booking.find({
      status: BookingStatus.ACCEPTED,
      $or: [{ providerConfirmed: false }, { receiverConfirmed: false }],
      $expr: {
        $lt: [
          {
            $add: [
              '$scheduledAt',
              { $multiply: ['$durationHours', 60 * 60 * 1000] },
              BUFFER_MS,
            ],
          },
          now,
        ],
      },
    }).select('_id'); // Only fetch IDs to minimize payload size

    for (const candidate of candidates) {
      // Wrap the entire iteration in a try/catch so one failure doesn't halt the queue
      const session = await mongoose.startSession();
      try {
        const result = await session.withTransaction(async () => {
          // Re-fetch the document fresh inside the transaction loop on every attempt
          const bookingDoc = await Booking.findOne({
            _id: candidate._id,
            status: BookingStatus.ACCEPTED,
          }).session(session);

          // If a concurrent user request already changed the status, skip safely
          if (!bookingDoc) {
            return { executionType: 'skipped' as const, bookingDoc: null };
          }

          const neitherConfirmed =
            !bookingDoc.providerConfirmed && !bookingDoc.receiverConfirmed;

          if (neitherConfirmed) {
            bookingDoc.status = BookingStatus.DISPUTED;
            await bookingDoc.save({ session });
            return { executionType: 'disputed' as const, bookingDoc };
          }

          // One party confirmed - complete and release escrow safely
          bookingDoc.providerConfirmed = true;
          bookingDoc.receiverConfirmed = true;
          bookingDoc.status = BookingStatus.COMPLETED;
          await bookingDoc.save({ session });

          await releaseEscrow(
            bookingDoc._id.toString(),
            bookingDoc.receiver.toString(),
            bookingDoc.provider.toString(),
            bookingDoc.creditsTotal,
            session,
          );

          await User.updateMany(
            { _id: { $in: [bookingDoc.provider, bookingDoc.receiver] } },
            { $inc: { totalSessionsCompleted: 1 } },
            { session },
          );

          if (bookingDoc.listing) {
            await SkillListing.findByIdAndUpdate(
              bookingDoc.listing,
              { $inc: { totalBookings: 1 } },
              { session },
            );
          }

          if (bookingDoc.request) {
            await ServiceRequest.findByIdAndUpdate(
              bookingDoc.request,
              { $set: { status: 'fulfilled' } },
              { session },
            );
          }

          return { executionType: 'completed' as const, bookingDoc };
        });

        const executionType = result?.executionType ?? 'skipped';
        const bookingDoc = result?.bookingDoc;

        // Trigger side effects outside the transaction block based on transaction results
        if (executionType === 'completed' && bookingDoc) {
          notifyBookingCompleted({
            recipientId: bookingDoc.provider.toString(),
            bookingId: bookingDoc._id.toString(),
          });
          notifyBookingCompleted({
            recipientId: bookingDoc.receiver.toString(),
            bookingId: bookingDoc._id.toString(),
          });
          notifyCreditsReleased({
            providerId: bookingDoc.provider.toString(),
            amount: bookingDoc.creditsTotal,
            bookingId: bookingDoc._id.toString(),
          });

          console.log(
            `[BookingCron] Booking ${bookingDoc._id} auto-completed successfully.`,
          );
        } else if (executionType === 'disputed' && bookingDoc) {
          console.log(
            `[BookingCron] Booking ${bookingDoc._id} auto-disputed (neither party confirmed).`,
          );
        }
      } catch (err) {
        console.error(
          `[BookingCron] Failed to process candidate booking ${candidate._id}:`,
          err,
        );
      } finally {
        await session.endSession();
      }
    }
  } catch (err) {
    console.error(
      '[BookingCron] Global error during auto-confirmation run:',
      err,
    );
  } finally {
    isRunning = false;
  }
}
export function startBookingCron(): void {
  console.log('[BookingCron] Auto-confirmation job initialized.');

  // 1. Run an immediate check on startup so you don't wait an hour after deploying
  void runAutoConfirmation();

  // 2. Schedule to run exactly at minute 0 of every hour (e.g. 1:00, 2:00, 3:00)
  cron.schedule('0 * * * *', () => {
    console.log(
      '[BookingCron] Executing scheduled hourly auto-confirmation check...',
    );
    void runAutoConfirmation();
  });
}
