// App.tsx

import React, { useState, useCallback, useMemo } from 'react'; 
import { Result } from './types'; 
import { generateGradeFromImage } from './GeminiService'; 
import ResultsTable from './ResultsTable';
// NHẬP CÁC ICON TỪ TỆP icons.tsx, thêm SpinnerIcon cho trạng thái loading
import { UploadIcon, ClipboardListIcon, SparklesIcon, SpinnerIcon } from './icons'; 


const App: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [results, setResults] = useState<Result[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // CHỈNH SỬA: Đặt giá trị mặc định chính xác như trong hình ảnh
    const [additionalColumns, setAdditionalColumns] = useState<string>('414141415151544 Mã học sinh');


    // Tạo URL xem trước cho hình ảnh đã chọn và dọn dẹp khi tệp thay đổi
    const filePreviewUrl = useMemo(() => {
        if (file) {
            return URL.createObjectURL(file);
        }
        return null;
    }, [file]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            // Dọn dẹp URL cũ trước khi tạo URL mới
            if (filePreviewUrl) {
                URL.revokeObjectURL(filePreviewUrl); 
            }
            setFile(e.target.files[0]);
            setError(null);
            setResults([]); // Xóa kết quả cũ khi chọn tệp mới
        }
    };

    const handleSubmit = useCallback(async () => {
        if (!file) {
            setError("Vui lòng chọn một tệp bài kiểm tra.");
            return;
        }

        setLoading(true);
        setError(null);
        setResults([]);

        try {
            // NOTE: Cần cập nhật generateGradeFromImage nếu muốn sử dụng additionalColumns
            const data = await generateGradeFromImage(file); 
            setResults(data);
        } catch (err) {
            console.error("Lỗi:", err);
            setError((err as Error).message || "Đã xảy ra lỗi trong quá trình xử lý.");
        } finally {
            setLoading(false);
        }
    }, [file]);

    // Dọn dẹp URL khi component unmount
    React.useEffect(() => {
        return () => {
            if (filePreviewUrl) {
                URL.revokeObjectURL(filePreviewUrl);
            }
        };
    }, [filePreviewUrl]);


    return (
        // CONTAINER CHUNG: CHẾ ĐỘ TỐI - Nền màu xanh đen đậm (Navy Blue)
        <div className="min-h-screen bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
            {/* CARD NỘI DUNG: CHẾ ĐỘ TỐI - Nền tối, shadow nhẹ */}
            <div className="max-w-4xl mx-auto bg-gray-800 shadow-2xl rounded-xl p-8 sm:p-10 border border-gray-700">
                
                {/* THANH ĐIỀU HƯỚNG MẪU */}
                <div className="flex justify-between items-center mb-10">
                    <h2 className="text-xl font-semibold text-gray-300">Gemini Test Score Extractor</h2>
                    {/* Nút Chọn Màu Nhấn */}
                    <button className="flex items-center text-white bg-blue-600 hover:bg-blue-700 rounded-full px-4 py-2 text-sm">
                        Chọn Màu Nhấn: 
                        <div className="w-4 h-4 rounded-full bg-indigo-400 ml-2 border-2 border-white"></div>
                    </button>
                </div>

                {/* TIÊU ĐỀ: Màu Sáng/Deep Blue, căn giữa, font lớn hơn, thêm hiệu ứng nhẹ */}
                <h1 className="text-4xl font-extrabold text-blue-400 text-center mb-2 flex items-center justify-center">
                    Trích xuất điểm thi tự động (Gemini)
                </h1>
                <p className="text-center text-gray-400 mb-10 text-lg">
                    Ứng dụng đã được nâng cấp với khả năng phân tích và tùy chỉnh cột.
                </p>

                {/* KHU VỰC NHẬP CỘT THÊM - Đã chỉnh lại màu và text */}
                <div className="mb-8">
                    <label htmlFor="additional-cols" className="block text-sm font-medium text-gray-300 mb-2">
                        Cột Cần Trích Xuất Thêm (Ngoài Tên & Điểm):
                    </label>
                    <input
                        id="additional-cols"
                        type="text"
                        value={additionalColumns}
                        onChange={(e) => setAdditionalColumns(e.target.value)}
                        className="w-full px-4 py-3 border border-blue-500 rounded-lg text-lg 
                                   bg-gray-700 text-white placeholder-gray-500 
                                   focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Mã học sinh, Môn học,..."
                    />
                     <p className="mt-2 text-sm text-gray-500">
                        Theo thao tác này sẽ cập nhật tiêu đề bảng và dữ liệu CSV (lưu tự động).
                    </p>
                </div>


                {/* KHU VỰC UPLOAD - Đã chuyển sang một vùng thả tệp duy nhất, lớn */}
                <div className="space-y-8">
                    
                    {/* Vùng Upload chính (Label) - KHU VỰC THẢ FILE LỚN */}
                    <label 
                        className={`w-full p-12 border-2 border-dashed rounded-xl transition duration-300 cursor-pointer block h-64 flex flex-col items-center justify-center
                                   ${file 
                                       ? 'border-blue-500 bg-gray-700' 
                                       : 'border-blue-500 hover:bg-gray-700 bg-gray-900' // Sử dụng border-blue-500 (màu đậm) cho vùng drop zone theo mẫu
                                   }`}
                        htmlFor="file-upload"
                    >
                        <div className="text-center">
                            {file ? (
                                <>
                                    <img 
                                        src={filePreviewUrl || undefined} 
                                        alt="File Preview" 
                                        className="max-h-24 object-contain rounded-md mx-auto mb-4"
                                    />
                                    <p className="mt-4 text-lg font-semibold text-white">
                                        {file.name}
                                    </p>
                                    <p className="text-sm text-gray-400">
                                        Dung lượng: {(file.size / 1024 / 1024).toFixed(2)} MB
                                    </p>
                                </>
                            ) : (
                                <>
                                    <UploadIcon className="mx-auto w-12 h-12 text-gray-400" />
                                    <p className="mt-4 text-lg font-semibold text-white">
                                        Kéo và thả file tại đây
                                    </p>
                                    <button className="mt-2 px-6 py-2 border border-transparent text-sm font-medium rounded-full text-white bg-blue-600 hover:bg-blue-700 transition duration-150">
                                        CHỌN FILE
                                    </button>
                                </>
                            )}
                        </div>
                        <input
                            id="file-upload"
                            type="file"
                            accept="image/jpeg, image/png"
                            onChange={handleFileChange}
                            className="sr-only"
                            disabled={loading}
                        />
                    </label>

                    {/* NÚT XỬ LÝ: Font lớn hơn, thêm trạng thái loading với SpinnerIcon */}
                    <button
                        onClick={handleSubmit}
                        disabled={!file || loading}
                        className="w-full py-3 px-4 border border-transparent rounded-xl text-xl font-bold text-white 
                                   bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500 transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed
                                   flex items-center justify-center"
                    >
                        {loading ? (
                            <>
                                <SpinnerIcon className="w-5 h-5 mr-3 animate-spin" />
                                Đang xử lý...
                            </>
                        ) : 'Xử Lý và Nhập Điểm'}
                    </button>
                </div>
                
                {/* HIỂN THỊ LỖI (Đổi màu cho Dark Mode) */}
                {error && (
                    <div className="mt-8 p-4 bg-red-800 border border-red-600 text-red-300 rounded-lg shadow-sm">
                        <p className="font-medium">Lỗi: {error}</p>
                    </div>
                )}

                {/* HIỂN THỊ KẾT QUẢ: Tăng font và margin */}
                {results.length > 0 && (
                    <div className="mt-10 pt-6 border-t border-gray-700">
                        <h2 className="text-2xl font-bold text-gray-200 mb-5 flex items-center">
                            <ClipboardListIcon className="w-6 h-6 mr-2 text-blue-400" />
                            Kết Quả Trích Xuất Tự Động
                        </h2>
                        <ResultsTable results={results} />
                    </div>
                )}
                
                {/* FOOTER: Powered by Google Gemini */}
                 <div className="mt-10 pt-6 text-center text-gray-500 border-t border-gray-700">
                     Powered by Google Gemini
                 </div>
            </div>
        </div>
    );
};

export default App;
