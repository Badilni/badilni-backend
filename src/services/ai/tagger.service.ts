import { GoogleGenAI, Type, Schema } from '@google/genai';

// Initialize the Google GenAI SDK
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MODEL_NAME = 'gemini-2.5-flash-lite';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

/**
 * Retries an async operation with exponential backoff, but ONLY on 503 errors.
 * Any other error is re-thrown immediately.
 */
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
        `[TaggerService] Gemini 503 – retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      return withRetryOn503(fn, attempt + 1);
    }
    throw err;
  }
};

/**
 * Defense-in-depth: Ensures clean, URL-safe database strings and prevents
 * any potential formatting drift from the LLM.
 */
const sanitizeTags = (tags: unknown[]): string[] => {
  if (!Array.isArray(tags)) {
    return [];
  }

  return tags
    .filter((tag): tag is string => typeof tag === 'string')
    .map(
      (tag) =>
        tag
          .toLowerCase()
          .trim()
          .replace(/\s+/g, '-') // Replace any accidental spaces with hyphens
          .replace(/[^\p{L}\p{N}-]/gu, ''), // Keep only Unicode letters, numbers, and hyphens (supports Arabic)
    )
    .filter((tag) => tag.length > 1 && tag.length <= 30)
    .slice(0, 8); // Strictly cap at 8
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

export const generateTagsFromAI = async (
  category: string,
  title: string,
  description: string,
): Promise<string[]> => {
  try {
    const systemInstruction =
      'You are an expert tagging assistant for "Badilni", a skill barter marketplace where users exchange professional skills and services using Time Credits.\n\n' +
      'Analyze the provided Category, Title, and Description. The input text may be in Arabic, English, or a mix of both.\n\n' +
      'Your task:\n' +
      '1. Understand the core skill or service being offered within the context of the provided Category.\n' +
      '2. Generate between 4 to 8 relevant, concise, highly searchable tags.\n' +
      '3. BILINGUAL STRATEGY: If the input contains Arabic, generate 3-4 tags in native Arabic representing the core concepts, PLUS 2-4 standardized English industry terms (e.g., {"tags": ["تصميم-واجهات", "تطوير-مواقع", "ui-ux", "react", "frontend"]}). If the text is purely English, generate 4-8 English tags.\n' +
      '4. FORMATTING RULE: Tags must be single words or short 2-3 word phrases separated by hyphens.\n' +
      '5. All Latin characters must be strictly lowercase.';

    const prompt = `Category: ${category || 'General'}\nTitle: ${title || 'No title provided'}\nDescription: ${description}`;

    const response = await withRetryOn503(() =>
      ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.2,
          maxOutputTokens: 300,
          responseMimeType: 'application/json',
          responseSchema: tagResponseSchema,
        },
      }),
    );

    const responseText = response.text;

    if (!responseText) {
      return [];
    }

    // Replaced the brittle `{` / `}` slicing with a robust markdown stripper.
    let cleanedText = responseText.trim();
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText
        .replace(/^```json\n?/, '')
        .replace(/\n?```$/, '');
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }

    const parsedBody = JSON.parse(cleanedText);

    // Safety net. Checks for the standard object format, but falls back
    // gracefully if the model still forces a root array.
    if (parsedBody?.tags && Array.isArray(parsedBody.tags)) {
      return sanitizeTags(parsedBody.tags);
    } else if (Array.isArray(parsedBody)) {
      return sanitizeTags(parsedBody);
    }

    return [];
  } catch (error) {
    console.error('[TaggerService] Failed to generate tags via Gemini:', error);
    return [];
  }
};
