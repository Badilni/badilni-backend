import {
  rerankCandidates,
  type RerankableCandidate,
} from './reranker.service.js';

const SMART_SEARCH_SYSTEM_INSTRUCTION =
  'You are a relevance reranker for Badilni, a skill barter marketplace. ' +
  'Score how well each candidate satisfies the user search query. ' +
  'Return only JSON. Scores must be numbers from 0 to 1.';

const SMART_SEARCH_MODEL_CANDIDATES = [
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
  'gemini-3.1-flash-lite',
];

export type { RerankableCandidate };

export const rerankSmartSearchCandidates = async <
  T extends RerankableCandidate,
>(
  query: string,
  candidates: T[],
) =>
  rerankCandidates(query, candidates, {
    systemInstruction: SMART_SEARCH_SYSTEM_INSTRUCTION,
    modelCandidates: SMART_SEARCH_MODEL_CANDIDATES,
    serviceName: 'SmartSearchRerankerService',
  });
