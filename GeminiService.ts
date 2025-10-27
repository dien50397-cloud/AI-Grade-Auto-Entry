// GeminiService.ts

import { GoogleGenAI } from '@google/genai'; // Thêm import thư viện chính
import { Result } from './types'; // Kiểu dữ liệu Result đã được cập nhật

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY; // Lấy API Key từ biến môi trường

/**
 * Hàm xử lý chính: Gửi hình ảnh bài kiểm tra đến Gemini API để trích xuất điểm.
 */
export const generateGradeFromImage = async (file: File): Promise<Result[]> => {
    if (!API_KEY) {
        throw new Error("Lỗi: VITE_GEMINI_API_KEY chưa được thiết lập.");
    }
    
    // 1. Tạo Base64 từ File
    const base64Image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        // Chỉ lấy phần base64 sau dấu phẩy
        reader.onload = () => resolve((reader.result as string).split(',')[1]); 
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });

    const imagePart = {
        inlineData: {
            data: base64Image,
            mimeType: file.type || 'image/jpeg',
        },
    };
    
    // 2. Định nghĩa System Instruction (Prompt chính)
    const systemInstruction = `Bạn là một chuyên gia xử lý dữ liệu giáo dục. Nhiệm vụ của bạn là phân tích dữ liệu bài kiểm tra được cung cấp và trích xuất điểm số, sau đó chuyển đổi chúng thành định dạng JSON.
Quy tắc:
1. Xác định Tên Học Sinh, Tên Môn Học, và Điểm Số Cuối Cùng.
2. Đối với các điểm số có dấu phân thập phân (dấu chấm hoặc phẩy), hãy chuyển đổi thành DẤU PHẨY (,) để chuẩn hóa cho Microsoft Excel.
3. Luôn trả về dữ liệu dưới định dạng MẢNG JSON (JSON array).`;


    // 3. Định nghĩa JSON Schema cho đầu ra
    const responseSchema = {
        type: "array",
        items: {
            type: "object",
            properties: {
                student_name: { 
                    type: "string", 
                    description: "Tên đầy đủ của học sinh được trích xuất từ bài kiểm tra." 
                },
                subject: { 
                    type: "string", 
                    description: "Tên môn học được trích xuất từ bài kiểm tra." 
                },
                final_score: { 
                    type: "string", 
                    description: "Điểm số cuối cùng đã được chuẩn hóa, sử dụng dấu phẩy (,) làm dấu thập phân (ví dụ: '8,5')." 
                },
            },
            required: ["student_name", "subject", "final_score"],
        },
    };

    // 4. Gọi API Gemini
    try {
        const ai = new GoogleGenAI({ apiKey: API_KEY });
        
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash", // Mô hình phù hợp với tác vụ trích xuất
            contents: [imagePart, systemInstruction], // Truyền hình ảnh và prompt
            config: {
                responseMimeType: "application/json", // Yêu cầu đầu ra JSON
                responseSchema: responseSchema,      // Áp dụng Schema
            },
        });
        
        // Trích xuất và phân tích JSON
        const jsonText = response.text.trim();
        return JSON.parse(jsonText) as Result[];
        
    } catch (error) {
        console.error("Lỗi gọi Gemini API:", error);
        throw new Error("Không thể kết nối hoặc xử lý API Gemini. Vui lòng kiểm tra VITE_GEMINI_API_KEY.");
    }
};
