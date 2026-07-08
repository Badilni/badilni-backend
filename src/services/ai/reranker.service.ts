import { GoogleGenAI, Schema, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MODEL_NAME = 'gemini-2.5-flash';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const MIN_RELEVANCE_SCORE = 0.5;

export interface RerankableCandidate {
  _id?: unknown;
  id?: unknown;
  title?: string;
  description?: string;
  tags?: string[];
  category?: {
    name?: string;
    slug?: string;
  };
}

interface RerankScore {
  id: string;
  score: number;
}

const withRetryOn503 = async <T>(
  fn: () => Promise<T>,
  attempt = 0,
): Promise<T> => {
  try {
    return await fn();
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    if (status === 503 && attempt < MAX_RETRIES) {
      const delay = BASE_DELAY_MS * 2 ** attempt;
      console.warn(
        `[RerankerService] Gemini 503 - retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      return withRetryOn503(fn, attempt + 1);
    }

    throw err;
  }
};

const rerankResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    results: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          score: {
            type: Type.NUMBER,
            description: 'Relevance score from 0 to 1.',
          },
        },
        required: ['id', 'score'],
      },
    },
  },
  required: ['results'],
};

const getCandidateId = (candidate: RerankableCandidate): string =>
  String(candidate._id ?? candidate.id ?? '');

const parseScores = (responseText: string): RerankScore[] => {
  let cleanedText = responseText.trim();
  if (cleanedText.startsWith('```json')) {
    cleanedText = cleanedText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
  } else if (cleanedText.startsWith('```')) {
    cleanedText = cleanedText.replace(/^```\n?/, '').replace(/\n?```$/, '');
  }

  const parsedBody = JSON.parse(cleanedText);
  const rawResults = Array.isArray(parsedBody?.results)
    ? parsedBody.results
    : parsedBody;

  if (!Array.isArray(rawResults)) {
    return [];
  }

  return rawResults
    .filter(
      (item): item is RerankScore =>
        typeof item?.id === 'string' && typeof item?.score === 'number',
    )
    .map((item) => ({
      id: item.id,
      score: Math.max(0, Math.min(1, item.score)),
    }));
};

export const rerankCandidates = async <T extends RerankableCandidate>(
  query: string,
  candidates: T[],
): Promise<(T & { rerankScore: number })[]> => {
  if (candidates.length === 0) {
    return [];
  }

  try {
    const systemInstruction =
      'You are a relevance reranker for Badilni, a skill barter marketplace. ' +
      'Score how well each candidate satisfies the user search query. ' +
      'Return only JSON. Scores must be numbers from 0 to 1.';

    const prompt = JSON.stringify({
      query,
      candidates: candidates.map((candidate) => ({
        id: getCandidateId(candidate),
        title: candidate.title ?? '',
        description: candidate.description ?? '',
        tags: candidate.tags ?? [],
        category: candidate.category?.name ?? '',
      })),
    });

    const response = await withRetryOn503(() =>
      ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
          responseSchema: rerankResponseSchema,
        },
      }),
    );

    const responseText = response.text;

    if (!responseText) {
      return [];
    }

    const scoreById = new Map(
      parseScores(responseText).map((result) => [result.id, result.score]),
    );

    return candidates
      .map((candidate) => ({
        ...candidate,
        rerankScore: scoreById.get(getCandidateId(candidate)) ?? 0,
      }))
      .filter((candidate) => candidate.rerankScore > MIN_RELEVANCE_SCORE)
      .sort((a, b) => b.rerankScore - a.rerankScore);
  } catch (error) {
    console.error('[RerankerService] Failed to rerank candidates:', error);
    return [];
  }
};
