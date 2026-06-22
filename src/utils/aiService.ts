/**
 * Thin service module wrapping all LLM API calls (Anthropic Claude).
 * No AI logic should live in controllers or services directly — everything
 * goes through here so the provider can be swapped (see Badilni plan §2.1).
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

interface AICallOptions {
  system?: string;
  maxTokens?: number;
}

const callClaude = async (
  prompt: string,
  { system, maxTokens = 1024 }: AICallOptions = {},
): Promise<string> => {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`AI provider request failed with status ${response.status}`);
  }

  const data = await response.json();
  const textBlock = data.content?.find((block: any) => block.type === 'text');

  return textBlock?.text ?? '';
};

const parseJsonResponse = <T>(raw: string, fallback: T): T => {
  try {
    const cleaned = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
};

interface ListingForMatch {
  id: string;
  userId: string;
  title: string;
  tags: string[];
  category: string;
}

interface RequestForMatch {
  id: string;
  userId: string;
  title: string;
  tags: string[];
  category: string;
}

interface MatchSuggestion {
  providerListingId: string;
  receiverRequestId: string;
  providerId: string;
  receiverId: string;
  matchScore: number;
  reasoning: string;
}

export const findMatches = async (
  listings: ListingForMatch[],
  requests: RequestForMatch[],
): Promise<MatchSuggestion[]> => {
  if (listings.length === 0 || requests.length === 0) {
    return [];
  }

  const prompt = `You are matching skill providers with help seekers on a time-barter platform.
Given these skill listings (providers) and these help requests (receivers), identify pairs
where the provider's skill matches the receiver's need, based only on title/tags/category.

Listings: ${JSON.stringify(listings)}
Requests: ${JSON.stringify(requests)}

Respond ONLY with a JSON array of objects, no other text:
[{ "providerListingId": string, "receiverRequestId": string, "providerId": string, "receiverId": string, "matchScore": number (0-1), "reasoning": string }]`;

  const raw = await callClaude(prompt, {
    system: 'You are a precise matchmaking engine. Only output valid JSON.',
  });

  return parseJsonResponse<MatchSuggestion[]>(raw, []);
};

export const suggestSkillTags = async (
  description: string,
): Promise<string[]> => {
  const prompt = `Suggest 3-5 short, structured tags (Title Case, 1-3 words each) for this
skill listing description. Respond ONLY with a JSON array of strings, no other text.

Description: "${description}"`;

  const raw = await callClaude(prompt, { maxTokens: 256 });

  return parseJsonResponse<string[]>(raw, []);
};

export const generateReviewSummary = async (
  reviews: { rating: number; comment?: string }[],
): Promise<string> => {
  if (reviews.length === 0) {
    return '';
  }

  const prompt = `Summarize this user's reviews in 2-3 sentences of natural language,
highlighting consistent praise and any recurring constructive feedback.
Respond with plain text only, no JSON.

Reviews: ${JSON.stringify(reviews)}`;

  return callClaude(prompt, { maxTokens: 256 });
};

interface SmartSearchParams {
  q?: string;
  category?: string;
  minRate?: number;
  maxRate?: number;
}

export const parseSmartSearchQuery = async (
  naturalLanguageQuery: string,
): Promise<SmartSearchParams> => {
  const prompt = `Convert this natural language search query into structured search
parameters for a skill marketplace. Respond ONLY with a JSON object, no other text:
{ "q": string, "category": string | null, "minRate": number | null, "maxRate": number | null }

Query: "${naturalLanguageQuery}"`;

  const raw = await callClaude(prompt, { maxTokens: 256 });

  return parseJsonResponse<SmartSearchParams>(raw, { q: naturalLanguageQuery });
};
