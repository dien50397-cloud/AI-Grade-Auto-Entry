
import { GoogleGenAI, Type } from "@google/genai";
import type { StudentScore } from '../types';

const fileToGenerativePart = async (file: File) => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });
  return {
    inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
  };
};

// Make sure to set the API_KEY in your environment variables.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

export const extractDataFromImage = async (imageFile: File): Promise<StudentScore> => {
    const model = 'gemini-2.5-flash';
    const imagePart = await fileToGenerativePart(imageFile);
    const prompt = `From this image of a test paper, identify the student's full name and their score. Return the result strictly as a clean JSON object with two keys: 'ten_hoc_sinh' and 'diem_so'. Do not include any other text. If the name or score is unclear, return an empty string for the respective value.`;

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            ten_hoc_sinh: {
                type: Type.STRING,
                description: "Student's full name.",
            },
            diem_so: {
                type: Type.STRING,
                description: "Student's score, can be a number or text like 'A+'."
            }
        },
        required: ['ten_hoc_sinh', 'diem_so'],
    };

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: { parts: [imagePart, { text: prompt }] },
            config: {
                responseMimeType: 'application/json',
                responseSchema: responseSchema,
            }
        });
        
        const jsonText = response.text;
        const parsedData = JSON.parse(jsonText);

        if (typeof parsedData.ten_hoc_sinh !== 'string' || !('diem_so' in parsedData)) {
            throw new Error("Invalid JSON structure received from API.");
        }
        
        return {
            ten_hoc_sinh: parsedData.ten_hoc_sinh,
            diem_so: String(parsedData.diem_so)
        };

    } catch (error) {
        console.error(`Error processing ${imageFile.name}:`, error);
        if (error instanceof Error) {
            throw new Error(`API Error: ${error.message}`);
        }
        throw new Error("An unknown error occurred during API call.");
    }
};
