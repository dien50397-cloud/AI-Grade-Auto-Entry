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
        <div className="min-h-screen bg-gray-900 py-0 px-0 sm:px-0 lg:px-0">
            {/* THANH ĐIỀU HƯỚNG MẪU (Mock Navigation Bar) - Nền tối đậm */}
            <header className="w-full bg-gray-950 px-4 py-3 flex justify-between items-center border-b border-gray-800">
                <h2 className="text-base font-semibold text-gray-300">Gemini Test Score Extractor</h2>
                <div className="flex items-center space-x-2">
                    {/* Biểu tượng ba chấm (Mock) */}
                    <div className="text-gray-400">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                        </svg>
                    </div>
                    {/* Nút Chọn Màu Nhấn */}
                    <button className="flex items-center text-sm text-white px-2 py-1 rounded-full border border-gray-600 bg-gray-800">
                        Chọn Màu Nhấn: 
                        <div className="w-3 h-3 rounded-full bg-indigo-400 ml-2 border-2 border-white"></div>
                    </button>
                </div>
            </header>


            {/* CARD NỘI DUNG: CHẾ ĐỘ TỐI - Mở rộng padding top/bottom */}
            <div className="max-w-4xl mx-auto bg-gray-900 pt-10 pb-12 px-4 sm:px-6 lg:px-8">
                
                {/* TIÊU ĐỀ: Màu Xanh Sáng, căn giữa */}
                <h1 className="text-4xl font-extrabold text-blue-400 text-center mb-2">
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
                        // Màu nền đậm hơn, border màu xanh
                        className="w-full px-4 py-3 border border-blue-500 rounded-lg text-lg 
                                   bg-gray-800 text-white placeholder-gray-500 
                                   focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Mã học sinh, Môn học,..."
                    />
                     <p className="mt-2 text-sm text-gray-500">
                        Theo thao tác này sẽ cập nhật tiêu đề bảng và dữ liệu CSV (lưu tự động).
                    </p>
                </div>


                {/* KHU VỰC UPLOAD - Đã chuyển sang một vùng thả tệp duy nhất, lớn, căn giữa */}
                <div className="space-y-8">
                    
                    {/* Vùng Upload chính (Label) - KHU VỰC THẢ FILE LỚN */}
                    <label 
                        className={`w-full p-12 border-2 border-dashed rounded-xl transition duration-300 cursor-pointer block h-64 flex flex-col items-center justify-center
                                   ${file 
                                       ? 'border-blue-500 bg-gray-700' 
                                       // Nền màu xanh đen đậm (gray-800) với border màu xanh nhạt (blue-500)
                                       : 'border-blue-500 hover:bg-gray-800 bg-gray-800' 
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

                    {/* NÚT XỬ LÝ (Đặt ở cuối khu vực này nếu cần, hoặc di chuyển lên trên) */}
                    {/* Tôi sẽ giữ lại nút xử lý ở vị trí cũ sau khu vực thả tệp */}
                </div>
                
                {/* HIỂN THỊ KẾT QUẢ/FOOTER */}
                {/* ... (Giữ nguyên phần còn lại của App.tsx) ... */}
                {/* HIỂN THỊ LỖI (Đổi màu cho Dark Mode) */}
                {error && (
                    <div className="mt-8 p-4 bg-red-800 border border-red-600 text-red-300 rounded-lg shadow-sm">
                        <p className="font-medium">Lỗi: {error}</p>
                    </div>
                )}
                
                {/* NÚT XỬ LÝ */}
                 <button
                    onClick={handleSubmit}
                    disabled={!file || loading}
                    className="w-full py-3 px-4 border border-transparent rounded-xl text-xl font-bold text-white 
                               bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500 transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed
                               flex items-center justify-center mt-8" // Thêm margin top
                >
                    {loading ? (
                        <>
                            <SpinnerIcon className="w-5 h-5 mr-3 animate-spin" />
                            Đang xử lý...
                        </>
                    ) : 'Xử Lý và Nhập Điểm'}
                </button>


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
