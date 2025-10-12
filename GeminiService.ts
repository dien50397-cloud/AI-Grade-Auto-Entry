
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

        // --- MÃ ĐÃ SỬA LỖI LOGIC: XỬ LÝ ĐẦU RA LÀ MẢNG ---

        // 1. Kiểm tra nghiêm ngặt: Đầu ra phải là một MẢNG
        if (!Array.isArray(parsedData)) {
            // Nếu không phải mảng, báo lỗi
            throw new Error("API did not return a valid JSON array as requested. Check model output.");
        }
        
        // 2. Trả về toàn bộ MẢNG đã được trích xuất
        // Mã App.tsx sẽ nhận mảng này và xử lý từng phần tử
        return parsedData; 

    } catch (error) {
        console.error(`Error processing ${imageFile.name}:`, error);
        if (error instanceof Error) {
            // Thêm xử lý lỗi JSON chi tiết
            if (error.message.includes('Unexpected token') || error.message.includes('JSON')) {
                 throw new Error("Lỗi định dạng JSON từ API. Vui lòng thử lại.");
            }
            throw new Error(`API Error: ${error.message}`);
        }
        throw new Error("An unknown error occurred during API call.");
    }
}; // Đảm bảo dấu ngoặc này kết thúc hàm extractDataFromImage
  
