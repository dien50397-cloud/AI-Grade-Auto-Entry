# AI-Grade-Auto-Entry 🤖

**Hệ thống tự động nhập điểm bài kiểm tra sử dụng Gemini API**

Dự án này là một ứng dụng web (được tạo ra thông qua Google AI Studio) nhằm mục đích tự động hóa việc trích xuất và nhập điểm từ các bài kiểm tra được cung cấp dưới dạng hình ảnh hoặc văn bản, giảm thiểu sai sót và tăng tốc độ xử lý dữ liệu giáo dục.

---

## 🧠 Logic AI Cốt lõi (System Instruction)

Logic cốt lõi của ứng dụng được xây dựng trên một Câu lệnh Hệ thống (System Instruction) cụ thể để hướng dẫn mô hình Gemini thực hiện tác vụ nhập điểm.

### 1. Mô hình và Vị trí Code

* **Mô hình được sử dụng:** Gemini [**1.5 Flash** hoặc **1.5 Pro**]
* **Vị trí Code Prompt:** Lời gọi API Gemini và Prompt chính được tìm thấy trong tệp **`App.tsx`** hoặc **`[TÊN TỆP DỊCH VỤ CỦA BẠN].ts`** (ví dụ: `geminiservice.ts`).

### 2. Câu lệnh Hệ thống (Prompt)

Dưới đây là Prompt chính được cung cấp cho mô hình:

```markdown
Bạn là một chuyên gia xử lý dữ liệu giáo dục. Nhiệm vụ của bạn là phân tích dữ liệu bài kiểm tra được cung cấp và trích xuất điểm số, sau đó chuyển đổi chúng thành định dạng JSON tiêu chuẩn.
Quy tắc:
1. Xác định tên học sinh, tên môn học, và điểm số cuối cùng.
2. Đối với các điểm số có dấu phân thập phân (dấu chấm hoặc phẩy), hãy chuyển đổi thành dấu phẩy (,) để chuẩn hóa cho Microsoft Excel.
3. Luôn trả về dữ liệu dưới định dạng JSON sau:
{
  "student_name": "Tên Học Sinh",
  "subject": "Tên Môn Học",
  "final_score": "Điểm chuẩn hóa (ví dụ: 8,5)"
}
