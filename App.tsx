import React, { useState, useCallback, useRef, useEffect } from 'react';

// =======================================================
// 1. TYPES & HẰNG SỐ
// =======================================================

/**
 * Định nghĩa kiểu dữ liệu cho kết quả trích xuất
 * @typedef {object} StudentScore
 * @property {string} ten_hoc_sinh
 * @property {string} diem_so
 */

/**
 * Định nghĩa kiểu dữ liệu cho kết quả hiển thị
 * @typedef {object} ExtractionResult
 * @property {'success' | 'error'} status
 * @property {string} fileName
 * @property {string} ten_hoc_sinh
 * @property {string} diem_so
 * @property {string} [errorMessage]
 */

// KHAI BÁO CÁC HẰNG SỐ CỦA DỊCH VỤ (KHÔNG BAO GỒM API KEY)
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent";

/**
 * Hàm chuyển đổi tệp hình ảnh thành định dạng Base64
 */
const fileToGenerativePart = async (file) => {
    const base64EncodedDataPromise = new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(file);
    });
    return {
        inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
    };
};

/**
 * Hàm gọi API Gemini để trích xuất dữ liệu (Chấp nhận apiKey như một tham số)
 * @param {File} imageFile 
 * @param {string} apiKey - Phải được truyền từ React State
 * @returns {Promise<StudentScore[]>}
 */
const extractDataFromImage = async (imageFile, apiKey) => {
    // API Key được truyền từ state component, không cần kiểm tra lại ở đây.
    if (!apiKey) {
         throw new Error("API Key chưa được thiết lập. (Lỗi Runtime)");
    }

    const model = 'gemini-2.5-flash-preview-05-20';
    const imagePart = await fileToGenerativePart(imageFile);
    
    // Prompt yêu cầu trích xuất tên và điểm
    const prompt = `Bạn là một CHUYÊN GIA PHÂN TÍCH BÀI KIỂM TRA. Từ hình ảnh danh sách điểm, hãy trích xuất **TẤT CẢ** các cặp Tên học sinh và Tổng điểm mà bạn tìm thấy. 
YÊU CẦU: 1. Trích xuất tất cả học sinh. 2. Tên phải giữ nguyên Tiếng Việt có dấu. 3. Điểm số phải là giá trị số. Trả về MẢNG JSON.`;

    const responseSchema = {
        type: "ARRAY",
        items: {
            type: "OBJECT",
            properties: {
                ten_hoc_sinh: { type: "STRING", description: "Họ tên đầy đủ của học sinh." },
                diem_so: { type: "STRING", description: "Điểm số cuối cùng (ví dụ: 8.5, 10.0)." }
            },
            required: ['ten_hoc_sinh', 'diem_so'],
        },
    };

    const payload = {
        contents: [{ parts: [imagePart, { text: prompt }] }],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: responseSchema,
        },
    };

    // Áp dụng tính năng Retry (Backoff) để xử lý lỗi mạng/throttling
    const MAX_RETRIES = 3;
    let lastError = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const result = await response.json();
                const jsonText = result?.candidates?.[0]?.content?.parts?.[0]?.text;

                if (!jsonText) {
                    throw new Error("Không nhận được nội dung phản hồi từ API.");
                }
            
                const parsedData = JSON.parse(jsonText);
                if (!Array.isArray(parsedData)) {
                    throw new Error("Đầu ra JSON không phải là Mảng hợp lệ.");
                }
                return parsedData;

            } else if (response.status === 429 || response.status >= 500) {
                lastError = new Error(`API call failed with status ${response.status}. Retrying...`);
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
                continue;
            } else {
                throw new Error(`API call failed with status ${response.status}: ${response.statusText}`);
            }

        } catch (e) {
            if (e.message.includes('Retrying')) {
                lastError = e;
                continue;
            }
            throw new Error(`Lỗi mạng hoặc cú pháp: ${e.message}`);
        }
    }

    if (lastError) {
        throw new Error(`API đã thất bại sau ${MAX_RETRIES} lần thử. ${lastError.message}`);
    }
};

// =======================================================
// 2. ICON COMPONENTS
// =======================================================

const UploadIcon = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-upload">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" />
    </svg>
);

const SpinnerIcon = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-loader-2 animate-spin">
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
);

const CsvIcon = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-file-text">
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" />
    </svg>
);


// =======================================================
// 3. RESULTS TABLE COMPONENT
// =======================================================

/**
 * Component hiển thị kết quả trích xuất
 * @param {{results: ExtractionResult[]}} props
 */
const ResultsTable = ({ results }) => {
    if (results.length === 0) return null;

    const successfulCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    return (
        <div className="mt-10 overflow-x-auto shadow-lg rounded-xl">
            <h2 className="text-xl font-bold p-4 bg-gray-700 text-gray-100 rounded-t-xl">
                Kết quả Trích xuất ({successfulCount} thành công, {errorCount} lỗi)
            </h2>
            <table className="min-w-full divide-y divide-gray-600">
                <thead className="bg-gray-600">
                    <tr>
                        {/* Cột 1: Trạng thái (Fixed width) */}
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-300 uppercase tracking-wider w-auto">Trạng thái</th>
                        {/* Cột 2: Tên Học sinh (Takes remaining space) */}
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-300 uppercase tracking-wider w-full">Tên Học sinh</th>
                        {/* Cột 3: Điểm số (Fixed small width) */}
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-300 uppercase tracking-wider w-20">Điểm số</th>
                    </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                    {results.map((result, index) => (
                        <tr key={index} className={result.status === 'error' ? 'bg-red-900/20 hover:bg-red-900/40 transition-colors' : 'hover:bg-indigo-900/20 transition-colors'}>
                            <td className="px-4 py-3 whitespace-nowrap w-auto">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${result.status === 'success' ? 'bg-green-700 text-green-100' : 'bg-red-700 text-red-100'}`}>
                                    {result.status === 'success' ? 'Thành công' : 'Lỗi'}
                                </span>
                            </td>
                            {/* Cột Tên Học sinh: Cho phép wrap text và chiếm không gian */}
                            <td className="px-4 py-3 text-sm text-gray-300 font-medium w-full break-words">{result.ten_hoc_sinh}</td>
                            {/* Cột Điểm số: Giữ cố định */}
                            <td className="px-4 py-3 text-sm font-bold text-gray-100 whitespace-nowrap w-20 text-right">
                                {result.status === 'success' ? result.diem_so : (
                                    <span className="text-red-400 italic text-xs" title={result.errorMessage}>
                                        {result.errorMessage || 'Lỗi chung'}
                                    </span>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};


// =======================================================
// 4. MAIN APP COMPONENT
// =======================================================

export default function App() {
    /** @type {[File[], React.Dispatch<React.SetStateAction<File[]>>]} */
    const [files, setFiles] = useState([]);
    /** @type {[ExtractionResult[], React.Dispatch<React.SetStateAction<ExtractionResult[]>>]} */
    const [results, setResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [dragActive, setDragActive] = useState(false);
    const [processingStatus, setProcessingStatus] = useState('');
    const [accentColor, setAccentColor] = useState('#4f46e5'); // Indigo đậm mặc định (Deep Blue Theme)
    const fileInputRef = useRef(null);

    // NEW STATE: Lưu trữ API Key ở Runtime (Khởi tạo là null)
    const [apiKey, setApiKey] = useState(null);

    // Sử dụng useEffect để khởi tạo API Key an toàn sau khi component đã render
    useEffect(() => {
        let key = "";
        
        // 1. Cố gắng lấy key từ biến môi trường Netlify/Vite (Cú pháp này được xử lý trong quá trình build)
        try {
            if (typeof import.meta !== 'undefined' && import.meta.env) {
                key = import.meta.env.VITE_GEMINI_API_KEY || "";
            }
        } catch (e) {
            // Bỏ qua lỗi cú pháp/tham chiếu nếu môi trường không hỗ trợ
        }
        
        // 2. Kiểm tra biến an toàn của code editor (nếu tồn tại)
        if (typeof __api_key !== 'undefined') {
            key = __api_key;
        }

        setApiKey(key);
    }, []);

    // Hàm gọi API Gemini (Sử dụng useCallback để đảm bảo hiệu suất)
    const extractDataFromImageCallback = useCallback(async (imageFile) => {
        // Kiểm tra Key trước khi gọi API
        if (!apiKey) {
            throw new Error("API Key chưa được thiết lập. Vui lòng kiểm tra biến môi trường.");
        }
        return extractDataFromImage(imageFile, apiKey);
    }, [apiKey]);


    // Hàm tải về CSV (ĐÃ SỬA LỖI DẤU CHẤM PHẨY)
    const downloadCSV = useCallback((finalResults) => {
        const successfulResults = finalResults.filter(r => r.status === 'success');
        if (successfulResults.length === 0) return;

        // CHỈ BAO GỒM: Tên học sinh và Điểm số
        // SỬ DỤNG DẤU CHẤM PHẨY (;) LÀM KÝ TỰ PHÂN TÁCH CHO EXCEL VIỆT NAM
        const headers = ['"Tên học sinh"', '"Điểm số"'].join(';'); 
        const rows = successfulResults.map(r =>
            [`"${r.ten_hoc_sinh}"`, `"${r.diem_so}"`].join(';') 
        );

        const csvContent = [headers, ...rows].join('\n');
        
        // Thêm BOM (Byte Order Mark) để đảm bảo hiển thị tiếng Việt có dấu trong Excel
        const blob = new Blob(['\uFEFF', csvContent], { type: 'text/csv;charset=utf-8;' });
        
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'diem_so_hoc_sinh.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, []);

    // Hàm xử lý chính (Auto-processing)
    const handleProcessFiles = useCallback(async (filesToProcess) => {
        if (filesToProcess.length === 0) return;
        setIsLoading(true);
        setResults([]);
        setError(null);
        
        /** @type {ExtractionResult[]} */
        const newResults = [];
        
        for (let i = 0; i < filesToProcess.length; i++) {
            const file = filesToProcess[i];
            setProcessingStatus(`Đang xử lý file ${i + 1} of ${filesToProcess.length}: ${file.name}`);
            
            try {
                // Gọi API để trích xuất dữ liệu
                const extractedData = await extractDataFromImageCallback(file);
                
                if (Array.isArray(extractedData) && extractedData.length > 0) {
                    extractedData.forEach(data => {
                        newResults.push({
                            status: 'success',
                            fileName: file.name, // Giữ lại trong object để tiện theo dõi
                            ten_hoc_sinh: data.ten_hoc_sinh || 'N/A',
                            diem_so: data.diem_so || 'N/A'
                        });
                    });
                } else {
                    newResults.push({
                        status: 'error',
                        fileName: file.name,
                        ten_hoc_sinh: 'N/A',
                        diem_so: 'N/A',
                        errorMessage: 'Không trích xuất được dữ liệu hợp lệ.'
                    });
                }

            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Lỗi không xác định.';
                // Cập nhật lỗi tổng quan nếu là lỗi API Key
                if (errorMessage.includes("API Key chưa được thiết lập")) {
                    setError(errorMessage);
                }
                newResults.push({
                    status: 'error',
                    fileName: file.name,
                    ten_hoc_sinh: 'N/A',
                    diem_so: 'N/A',
                    errorMessage: errorMessage
                });
            }
        }

        setResults(newResults);
        setIsLoading(false);
        setProcessingStatus('');
        
        if (newResults.some(r => r.status === 'success')) {
            downloadCSV(newResults);
        }
        
    }, [downloadCSV, extractDataFromImageCallback]);

    // Xử lý thay đổi tệp (TỰ ĐỘNG XỬ LÝ)
    const handleFileChange = (e) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            setFiles(newFiles);
            setResults([]);
            setError(null);
            if (newFiles.length > 0) {
                handleProcessFiles(newFiles);
            }
        }
    };
    
    // Xử lý kéo thả (TỰ ĐỘNG XỬ LÝ)
    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const newFiles = Array.from(e.dataTransfer.files);
            setFiles(newFiles);
            setResults([]);
            setError(null);
            handleProcessFiles(newFiles);
        }
    };

    // Xử lý sự kiện kéo (Drag events)
    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };
    
    // Kích hoạt input file
    const onButtonClick = () => {
        fileInputRef.current?.click();
    };
    
    // Phần hiển thị TẢI/LỖI API KEY (React sẽ render an toàn)
    if (apiKey === null) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
                <div className="max-w-md w-full bg-gray-800 p-6 rounded-xl shadow-2xl text-center border-l-4 border-indigo-500">
                    <SpinnerIcon className="w-8 h-8 mx-auto mb-4" style={{ color: accentColor }} />
                    <h1 className="text-2xl font-bold text-gray-100">Đang khởi tạo ứng dụng...</h1>
                    <p className="mt-2 text-gray-400">Vui lòng đợi trong giây lát.</p>
                </div>
            </div>
        );
    }
    
    if (!apiKey) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
                <div className="max-w-md w-full bg-gray-800 p-6 rounded-xl shadow-2xl text-center border-l-4 border-red-500">
                    <h1 className="text-2xl font-bold text-red-400 mb-4">Lỗi Cấu hình API</h1>
                    <p className="text-gray-200">
                        Vui lòng thiết lập biến môi trường (Khóa API) để ứng dụng có thể hoạt động.
                    </p>
                    <p className="mt-4 text-sm text-gray-400">
                        Nếu bạn đang triển khai trên Netlify/Vite, đảm bảo biến môi trường là <code className="font-mono bg-gray-700 text-gray-100 p-1 rounded">VITE_GEMINI_API_KEY</code>.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 bg-gray-900" onDragEnter={handleDrag}>
            {/* KHỐI CHỌN MÀU QUANG PHỔ */}
            <div className="absolute top-4 right-4 p-3 bg-gray-800 rounded-xl shadow-md flex items-center space-x-3 z-10 border border-gray-700">
                <label htmlFor="colorPicker" className="text-sm font-semibold text-gray-400">Chọn Màu Nhấn:</label>
                <input
                    id="colorPicker"
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="w-10 h-10 cursor-pointer rounded-full p-0 border-2 overflow-hidden"
                    style={{ borderColor: accentColor }}
                />
            </div>

            <main
                className={`w-full max-w-4xl mx-auto bg-gray-800 p-6 sm:p-8 lg:p-10 rounded-2xl shadow-xl transition-shadow duration-300`}
                style={{ boxShadow: `0 25px 50px -12px ${accentColor}1a, 0 0 0 1px ${accentColor}1a` }}
                >
                <div className="text-center">
                    <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-100" style={{ color: accentColor }}>Trích xuất điểm thi tự động (Gemini)</h1>
                    <p className="mt-2 text-md text-gray-400">Tải ảnh các bài kiểm tra lên để trích xuất tên học sinh và điểm số. Kết quả sẽ tự động tải về file CSV.</p>
                </div>

                <div className="mt-8">
                    <form id="form-file-upload" className="relative w-full" onDragEnter={handleDrag} onSubmit={(e) => e.preventDefault()}>
                        <input
                            ref={fileInputRef}
                            type="file"
                            id="input-file-upload"
                            multiple={true}
                            accept="image/png, image/jpeg, image/jpg"
                            className="hidden"
                            onChange={handleFileChange}
                        />
                        {/* Hộp tải lên ĐÃ TỐI ƯU HÓA (chiều cao giảm, icon lớn hơn) */}
                        <label id="label-file-upload" htmlFor="input-file-upload"
                            className={`h-32 border-2 rounded-xl border-dashed flex flex-col justify-center items-center cursor-pointer transition-all duration-300 hover:shadow-lg`}
                            style={{ borderColor: dragActive ? accentColor : `${accentColor}80`, backgroundColor: dragActive ? `${accentColor}10` : 'rgba(255, 255, 255, 0.05)' }}
                            onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}>
                            
                            <UploadIcon className="w-8 h-8 mb-1" style={{ color: accentColor }} />
                            <p className="font-semibold text-gray-400 text-sm mb-2">Kéo và thả file tại đây</p>
                            
                            <button type="button" onClick={onButtonClick}
                                className="rounded-lg px-4 py-1 text-xs font-bold shadow-md transition-colors transform hover:scale-[1.05] active:scale-[0.98]"
                                style={{ backgroundColor: accentColor, color: 'white' }}>
                                CHỌN FILE
                            </button>
                        </label>
                    </form>
                    
                    {files.length > 0 && (
                        <div className="mt-4 text-sm text-gray-300 border-l-4 p-2 rounded bg-gray-700/50" style={{ borderColor: accentColor }}>
                            <p className="font-bold mb-1" style={{ color: accentColor }}>{files.length} File đã chọn:</p>
                            <ul className="list-disc list-inside max-h-24 overflow-y-auto pl-4">
                                {files.map((file, i) => <li key={i} className="truncate">{file.name}</li>)}
                            </ul>
                        </div>
                    )}
                </div>

                {/* Trạng thái xử lý */}
                <div className="mt-8 flex flex-col sm:flex-row justify-center items-center gap-4">
                    {isLoading && (
                        <div className="flex items-center text-center p-3 rounded-lg shadow-inner bg-gray-700" style={{ borderColor: accentColor }}>
                            <SpinnerIcon className="w-5 h-5 mr-2" style={{ color: accentColor }} />
                            <p className="text-sm font-medium animate-pulse text-gray-300" style={{ color: accentColor }}>{processingStatus || 'Đang chờ xử lý...'}</p>
                        </div>
                    )}
                </div>

                {/* Thông báo lỗi nếu có */}
                {error && <p className="mt-4 text-center text-red-400 font-medium p-3 bg-red-900/40 rounded-lg">{error}</p>}
                
                {/* Nút tải về CSV (chỉ hiển thị khi có kết quả thành công) */}
                {results.some(r => r.status === 'success') && (
                    <div className="mt-6 flex justify-center">
                        <button 
                            onClick={() => downloadCSV(results)} 
                            className="flex items-center gap-2 rounded-xl px-6 py-3 text-white font-bold shadow-lg transition-all transform hover:scale-[1.03] active:scale-[0.98]"
                            style={{ backgroundColor: accentColor, color: 'white' }}
                        >
                            <CsvIcon className="w-5 h-5" />
                            Tải về CSV ({results.filter(r => r.status === 'success').length} kết quả)
                        </button>
                    </div>
                )}
                
                <ResultsTable results={results} />
            </main>
            <footer className="w-full max-w-4xl mx-auto text-center mt-6">
                <p className="text-sm text-gray-500">Powered by Google Gemini</p>
            </footer>
        </div>
    );
}
