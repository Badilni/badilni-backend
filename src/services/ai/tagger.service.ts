import { GoogleGenAI, Schema, Type } from '@google/genai';

import { runWithGeminiFallback } from './geminiFallback.service.js';

// Initialize the Google GenAI SDK
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MODEL_CANDIDATES = [
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
];

const ARABIC_SCRIPT_REGEX = /[\u0600-\u06FF]/;

/**
 * Defense-in-depth: Ensures clean, URL-safe database strings and prevents
 * any potential formatting drift from the LLM.
 */
const sanitizeTags = (tags: unknown[], allowArabic: boolean): string[] => {
  if (!Array.isArray(tags)) {
    return [];
  }

  return tags
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) =>
      tag
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\p{L}\p{N}-]/gu, ''),
    )
    .filter((tag) => allowArabic || !ARABIC_SCRIPT_REGEX.test(tag))
    .filter((tag) => tag.length > 1 && tag.length <= 30)
    .slice(0, 8);
};

// Define the strict JSON schema for Gemini's output
const tagResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    tags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        'An array of 4 to 8 lowercase, hyphenated tags in Arabic and/or English.',
    },
  },
  required: ['tags'],
};

const cleanJsonText = (responseText: string): string => {
  let cleanedText = responseText.trim();

  if (cleanedText.startsWith('```json')) {
    cleanedText = cleanedText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
  } else if (cleanedText.startsWith('```')) {
    cleanedText = cleanedText.replace(/^```\n?/, '').replace(/\n?```$/, '');
  }

  return cleanedText;
};

export const generateTagsFromAI = async (
  category: string,
  title: string,
  description: string,
): Promise<string[]> => {
  try {
    const systemInstruction =
      'You are an expert tagging assistant for "Badilni", a skill barter marketplace.\n\n' +
      'Analyze the provided Category, Title, and Description. Evaluate the language of the provided input text.\n\n' +
      'CRITICAL RULES:\n' +
      '1. LANGUAGE CONDITION: Assess if the input contains Arabic script. If the text is purely English, you must generate ONLY English tags. Do not output any Arabic text if the input text contains zero Arabic words.\n' +
      '2. BILINGUAL STRATEGY: Only if the input text actively contains Arabic, generate a mix of 3-4 native Arabic tags representing core concepts, plus 2-4 standardized English technical industry terms.\n' +
      '3. QUANTITY & FORMAT: Generate between 4 to 8 relevant, concise search keywords. Tags must be single words or short 2-3 word phrases separated strictly by hyphens (e.g., "web-development" or "ui-design").\n' +
      '4. CASE: All Latin characters must be strictly lowercase.\n' +
      '5. Output ONLY the raw structured JSON matching the requested schema. No conversational intros.';

    const prompt = `Category: ${category || 'General'}\nTitle: ${title || 'No title provided'}\nDescription: ${description}`;
    const allowArabicTags = ARABIC_SCRIPT_REGEX.test(
      `${category}\n${title}\n${description}`,
    );

    const response = await runWithGeminiFallback(
      MODEL_CANDIDATES,
      (model) =>
        ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction,
            temperature: 0.1,
            maxOutputTokens: 300,
            responseMimeType: 'application/json',
            responseSchema: tagResponseSchema,
          },
        }),
      { serviceName: 'TaggerService' },
    );

    const responseText = response.text;

    if (!responseText) {
      return [];
    }

    const parsedBody = JSON.parse(cleanJsonText(responseText));

    if (parsedBody?.tags && Array.isArray(parsedBody.tags)) {
      return sanitizeTags(parsedBody.tags, allowArabicTags);
    } else if (Array.isArray(parsedBody)) {
      return sanitizeTags(parsedBody, allowArabicTags);
    }

    return [];
  } catch (error) {
    console.error('[TaggerService] Failed to generate tags via Gemini:', error);
    return [];
  }
};
