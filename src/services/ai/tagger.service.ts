import { GoogleGenAI, Type, Schema } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const tagResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    tags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'An array of 3 to 5 lowercase, alphanumeric English tags.',
    },
  },
  required: ['tags'],
};

export const generateTagsFromAI = async (
  title: string,
  description: string,
): Promise<string[]> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Input Title: ${title || 'No title provided'}\nInput Description: ${description}`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: tagResponseSchema,
        temperature: 0.2,
        systemInstruction:
          'You are a tagging assistant for "Badilni", a skill barter marketplace where users exchange skills using Time Credits.\n\n' +
          'Analyze the skill listing or service request provided. The text may be in Arabic, English, or a mix of both.\n\n' +
          'Your task:\n' +
          '1. Understand the core skill or service being offered.\n' +
          '2. Generate exactly 3 to 5 relevant, concise tags.\n' +
          '3. ALL TAGS MUST BE IN ENGLISH, regardless of the input language.\n' +
          '4. Tags should be single words or short hyphenated phrases (e.g., "graphic-design", "tutoring", "music").\n' +
          '5. Tags must be entirely in lowercase and alphanumeric.',
      },
    });

    const responseText = response.text;
    if (!responseText) {
      return [];
    }

    const parsedData = JSON.parse(responseText);
    return Array.isArray(parsedData.tags) ? parsedData.tags : [];
  } catch (error) {
    console.error('Failed to automatically map listing tags:', error);
    return [];
  }
};
