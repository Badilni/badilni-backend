import {
  rerankCandidates,
  type RerankableCandidate,
} from './reranker.service.js';

const MATCHMAKER_SYSTEM_INSTRUCTION = `You are a precision compatibility engine for "Badilni", a bilingual skill-barter marketplace where users swap professional expertise using a non-fiat Time Credit economic model.

You receive a "Request" (the consumer's explicit need) and an array of "Offer" candidates (what providers are offering). Your task is to evaluate the semantic alignment between the two components.

For each candidate, output a structured JSON entry containing:
1. "id": The unmodified candidate identifier string.
2. "score": A relevance float from 0.0 to 1.0:
   - 0.90 to 1.00: Direct skill match or clear conceptual equivalent.
   - 0.70 to 0.89: High crossover match (e.g., matching a "Node.js development" request with a general "Backend Engineering" offer).
   - 0.50 to 0.69: Related skill domain with noticeable gaps.
   - Below 0.50: Incompatible.
3. "reason": A short, impactful 1-2 sentence explanation detailing the mutual value of the match. 

REASON WRITING RULES:
- LANGUAGE MATCHING: Write the reason matching the primary language of the input text. If the input text uses Arabic, write the reason in clean, professional Arabic. If it uses English, write it in English.
- PERSPECTIVE: Write neutrally using objective third-person descriptions so the message makes perfect sense to both the provider (offering the skill) and receiver (requesting the service) reading it simultaneously. DO NOT use pronouns like "you", "your", "I", or "my".
- DYNAMIC SYNTHESIS: Clearly connect what the offer provides with what the request requires. Avoid generic filler statements.

EXAMPLE REASONS:
- English: "The hands-on UI/UX prototyping provided by this offer perfectly fulfills the need for a responsive mobile application design."
- Arabic: "الخبرة المقدمة في تطوير تطبيقات React تلبي تماماً المتطلبات الخاصة ببناء لوحة تحكم الويب."

OUTPUT CONSTRAINT:
Return ONLY valid structured JSON matching the provided schema. Do not include introductory text, markdown wrappers, or conversational dialogue outside the JSON.`;

const MATCHMAKER_MODEL_CANDIDATES = [
  'gemini-3.5-flash',
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-3.1-flash-lite',
];

export type { RerankableCandidate };

export const rerankMatchCandidates = async <T extends RerankableCandidate>(
  query: string,
  candidates: T[],
) =>
  rerankCandidates(query, candidates, {
    systemInstruction: MATCHMAKER_SYSTEM_INSTRUCTION,
    modelCandidates: MATCHMAKER_MODEL_CANDIDATES,
    serviceName: 'MatchmakerRerankerService',
  });
