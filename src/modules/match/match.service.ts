import { Types } from 'mongoose';

import { Listing } from '../../models/listing.model.js';
import { Match } from '../../models/match.model.js';
import { embedQuery } from '../../services/ai/embedding.service.js';
import {
  rerankMatchCandidates,
  type RerankableCandidate,
} from '../../services/ai/matchmakerReranker.service.js';
import { AppError } from '../../utils/appError.js';
import { ListingSearchFeatures } from '../../utils/listingSearchFeatures.js';
import { notifyAiMatch } from '../notification/notification.service.js';
import { MatchQuery } from './match.schema.js';

const MATCHMAKER_VECTOR_NUM_CANDIDATES = 100;
const MATCHMAKER_VECTOR_LIMIT = 15;

interface MatchCandidate extends RerankableCandidate {
  _id: Types.ObjectId | string;
  user?: Types.ObjectId | string | { _id?: Types.ObjectId | string };
}

interface MatchableRequest {
  _id: Types.ObjectId | string;
  user: unknown;
  title: string;
  description: string;
  status: string;
}

interface MatchableRequestWithCategory extends MatchableRequest {
  category: {
    name: string;
  };
}

type RerankedMatchCandidate = MatchCandidate & {
  rerankScore: number;
  rerankReason?: string;
};

// Mongoose can give us plain ObjectIds, strings, or populated documents.
// This helper normalizes those shapes before we compare or store ids.
const getObjectIdString = (value: unknown): string => {
  if (value instanceof Types.ObjectId) {
    return value.toString();
  }

  if (typeof value === 'string') {
    return value;
  }

  if (value && typeof value === 'object' && '_id' in value) {
    return getObjectIdString((value as { _id?: unknown })._id);
  }

  return '';
};

// Duplicate matches are expected if cron and on-demand matching race each other.
// MongoDB reports that as error code 11000 from the unique (listing, request) index.
const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: number }).code === 11000;

const notifyMatchParticipants = (
  providerId: string,
  receiverId: string,
  matchId: string,
  reason: string,
) => {
  // Notifications are intentionally fire-and-forget, so a socket/db notification issue never deletes a saved match.
  notifyAiMatch({ userId: providerId, matchId, reason }).catch((err) =>
    console.error('[Matchmaker] Failed to notify provider:', err),
  );

  notifyAiMatch({ userId: receiverId, matchId, reason }).catch((err) =>
    console.error('[Matchmaker] Failed to notify receiver:', err),
  );
};

const populateMatchQuery = () => [
  {
    path: 'listing',
    select: 'title tags category hourlyRate',
    populate: { path: 'category', select: 'name slug' },
  },
  {
    path: 'request',
    select: 'title tags category creditsOffered',
    populate: { path: 'category', select: 'name slug' },
  },
  { path: 'provider', select: 'name avatar' },
  { path: 'receiver', select: 'name avatar' },
];

const buildRequestQueryText = (
  request: MatchableRequest,
  categoryName: string,
) => `${request.title}\n${request.description}\n${categoryName}`;

const findCandidateListings = async (
  queryText: string,
  receiverId: string,
): Promise<MatchCandidate[]> => {
  const vector = await embedQuery(queryText);

  if (vector.length === 0) {
    return [];
  }

  return new ListingSearchFeatures<MatchCandidate>(
    Listing,
    {
      smartSearch: queryText,
      isActive: true,
      fields: '_id,user,title,description,tags,category,score',
    },
    'SkillListing',
  )
    .vectorSearch(
      vector,
      MATCHMAKER_VECTOR_NUM_CANDIDATES,
      MATCHMAKER_VECTOR_LIMIT,
    )
    .matchType()
    .filter()
    .excludeUser(receiverId)
    .lookupCategoryRelation()
    .limitFields()
    .execCandidates();
};

const getExistingListingIdSet = async (
  requestId: Types.ObjectId | string,
): Promise<Set<string>> => {
  const existingListingIds = await Match.distinct('listing', {
    request: requestId,
  });

  return new Set(existingListingIds.map(String));
};

const isCandidateEligible = (
  candidate: MatchCandidate,
  receiverId: string,
  existingListingIdSet: Set<string>,
): boolean => {
  const listingId = getObjectIdString(candidate._id);
  const providerId = getObjectIdString(candidate.user);

  return (
    listingId !== '' &&
    providerId !== '' &&
    providerId !== receiverId &&
    !existingListingIdSet.has(listingId)
  );
};

const filterEligibleCandidates = async (
  request: MatchableRequest,
  candidates: MatchCandidate[],
): Promise<MatchCandidate[]> => {
  const receiverId = getObjectIdString(request.user);
  const existingListingIdSet = await getExistingListingIdSet(request._id);

  return candidates.filter((candidate) =>
    isCandidateEligible(candidate, receiverId, existingListingIdSet),
  );
};

const createMatchFromCandidate = async (
  request: MatchableRequest,
  candidate: RerankedMatchCandidate,
): Promise<boolean> => {
  const providerId = getObjectIdString(candidate.user);
  const receiverId = getObjectIdString(request.user);
  const aiReasoning =
    candidate.rerankReason?.trim() ||
    'This skill listing appears to match your service request.';

  try {
    // Match documents are immutable, so creation is the only write path.
    const match = await Match.create({
      provider: providerId,
      receiver: receiverId,
      listing: candidate._id,
      request: request._id,
      matchScore: candidate.rerankScore,
      aiReasoning,
    });

    notifyMatchParticipants(
      providerId,
      receiverId,
      match._id.toString(),
      aiReasoning,
    );

    return true;
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      console.warn(
        `[Matchmaker] Duplicate match skipped for listing ${candidate._id} and request ${request._id}.`,
      );
      return false;
    }

    // One failed candidate should not prevent later candidates from being saved.
    console.error(
      `[Matchmaker] Failed to create match for listing ${candidate._id} and request ${request._id}:`,
      err,
    );
    return false;
  }
};

const saveMatches = async (
  request: MatchableRequest,
  candidates: RerankedMatchCandidate[],
): Promise<number> => {
  let createdCount = 0;

  for (const candidate of candidates) {
    const created = await createMatchFromCandidate(request, candidate);

    if (created) {
      createdCount += 1;
    }
  }

  return createdCount;
};

const findAndSaveMatches = async (
  request: MatchableRequest,
  categoryName: string,
): Promise<number> => {
  // Flow: build text -> vector-search listings -> remove unsafe/duplicate candidates -> AI rerank -> save matches.
  const queryText = buildRequestQueryText(request, categoryName);
  const receiverId = getObjectIdString(request.user);
  const candidates = await findCandidateListings(queryText, receiverId);

  if (candidates.length === 0) {
    return 0;
  }

  const eligibleCandidates = await filterEligibleCandidates(
    request,
    candidates,
  );

  if (eligibleCandidates.length === 0) {
    return 0;
  }

  const rerankedCandidates = await rerankMatchCandidates(
    queryText,
    eligibleCandidates,
  );

  return saveMatches(request, rerankedCandidates);
};

export const runMatchmakerForLoadedRequest = async (
  request: MatchableRequestWithCategory,
): Promise<number> => {
  try {
    if (request.status !== 'open') {
      return 0;
    }

    return findAndSaveMatches(request, request.category.name);
  } catch (err) {
    console.error(
      `[Matchmaker] Failed for service request ${request._id}:`,
      err,
    );
    return 0;
  }
};

export const getMyMatches = async (userId: string, query: MatchQuery) => {
  const skip = (query.page - 1) * query.limit;
  const filter = { $or: [{ provider: userId }, { receiver: userId }] };

  const [matches, total] = await Promise.all([
    Match.find(filter)
      .populate(populateMatchQuery())
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(query.limit),
    Match.countDocuments(filter),
  ]);

  return {
    matches,
    pagination: {
      total,
      page: query.page,
      limit: query.limit,
      pages: Math.ceil(total / query.limit),
    },
  };
};

export const getMatch = async (matchId: string, userId: string) => {
  const match = await Match.findOne({
    _id: matchId,
    $or: [{ provider: userId }, { receiver: userId }],
  }).populate(populateMatchQuery());

  if (!match) {
    throw new AppError('Match not found', 404);
  }

  return match;
};
