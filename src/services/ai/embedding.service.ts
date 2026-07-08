import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MODEL_NAME = 'gemini-embedding-001';
const OUTPUT_DIMENSIONALITY = 768;

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

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
        `[EmbeddingService] Gemini 503 - retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      return withRetryOn503(fn, attempt + 1);
    }

    throw err;
  }
};

const embedText = async (
  text: string,
  taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY',
): Promise<number[]> => {
  try {
    const trimmedText = text.trim();

    if (!trimmedText) {
      return [];
    }

    const response = await withRetryOn503(() =>
      ai.models.embedContent({
        model: MODEL_NAME,
        contents: trimmedText,
        config: {
          taskType,
          outputDimensionality: OUTPUT_DIMENSIONALITY,
        },
      }),
    );

    return response.embeddings?.[0]?.values ?? [];
  } catch (error) {
    console.error('[EmbeddingService] Failed to generate embedding:', error);
    return [];
  }
};

export const embedDocument = async (text: string): Promise<number[]> =>
  embedText(text, 'RETRIEVAL_DOCUMENT');

export const embedQuery = async (text: string): Promise<number[]> =>
  embedText(text, 'RETRIEVAL_QUERY');
