// App.tsx

import React, { useState, useCallback } from 'react';
import { Result } from './types'; 
import { generateGradeFromImage } from './GeminiService'; 
import ResultsTable from './ResultsTable';

// Component Icon giả định (dùng lại từ trước)
const UploadIcon = ({ className = '' }) => <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m0 0l6-6m-6 6l-6-6m6-6v6" /></svg>;
const ClipboardListIcon = ({ className = '' }) => <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.25c0-1.036-.84-1.875-1.875-1.875h-8.25c-1.036 0-1.875.84-1.875 1.875v2.25m12 0c.828 0 1.5.672 1.5 1.5v3c0 .828-.672 1.5-1.5 1.5H7.5c-.828 0-1.5-.672-1.5-1.5v-3c0-.828.672-1.5 1.5-1.5m12 0a1.5 1.5 0 01-1.5 1.5h-9a1.5 1.5 0 01-1.5-1.5m12 0c.828 0 1.5.672 1.5 1.5v3c0 .828-.672 1.5-1.5 1.5H7.5c-.828 0-1.5-.672-1.5-1.5v-3c0-.828.672-1.5 1.5-1.5m0-11.25c.828 0 1.5.672 1.5 1.5v3c0 .828-.672 1.5-1.5 1.5H7.5c-.828 0-1.5-.672-1.5-1.5v-3c0-.828.672-1.5 1.5-1.5" /></svg>;
const SparklesIcon = ({ className = '' }) => <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.102a.562.562 0 00.474.341l5.523.447a.562.562 0 01.307.912l-4.14 3.791a.562.562 0 00-.195.589l1.252 5.271a.562.562 0 01-.84.62l-4.793-2.616a.562.562 0 00-.546 0l-4.793 2.616a.562.562 0 01-.84-.62l1.253-5.271a.562.562 0 00-.195-.589l-4.14-3.791a.562.562 0 01.307-.912l5.523-.447a.562.562 0 00.474-.341l2.125-5.102z" /></svg>;


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
            console.error("Lỗi:", err);
            setError((err as Error).message || "Đã xảy ra lỗi trong quá trình xử lý.");
        } finally {
            setLoading(false);
        }
    }, [file]);

    return (
        // CONTAINER CHUNG: Thay thế nền xám bằng màu trắng (màu gốc) hoặc xanh nhạt
        <div className="min-h-screen bg-white py-8 px-4 sm:px-6 lg:px-8">
            {/* CARD NỘI DUNG: Giữ lại shadow và bo tròn nhẹ */}
            <div className="max-w-3xl mx-auto bg-white shadow-xl rounded-lg p-6 sm:p-8 border border-gray-200">
                
                {/* TIÊU ĐỀ: Màu Deep Blue */}
                <h1 className="text-3xl font-bold text-blue-800 text-center mb-6 flex items-center justify-center">
                    <SparklesIcon className="w-7 h-7 mr-2 text-blue-600" />
                    AI Grade Auto Entry
                </h1>
                <p className="text-center text-gray-600 mb-8">
                    Hệ thống tự động trích xuất và nhập điểm từ bài kiểm tra.
                </p>

                {/* KHU VỰC UPLOAD VÀ XỬ LÝ */}
                <div className="space-y-6">
                    
                    {/* INPUT/UPLOAD SECTION - Vùng chọn tệp */}
                    <label 
                        className={`p-6 border-2 border-dashed rounded-lg transition duration-300 cursor-pointer block 
                                   ${file ? 'border-blue-600 bg-blue-50' : 'border-gray-400 hover:border-blue-500 bg-gray-50'}`}
                        htmlFor="file-upload"
                    >
                        <div className="text-center">
                            <UploadIcon className={`mx-auto w-10 h-10 ${file ? 'text-blue-700' : 'text-gray-500'}`} />
                            
                            <p className="mt-2 text-sm font-medium text-gray-900">
                                {file ? `Tệp đã chọn: ${file.name}` : "Chọn hoặc kéo thả tệp bài kiểm tra (JPEG/PNG)"}
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

                    {/* NÚT XỬ LÝ: Màu Deep Blue */}
                    <button
                        onClick={handleSubmit}
                        disabled={!file || loading}
                        className="w-full py-2.5 px-4 border border-transparent rounded-lg text-lg font-semibold text-white 
                                   bg-blue-700 hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-300 transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Đang xử lý...' : 'Xử Lý và Nhập Điểm'}
                    </button>
                </div>
                
                {/* HIỂN THỊ LỖI */}
                {error && (
                    <div className="mt-6 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                        <p className="font-medium">{error}</p>
                    </div>
                )}

                {/* HIỂN THỊ KẾT QUẢ */}
                {results.length > 0 && (
                    <div className="mt-8 pt-6 border-t border-gray-300">
                        <h2 className="text-xl font-semibold text-gray-700 mb-4 flex items-center">
                            <ClipboardListIcon className="w-5 h-5 mr-2 text-blue-700" />
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
