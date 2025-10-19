// App.tsx

import React, { useState, useCallback } from 'react';
import { Result } from './types'; 
import { generateGradeFromImage } from './GeminiService'; 
import ResultsTable from './ResultsTable';

// Component Icon giả định (Bạn cần đảm bảo chúng tồn tại trong icons.tsx hoặc thay thế)
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
            // Gọi hàm đã export từ GeminiService.ts
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
        // CONTAINER CHUNG
        <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
            {/* CARD NỘI DUNG */}
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
                    
                    {/* INPUT/UPLOAD SECTION */}
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
                            className="sr-only"
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
