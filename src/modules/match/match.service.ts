import { Match } from '../../models/match.model.js';
import { ServiceRequest } from '../../models/serviceRequest.model.js';
import { SkillListing } from '../../models/skillListing.model.js';
import * as dbFactory from '../../utils/dbFactory.js';
import * as aiService from '../../utils/aiService.js';
import * as notificationService from '../notification/notification.service.js';
import { AppError } from '../../utils/appError.js';
import { MatchQuery } from './match.schema.js';

interface CurrentUser {
  id: string;
}

// Below this confidence, a match is not worth surfacing to either user
// (see Badilni plan §6.6).
const MIN_MATCH_SCORE = 0.6;

// Runs as a node-cron job every 6 hours, or can be triggered manually.
// Only the minimum necessary fields are sent to the AI — never full
// descriptions or personal info — to keep prompts small and cheap.
export const runMatchmaker = async () => {
  const [listings, requests] = await Promise.all([
    SkillListing.find({ isActive: true }).select('user title tags category'),
    ServiceRequest.find({ status: 'open' }).select('user title tags category'),
  ]);

  const suggestions = await aiService.findMatches(
    listings.map((listing) => ({
      id: listing._id.toString(),
      userId: listing.user.toString(),
      title: listing.title,
      tags: listing.tags ?? [],
      category: listing.category.toString(),
    })),
    requests.map((request) => ({
      id: request._id.toString(),
      userId: request.user.toString(),
      title: request.title,
      tags: request.tags ?? [],
      category: request.category.toString(),
    })),
  );

  const accepted = suggestions.filter(
    (suggestion) => suggestion.matchScore >= MIN_MATCH_SCORE,
  );

  let createdCount = 0;

  for (const suggestion of accepted) {
    try {
      const match = await Match.findOneAndUpdate(
        {
          providerId: suggestion.providerId,
          receiverId: suggestion.receiverId,
          providerListingId: suggestion.providerListingId,
          receiverRequestId: suggestion.receiverRequestId,
        },
        {
          matchScore: suggestion.matchScore,
          aiReasoning: suggestion.reasoning,
          status: 'pending',
        },
        { upsert: true, returnDocument: 'after' },
      );

      if (!match) {
        continue;
      }

      createdCount += 1;

      await Promise.all([
        notificationService.create({
          userId: suggestion.providerId,
          type: 'match_suggestion',
          title: 'You have a new match!',
          body: 'Someone is a great fit for the skill you offer.',
          relatedEntityId: match._id.toString(),
          relatedEntityType: 'Match',
        }),
        notificationService.create({
          userId: suggestion.receiverId,
          type: 'match_suggestion',
          title: 'You have a new match!',
          body: 'A provider matching your request has been found.',
          relatedEntityId: match._id.toString(),
          relatedEntityType: 'Match',
        }),
      ]);

      await Match.findByIdAndUpdate(match._id, { status: 'notified' });
    } catch (err) {
      console.error('Non-fatal: failed to persist/notify match suggestion.', err);
    }
  }

  return createdCount;
};

export const getMyMatches = async (userId: string, query: MatchQuery) => {
  const mongooseQuery = Match.find({
    $or: [{ providerId: userId }, { receiverId: userId }],
  })
    .populate('providerId', 'name avatar')
    .populate('receiverId', 'name avatar')
    .populate('providerListingId', 'title')
    .populate('receiverRequestId', 'title');

  return dbFactory.findMany(mongooseQuery, query, []);
};

export const respondToMatch = async (
  id: string,
  user: CurrentUser,
  status: 'accepted' | 'dismissed',
) => {
  const match = await Match.findById(id);

  if (!match) {
    throw new AppError('No match found with this id', 404);
  }
  if (
    match.providerId.toString() !== user.id &&
    match.receiverId.toString() !== user.id
  ) {
    throw new AppError('You are not part of this match', 403);
  }

  match.status = status;
  await match.save();

  return match;
};
