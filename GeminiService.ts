// GeminiService.ts

import { Result } from './types'; // Giả định bạn có định nghĩa Result trong types.ts

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY; // Lấy API Key từ biến môi trường

/**
 * Hàm xử lý chính: Gửi hình ảnh bài kiểm tra đến Gemini API để trích xuất điểm.
 * * LƯU Ý QUAN TRỌNG: Bạn cần điền LƯỢC ĐỒ (schema) JSON và PROMPT vào đây.
 */
export const generateGradeFromImage = async (file: File): Promise<Result[]> => {
    if (!API_KEY) {
        throw new Error("Lỗi: VITE_GEMINI_API_KEY chưa được thiết lập.");
    }
    
    // 1. Tạo Base64 từ File
    const base64Image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });

    const imageData = {
        inlineData: {
            data: base64Image,
            mimeType: file.type || 'image/jpeg',
        },
    };
    
    // 2. Định nghĩa System Instruction (Prompt chính)
    const systemInstruction = `Bạn là một chuyên gia xử lý dữ liệu giáo dục. Nhiệm vụ của bạn là phân tích dữ liệu bài kiểm tra được cung cấp và trích xuất điểm số, sau đó chuyển đổi chúng thành định dạng JSON.
Quy tắc:
1. Xác định Tên Học Sinh, Tên Môn Học, và Điểm Số Cuối Cùng.
2. Đối với các điểm số có dấu phân thập phân (dấu chấm), hãy chuyển đổi thành DẤU PHẨY (,) để chuẩn hóa cho Microsoft Excel.
3. Luôn trả về dữ liệu dưới định dạng MẢNG JSON (JSON array) sau:
[
  {
    "student_name": "Tên Học Sinh",
    "subject": "Tên Môn Học",
    "final_score": "Điểm chuẩn hóa (ví dụ: 8,5)"
  }
]`;

    // 3. Gọi API (Cần điều chỉnh theo thư viện bạn đang dùng: @google/genai, axios, hay fetch)
    // ********************************************************************************
    // Đây là phần ví dụ CƠ BẢN cho mục đích minh họa - cần điều chỉnh thư viện
    // ********************************************************************************
    
    try {
        // Thay thế bằng logic gọi API Gemini chính xác của bạn
        
        // Ví dụ dữ liệu giả định (placeholder)
        await new Promise(resolve => setTimeout(resolve, 1500)); // Giả lập thời gian chờ
        const mockResult: Result[] = [
            { student_name: "Nguyễn Văn A", subject: "Toán", final_score: "9,5" },
            { student_name: "Trần Thị B", subject: "Văn", final_score: "8,0" },
        ];
        return mockResult; 

    } catch (error) {
        console.error("Lỗi gọi Gemini API:", error);
        throw new Error("Không thể kết nối hoặc xử lý API Gemini.");
    }
};
