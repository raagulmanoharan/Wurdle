import { GoogleGenAI, Type } from "@google/genai";

export async function generateConceptWord(concept: string): Promise<{word: string, pronunciation: string, definition: string, discovery: string}> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const prompt = `The user wants a made-up scientific word for the following concept: "${concept}". 

Create a plausible-sounding scientific word using familiar Latin/Greek roots (e.g., -ology, -ism, -phobia, thermo-, psycho-, etc.). Keep it grounded and close to reality:
- Use roots that sound like real scientific terms (think psychology, thermodynamics, photosynthesis)
- Prefer shorter words (2-4 syllables) that feel pronounceable and recognizable
- Avoid alien, convoluted, or overly exotic constructions
- The word should feel like it could plausibly exist in a textbook

Also provide a short, dynamic, and utterly absurd fictitious paragraph about where, when, and by whom this concept was discovered. Make it sound like a serious historical account of a ridiculous event.

IMPORTANT: Absolutely NO obscenity, profanity, or inappropriate language. Keep it family-friendly and safe for work.`;
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING, description: "The made up word, lowercase" },
          pronunciation: { type: Type.STRING, description: "Phonetic spelling, e.g. /kɒntəmpleɪt/" },
          definition: { type: Type.STRING, description: "Short, clear definition" },
          discovery: { type: Type.STRING, description: "A short fictitious paragraph of where, when, and by whom this concept was discovered." }
        },
        required: ["word", "pronunciation", "definition", "discovery"]
      }
    }
  });

  try {
    return JSON.parse(response.text || "{}");
  } catch (e) {
    console.error("Failed to parse JSON", e);
    return { word: "error", pronunciation: "/error/", definition: "Failed to generate.", discovery: "Lost to history." };
  }
}

export async function generateDaVinciSketch(concept: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const prompt = `A highly detailed scientific CAD diagram and engineering blueprint of ${concept}. Technical drawing, orthographic projection, mechanical precision. Drawn with pure white lines on a pure solid black background (#000000). It is CRITICAL that the background is completely solid black to blend seamlessly into a black app interface. No other colors. Blueprint style.`;
  
  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-image-preview',
    contents: {
      parts: [
        {
          text: prompt,
        },
      ],
    },
    config: {
      imageConfig: {
        aspectRatio: "3:4",
      },
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }

  throw new Error("Failed to generate image.");
}
