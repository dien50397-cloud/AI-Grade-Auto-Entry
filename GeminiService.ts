
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
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY as string });
// Sử dụng "import.meta.env" là cú pháp chuẩn của Vite để đọc biến công khai.

export const extractDataFromImage = async (imageFile: File): Promise<StudentScore> => {
    const model = 'gemini-2.5-flash';
    const imagePart = await fileToGenerativePart(imageFile);
    const prompt = `Bạn là một CHUYÊN GIA PHÂN TÍCH BÀI KIỂM TRA. Từ hình ảnh bài kiểm tra/danh sách điểm này, hãy trích xuất **TẤT CẢ** các cặp Tên học sinh và Điểm số mà bạn tìm thấy.

YÊU CẦU:
1. Trích xuất **tất cả** học sinh (nếu có nhiều hơn một).
2. Tên phải giữ nguyên 100% các ký tự Tiếng Việt có dấu.
3. Điểm số phải là giá trị số duy nhất, không làm tròn.

ĐẦU RA:
- Trả về kết quả dưới dạng **MỘT MẢNG JSON** theo cấu trúc đã định nghĩa.
- Nếu không tìm thấy học sinh nào, trả về một mảng rỗng (empty array).`;

   const responseSchema = {
    // Kiểu dữ liệu chính là MẢNG (ARRAY)
    type: Type.ARRAY, 
    items: {
        type: Type.OBJECT,
        properties: {
            ten_hoc_sinh: {
                type: Type.STRING,
                description: "Họ tên đầy đủ của học sinh (giữ nguyên dấu tiếng Việt)."
            },
            diem_so: {
                type: Type.STRING,
                description: "Điểm số cuối cùng dưới dạng số (ví dụ: 8.5, 10.0)."
            }
        },
        required: ['ten_hoc_sinh', 'diem_so'],
    },
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
