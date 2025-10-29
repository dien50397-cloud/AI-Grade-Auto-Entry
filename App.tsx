// App.tsx

import React, { useState, useCallback, useMemo } from 'react'; // Import useMemo
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
            const data = await generateGradeFromImage(file); 
            setResults(data);
        } catch (err) {
            console.error("Lỗi:", err);
            setError((err as Error).message || "Đã xảy ra lỗi trong quá trình xử lý.");
        } finally {
            setLoading(false);
            // Không cần revokeObjectURL ở đây vì nó được xử lý bởi useMemo/handleFileChange
        }
    }, [file]); // Loại bỏ filePreviewUrl khỏi dependency array để tránh lỗi.

    // Dọn dẹp URL khi component unmount
    React.useEffect(() => {
        return () => {
            if (filePreviewUrl) {
                URL.revokeObjectURL(filePreviewUrl);
            }
        };
    }, [filePreviewUrl]);


    return (
        // CONTAINER CHUNG: Thay thế nền trắng bằng màu xanh nhạt nhẹ (sky-50) để làm nổi bật card nội dung, tăng padding
        <div className="min-h-screen bg-sky-50 py-12 px-4 sm:px-6 lg:px-8">
            {/* CARD NỘI DUNG: Nâng cao shadow và bo tròn, mở rộng max-w */}
            <div className="max-w-4xl mx-auto bg-white shadow-2xl rounded-xl p-8 sm:p-10 border border-gray-100">
                
                {/* TIÊU ĐỀ: Màu Deep Blue, căn giữa, font lớn hơn, thêm hiệu ứng nhẹ */}
                <h1 className="text-4xl font-extrabold text-blue-800 text-center mb-2 flex items-center justify-center">
                    <SparklesIcon className="w-8 h-8 mr-2 text-blue-600 animate-pulse" />
                    AI Grade Auto Entry
                </h1>
                <p className="text-center text-gray-500 mb-10 text-lg">
                    Hệ thống tự động trích xuất và nhập điểm từ bài kiểm tra.
                </p>

                {/* KHU VỰC UPLOAD VÀ XỬ LÝ */}
                <div className="space-y-8">
                    
                    {/* INPUT/UPLOAD SECTION - Cải thiện giao diện responsive và trực quan */}
                    <div className="flex flex-col md:flex-row gap-6">
                         {/* Vùng xem trước tệp */}
                        <div className="w-full md:w-1/3 flex-shrink-0 bg-gray-100 rounded-xl p-4 flex items-center justify-center border-2 border-dashed border-gray-300">
                            {filePreviewUrl ? (
                                <img 
                                    src={filePreviewUrl} 
                                    alt="File Preview" 
                                    className="max-h-52 object-contain rounded-md"
                                />
                            ) : (
                                <div className="text-center text-gray-500 py-10">
                                    <UploadIcon className="mx-auto w-10 h-10 mb-2" />
                                    <p>Chưa chọn tệp</p>
                                </div>
                            )}
                        </div>

                        {/* Vùng Upload chính (Label) */}
                        <label 
                            className={`w-full md:w-2/3 p-6 border-2 border-dashed rounded-xl transition duration-300 cursor-pointer block 
                                       ${file 
                                           ? 'border-blue-600 bg-blue-50' 
                                           : 'border-gray-400 hover:border-blue-500 hover:bg-gray-100 bg-white'
                                       }`}
                            htmlFor="file-upload"
                        >
                            <div className="text-center">
                                <UploadIcon className={`mx-auto w-12 h-12 ${file ? 'text-blue-700' : 'text-gray-500'}`} />
                                
                                <p className="mt-4 text-lg font-semibold text-gray-900">
                                    {file ? file.name : "Chọn hoặc kéo thả tệp bài kiểm tra (JPEG/PNG)"}
                                </p>
                                <p className="text-sm text-gray-500">
                                    {file ? `Dung lượng: ${(file.size / 1024 / 1024).toFixed(2)} MB` : "Tối đa 5MB"}
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
                                   bg-blue-700 hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-300 transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed
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
                
                {/* HIỂN THỊ LỖI */}
                {error && (
                    <div className="mt-8 p-4 bg-red-50 border border-red-300 text-red-600 rounded-lg shadow-sm">
                        <p className="font-medium">Lỗi: {error}</p>
                    </div>
                )}

                {/* HIỂN THỊ KẾT QUẢ: Tăng font và margin */}
                {results.length > 0 && (
                    <div className="mt-10 pt-6 border-t border-gray-200">
                        <h2 className="text-2xl font-bold text-gray-800 mb-5 flex items-center">
                            <ClipboardListIcon className="w-6 h-6 mr-2 text-blue-700" />
                            Kết Quả Trích Xuất Tự Động
                        </h2>
                        <ResultsTable results={results} />
                    </div>
                )}
                
            </div>
        </div>
    );
};

export default App;
