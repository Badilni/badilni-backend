import { GoogleGenAI, Schema, Type } from '@google/genai';

import { runWithGeminiFallback } from './geminiFallback.service.js';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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

export interface RerankOptions {
  systemInstruction: string;
  modelCandidates: string[];
  serviceName?: string;
}

interface RerankScore {
  id: string;
  score: number;
  reason?: string;
}

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
          reason: {
            type: Type.STRING,
            description: 'Optional human-readable reason for the score.',
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

const cleanJsonText = (responseText: string): string => {
  let cleanedText = responseText.trim();

  if (cleanedText.startsWith('```json')) {
    cleanedText = cleanedText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
  } else if (cleanedText.startsWith('```')) {
    cleanedText = cleanedText.replace(/^```\n?/, '').replace(/\n?```$/, '');
  }

  return cleanedText;
};

const parseScores = (responseText: string): RerankScore[] => {
  const cleanedText = cleanJsonText(responseText);
  try {
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
      reason: typeof item.reason === 'string' ? item.reason : undefined,
    }));
  } catch (err) {
    console.error('[RerankerService] JSON Parse Error on raw text:\n', cleanedText, '\n----------');
    throw err;
  }
};

export const rerankCandidates = async <T extends RerankableCandidate>(
  query: string,
  candidates: T[],
  options: RerankOptions,
): Promise<(T & { rerankScore: number; rerankReason?: string })[]> => {
  if (candidates.length === 0) {
    return [];
  }

  try {
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

    const scoreById = await runWithGeminiFallback(
      options.modelCandidates,
      async (model) => {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction: options.systemInstruction,
            temperature: 0,
            maxOutputTokens: 8192,
            responseMimeType: 'application/json',
            responseSchema: rerankResponseSchema,
          },
        });

        // The `.text` getter only returns the first content part.
        // For large structured outputs the model may split the response across
        // multiple parts, leaving `.text` truncated mid-JSON. Join all parts.
        const responseText = response.candidates?.[0]?.content?.parts
          ?.map((p) => p.text ?? '')
          .join('') ?? '';

        if (!responseText) {
          throw new Error('Empty response from model');
        }

        return new Map(
          parseScores(responseText).map((result) => [result.id, result]),
        );
      },
      { serviceName: options.serviceName ?? 'RerankerService' },
    );

    return candidates
      .map((candidate) => {
        const result = scoreById.get(getCandidateId(candidate));

        return {
          ...candidate,
          rerankScore: result?.score ?? 0,
          rerankReason: result?.reason,
        };
      })
      .filter((candidate) => candidate.rerankScore > MIN_RELEVANCE_SCORE)
      .sort((a, b) => b.rerankScore - a.rerankScore);
  } catch (error) {
    console.error('[RerankerService] Failed to rerank candidates:', error);
    return [];
  }
};
