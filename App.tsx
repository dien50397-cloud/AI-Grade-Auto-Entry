// App.tsx

import React, { useState, useCallback } from 'react';
import { Result } from './types'; // Giả định bạn có tệp types.ts định nghĩa Result
import { generateGradeFromImage } from './GeminiService'; // Giả định bạn có GeminiService
import ResultsTable from './ResultsTable';
import { UploadIcon, ClipboardListIcon, SparklesIcon } from './icons'; // Giả định bạn có tệp icons.tsx

const App: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [results, setResults] = useState<Result[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
            setError(null);
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
            console.error(err);
            setError("Lỗi xử lý. Vui lòng kiểm tra API Key hoặc định dạng tệp.");
        } finally {
            setLoading(false);
        }
    }, [file]);

    return (
        // CONTAINER CHUNG: Nền xám nhạt, chiều cao tối thiểu đầy đủ (min-h-screen)
        <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
            {/* CARD NỘI DUNG: Giới hạn độ rộng, căn giữa, nền trắng, bo tròn, bóng đổ */}
            <div className="max-w-4xl mx-auto bg-white shadow-2xl rounded-2xl p-6 sm:p-10">
                
                {/* TIÊU ĐỀ */}
                <h1 className="text-3xl font-extrabold text-indigo-700 text-center mb-4 flex items-center justify-center">
                    <SparklesIcon className="w-8 h-8 mr-2" />
                    AI Grade Auto Entry
                </h1>
                <p className="text-center text-gray-500 mb-8">
                    Hệ thống tự động trích xuất và nhập điểm từ bài kiểm tra bằng Gemini API.
                </p>

                {/* KHU VỰC UPLOAD VÀ XỬ LÝ */}
                <div className="space-y-6">
                    
                    {/* INPUT/UPLOAD SECTION - TẠO VÙNG KÉO THẢ GIẢ */}
                    <label 
                        className={`p-8 border-2 border-dashed rounded-xl transition duration-300 ease-in-out cursor-pointer block 
                                   ${file ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-indigo-400 bg-gray-50'}`}
                        htmlFor="file-upload"
                    >
                        <div className="text-center">
                            <UploadIcon className={`mx-auto w-12 h-12 ${file ? 'text-green-600' : 'text-indigo-400'}`} />
                            
                            <p className="mt-2 text-sm font-semibold text-gray-900">
                                {file ? `Tệp đã chọn: ${file.name}` : "Kéo thả hoặc nhấn để chọn bài kiểm tra (JPEG/PNG)"}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                                Dung lượng tối đa: 4MB
                            </p>
                        </div>
                        <input
                            id="file-upload"
                            type="file"
                            accept="image/jpeg, image/png"
                            onChange={handleFileChange}
                            className="sr-only" // Ẩn input mặc định
                            disabled={loading}
                        />
                    </label>

                    {/* NÚT XỬ LÝ */}
                    <button
                        onClick={handleSubmit}
                        disabled={!file || loading}
                        className="w-full py-3 px-4 border border-transparent rounded-xl shadow-lg text-lg font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150 ease-in-out disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Đang phân tích...' : '⚡ Xử Lý và Nhập Điểm'}
                    </button>
                </div>
                
                {/* HIỂN THỊ LỖI */}
                {error && (
                    <div className="mt-6 p-4 bg-red-100 border-l-4 border-red-500 text-red-700 rounded-lg">
                        <p className="font-bold">Lỗi:</p>
                        <p>{error}</p>
                    </div>
                )}

                {/* HIỂN THỊ KẾT QUẢ */}
                {results.length > 0 && (
                    <div className="mt-10 pt-6 border-t border-gray-200">
                        <h2 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center">
                            <ClipboardListIcon className="w-6 h-6 mr-2 text-indigo-600" />
                            Kết Quả Trích Xuất
                        </h2>
                        <ResultsTable results={results} />
                    </div>
                )}
                
            </div>
        </div>
    );
};

export default App;
