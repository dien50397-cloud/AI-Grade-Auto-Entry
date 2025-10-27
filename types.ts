// types.ts

// Định nghĩa kiểu dữ liệu cho kết quả trích xuất từ Gemini (khớp với JSON schema)
export interface Result {
  student_name: string;
  subject: string;
  final_score: string; // Sử dụng string để chứa định dạng điểm chuẩn hóa (vd: "8,5")
}

// Giữ lại các kiểu cũ
export interface StudentScore {
  ten_hoc_sinh: string;
  diem_so: string | number;
}

export interface ExtractionResult {
  fileName: string;
  status: 'success' | 'error';
  ten_hoc_sinh: string;
  diem_so: string | number;
  errorMessage?: string;
}
