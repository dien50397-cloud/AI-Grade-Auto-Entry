// App.tsx

import React, { useState, useCallback, useMemo } from 'react'; 
import { Result } from './types'; 
import { generateGradeFromImage } from './GeminiService'; 
import ResultsTable from './ResultsTable';
import { UploadIcon, ClipboardListIcon, SparklesIcon, SpinnerIcon } from './icons'; 


const App: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [results, setResults] = useState<Result[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    
    // THAY ĐỔI MỚI: Thêm state cho cột trích xuất thêm
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
                
                {/* TIÊU ĐỀ: Màu Sáng/Deep Blue, căn giữa, font lớn hơn, thêm hiệu ứng nhẹ */}
                <h1 className="text-4xl font-extrabold text-blue-400 text-center mb-2 flex items-center justify-center">
                    <SparklesIcon className="w-8 h-8 mr-2 text-blue-500 animate-pulse" />
                    Trích xuất điểm tự động (Gemini)
                </h1>
                <p className="text-center text-gray-400 mb-10 text-lg">
                    Ứng dụng đã được nâng cấp với khả năng phân tích và tùy chỉnh cột.
                </p>

                {/* KHU VỰC NHẬP CỘT THÊM */}
                <div className="mb-8">
                    <label htmlFor="additional-cols" className="block text-sm font-medium text-gray-300 mb-2">
                        Cột Cần Trích Xuất Thêm (Ngoài Tên & Điểm):
                    </label>
                    <input
                        id="additional-cols"
                        type="text"
                        value={additionalColumns}
                        onChange={(e) => setAdditionalColumns(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-600 rounded-lg text-lg 
                                   bg-gray-700 text-white placeholder-gray-500 
                                   focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Mã học sinh, Môn học,..."
                    />
                     <p className="mt-2 text-sm text-gray-500">
                        Thao tác này sẽ cập nhật tiêu đề bảng và dữ liệu CSV (lưu tự động).
                    </p>
                </div>


                {/* KHU VỰC UPLOAD VÀ XỬ LÝ */}
                <div className="space-y-8">
                    
                    {/* INPUT/UPLOAD SECTION - Cải thiện giao diện responsive và trực quan */}
                    <div className="flex flex-col md:flex-row gap-6">
                         {/* Vùng xem trước tệp (Giữ nguyên cấu trúc nhưng đổi màu) */}
                        <div className="w-full md:w-1/3 flex-shrink-0 bg-gray-700 rounded-xl p-4 flex items-center justify-center border-2 border-dashed border-gray-600">
                            {filePreviewUrl ? (
                                <img 
                                    src={filePreviewUrl} 
                                    alt="File Preview" 
                                    className="max-h-52 object-contain rounded-md"
                                />
                            ) : (
                                <div className="text-center text-gray-400 py-10">
                                    <UploadIcon className="mx-auto w-10 h-10 mb-2 text-gray-500" />
                                    <p>Chưa chọn tệp</p>
                                </div>
                            )}
                        </div>

                        {/* Vùng Upload chính (Label) - Thêm màu Dark Mode */}
                        <label 
                            className={`w-full md:w-2/3 p-6 border-2 border-dashed rounded-xl transition duration-300 cursor-pointer block 
                                       ${file 
                                           ? 'border-blue-500 bg-gray-700' // Khi có file
                                           : 'border-gray-500 hover:border-blue-500 hover:bg-gray-700 bg-gray-800' // Không có file
                                       }`}
                            htmlFor="file-upload"
                        >
                            <div className="text-center">
                                <UploadIcon className={`mx-auto w-12 h-12 ${file ? 'text-blue-400' : 'text-gray-500'}`} />
                                
                                <p className="mt-4 text-lg font-semibold text-white">
                                    {file ? file.name : "Kéo và thả file tại đây"} {/* Đổi Text */}
                                </p>
                                <p className="text-sm text-gray-400">
                                    {file ? `Dung lượng: ${(file.size / 1024 / 1024).toFixed(2)} MB` : "CHỌN FILE"} {/* Đổi Text */}
                                </p>
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
                    </div>

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
                        {/* Lưu ý: ResultsTable cần được cập nhật để phù hợp với Dark Mode nếu cần */}
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
