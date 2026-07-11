import { GoogleGenAI } from '@google/genai';

import { runWithGeminiFallback } from './geminiFallback.service.js';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MODEL_CANDIDATES = [
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-3.1-flash-lite',
];
const NOT_ENOUGH_REVIEWS_FALLBACK =
  'Not enough reviews yet to generate a summary.';

const systemInstruction = `You are a reputation summarizer for Badilni, a skill barter marketplace.

You receive a list of reviews for a user (ratings and optional comments).
Write a 2-3 sentence summary of what reviewers consistently say about this person.

Rules:
- Be specific - mention the qualities reviewers actually praised or criticized
- Be balanced - if there are negative patterns, mention them honestly but constructively
- Respond in the same language as the majority of the comments
- If most comments are in Arabic, respond in Arabic. If mixed, respond in English
- Never mention specific reviewer names or quote reviews verbatim
- If there are no comments (only ratings), base the summary on the rating distribution
- Return only the summary text - no preamble, no JSON, no extra formatting`;

export const generateReviewSummary = async (
  reviews: { rating: number; comment?: string | null }[],
): Promise<string> => {
  if (reviews.length < 3) {
    return NOT_ENOUGH_REVIEWS_FALLBACK;
  }

  try {
    const prompt = JSON.stringify({
      reviews: reviews.map((review) => ({
        rating: review.rating,
        comment: review.comment ?? '',
      })),
    });

    const response = await runWithGeminiFallback(
      MODEL_CANDIDATES,
      (model) =>
        ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction,
            temperature: 0.2,
            maxOutputTokens: 300,
          },
        }),
      { serviceName: 'ReviewSummaryService' },
    );

    return response.text?.trim() || NOT_ENOUGH_REVIEWS_FALLBACK;
  } catch (error) {
    console.error(
      '[ReviewSummaryService] Failed to generate review summary via Gemini:',
      error,
    );
    return NOT_ENOUGH_REVIEWS_FALLBACK;
  }
};
