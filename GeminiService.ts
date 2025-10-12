import { GoogleGenAI, Type } from "@google/genai";
// Đảm bảo type StudentScore trong file types.ts là một đối tượng chứa ten_hoc_sinh và diem_so
import type { StudentScore } from '../types'; 

// Hàm chuyển đổi tệp hình ảnh thành định dạng Base64 để gửi tới Gemini
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

// Khởi tạo AI Client và đọc API Key từ biến môi trường của Netlify/Vite
// Sử dụng cú pháp import.meta.env là CHUẨN XÁC
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY as string });

// Hàm chính để trích xuất dữ liệu từ hình ảnh
// Hàm này được định nghĩa để trả về MỘT MẢNG (Array) các kết quả
export const extractDataFromImage = async (imageFile: File): Promise<StudentScore[]> => {
    // CHÚ Ý: Đã nâng cấp lên mô hình Pro để xử lý bảng lớn tốt hơn
    const model = 'gemini-2.5-pro'; 
    const imagePart = await fileToGenerativePart(imageFile);
    
    // PROMPT MỚI: Yêu cầu trích xuất TẤT CẢ các học sinh và chỉ rõ cột điểm
    const prompt = `Bạn là một CHUYÊN GIA PHÂN TÍCH BÀI KIỂM TRA. Từ hình ảnh danh sách điểm này, hãy trích xuất **TẤT CẢ** các cặp Tên học sinh và Tổng điểm mà bạn tìm thấy.

YÊU CẦU:
1. Trích xuất **tất cả** học sinh (nếu có nhiều hơn một).
2. Tên phải giữ nguyên 100% các ký tự Tiếng Việt có dấu.
3. Điểm số phải là giá trị số duy nhất từ cột 'Tổng điểm', không làm tròn.

ĐẦU RA:
- Trả về kết quả dưới dạng **MỘT MẢNG JSON** theo cấu trúc đã định nghĩa.
- Nếu không tìm thấy học sinh nào, trả về một mảng rỗng (empty array).`;

    // CẤU TRÚC JSON: Đã sửa thành kiểu MẢNG (ARRAY)
    const responseSchema = {
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
                    description: "Điểm số cuối cùng từ cột 'Tổng điểm' (ví dụ: 8.5, 10.0)."
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

        // --- MÃ XỬ LÝ ĐẦU RA (ĐÃ SỬA LỖI LOGIC VÀ CÚ PHÁP) ---

        // 1. Kiểm tra nghiêm ngặt: Đầu ra phải là một MẢNG
        if (!Array.isArray(parsedData)) {
            // Nếu không phải mảng, báo lỗi
            throw new Error("API did not return a valid JSON array as requested. Model output structure error.");
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
}; // Dấu ngoặc nhọn này đóng hàm extractDataFromImage
