
import { GoogleGenAI, Type } from "@google/genai";
import { ExtractionResult } from "../types";

export const extractItemsFromText = async (text: string): Promise<ExtractionResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Extract billing items from the following text: "${text}". 
      Return the items with their name, unit price, and quantity. 
      If quantity is not specified, assume 1. 
      Prices should be numbers.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                price: { type: Type.NUMBER },
                quantity: { type: Type.NUMBER }
              },
              required: ["name", "price", "quantity"]
            }
          }
        },
        required: ["items"]
      }
    }
  });

  try {
    const json = JSON.parse(response.text || '{"items":[]}');
    return json as ExtractionResult;
  } catch (error) {
    console.error("Failed to parse Gemini response:", error);
    return { items: [] };
  }
};
