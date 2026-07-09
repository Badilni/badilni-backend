const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 1000;

const sleep = async (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const getStatusCode = (error: unknown): number | undefined => {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const candidate = error as { status?: unknown; code?: unknown };

  if (typeof candidate.status === 'number') {
    return candidate.status;
  }

  if (typeof candidate.code === 'number') {
    return candidate.code;
  }

  return undefined;
};

const isFatalStatus = (status?: number): boolean =>
  status === 401 || status === 403;

const isRetryableSameModelStatus = (status?: number): boolean =>
  status === 503;

export interface GeminiFallbackOptions {
  serviceName: string;
  maxRetries?: number;
  baseDelayMs?: number;
}

export const runWithGeminiFallback = async <T>(
  models: string[],
  executor: (model: string) => Promise<T>,
  {
    serviceName,
    maxRetries = DEFAULT_MAX_RETRIES,
    baseDelayMs = DEFAULT_BASE_DELAY_MS,
  }: GeminiFallbackOptions,
): Promise<T> => {
  let lastError: unknown;

  for (const [modelIndex, model] of models.entries()) {
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        return await executor(model);
      } catch (error) {
        lastError = error;
        const status = getStatusCode(error);
        const isLastModel = modelIndex === models.length - 1;

        if (isFatalStatus(status)) {
          throw error;
        }

        if (status === 429) {
          console.warn(
            `[${serviceName}] Gemini ${status} on ${model} - failing over to the next model${isLastModel ? ' (no more fallbacks left)' : ''}.`,
          );
          break;
        }

        if (isRetryableSameModelStatus(status) && attempt < maxRetries) {
          const delay = baseDelayMs * 2 ** attempt;
          console.warn(
            `[${serviceName}] Gemini ${status} on ${model} - retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries}).`,
          );
          await sleep(delay);
          attempt += 1;
          continue;
        }

        if (isRetryableSameModelStatus(status)) {
          console.warn(
            `[${serviceName}] Gemini ${status} on ${model} after ${maxRetries} retries - failing over to the next model${isLastModel ? ' (no more fallbacks left)' : ''}.`,
          );
          break;
        }

        console.warn(
          `[${serviceName}] Gemini request failed on ${model}${status ? ` with status ${status}` : ''} - failing over to the next model${isLastModel ? ' (no more fallbacks left)' : ''}.`,
        );
        break;
      }
    }
  }

  throw lastError ?? new Error(`[${serviceName}] Gemini request failed`);
};
