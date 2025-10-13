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

const XIcon = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x">
        <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
    </svg>
);


// =======================================================
// 3. IMAGE MODAL COMPONENT (NEW)
// =======================================================

/**
 * Component hiển thị ảnh gốc trong modal
 * @param {{file: File, onClose: function(): void, accentColor: string}} props
 */
const ImageModal = ({ file, onClose, accentColor }) => {
    const [imageUrl, setImageUrl] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImageUrl(reader.result);
                setLoading(false);
            };
            reader.readAsDataURL(file);
        }
    }, [file]);

    if (!file) return null;

    return (
        <div 
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 transition-opacity"
            onClick={onClose}
        >
            <div 
                className="bg-gray-800 rounded-xl max-w-4xl w-full max-h-full overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 flex justify-between items-center border-b border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-100" style={{ color: accentColor }}>
                        Xem trước File Gốc: {file.name}
                    </h3>
                    <button onClick={onClose} className="p-2 rounded-full text-gray-400 hover:bg-gray-700 transition-colors">
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>
                
                {/* Body - Image */}
                <div className="flex-grow overflow-y-auto p-4 flex items-center justify-center">
                    {loading ? (
                        <div className="text-center p-10">
                            <SpinnerIcon className="w-8 h-8 mx-auto mb-3" style={{ color: accentColor }} />
                            <p className="text-gray-400">Đang tải ảnh...</p>
                        </div>
                    ) : (
                        <img 
                            src={imageUrl} 
                            alt={`Review: ${file.name}`} 
                            className="max-w-full max-h-[80vh] object-contain rounded-lg"
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

// =======================================================
// 4. PERFORMANCE SUMMARY COMPONENT
// =======================================================

/**
 * Component hiển thị tóm tắt hiệu suất
 * @param {{results: ExtractionResult[], accentColor: string}} props
 */
const PerformanceSummary = ({ results, accentColor }) => {
    const successfulResults = results.filter(r => r.status === 'success');
    if (successfulResults.length === 0) return null;

    let totalScore = 0;
    let countGioi = 0; // >= 8.0
    let countKha = 0;  // >= 6.5
    let countTB = 0;   // >= 5.0
    let countYeu = 0;  // < 5.0

    successfulResults.forEach(r => {
        const score = parseFloat(r.diem_so);
        if (!isNaN(score)) {
            totalScore += score;
            if (score >= 8.0) countGioi++;
            else if (score >= 6.5) countKha++;
            else if (score >= 5.0) countTB++;
            else countYeu++;
        }
    });

    const totalStudents = successfulResults.length;
    const avgScore = totalStudents > 0 ? (totalScore / totalStudents).toFixed(2) : 'N/A';
    const percentPass = totalStudents > 0 ? (((countGioi + countKha + countTB) / totalStudents) * 100).toFixed(1) : '0';

    const categories = [
        { label: 'Xuất Sắc/Giỏi ({'>'}= 8.0)', value: countGioi, color: 'text-green-400', bgColor: 'bg-green-900/40' },
        { label: 'Khá ({'>'}= 6.5)', value: countKha, color: 'text-blue-400', bgColor: 'bg-blue-900/40' },
        { label: 'Trung Bình ({'>'}= 5.0)', value: countTB, color: 'text-yellow-400', bgColor: 'bg-yellow-900/40' },
        { label: 'Yếu ({'<'} 5.0)', value: countYeu, color: 'text-red-400', bgColor: 'bg-red-900/40' }
    ];

    return (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Cột 1: Chỉ số Chính */}
            <div className="md:col-span-1 p-6 rounded-xl border border-gray-700 shadow-lg" style={{ borderColor: accentColor }}>
                <h3 className="text-lg font-bold text-gray-100 mb-4" style={{ color: accentColor }}>Tóm Tắt Hiệu Suất</h3>
                <div className="space-y-3">
                    <div className="flex justify-between items-center text-gray-300">
                        <span className="font-medium">Tổng số học sinh</span>
                        <span className="text-xl font-extrabold" style={{ color: accentColor }}>{totalStudents}</span>
                    </div>
                    <div className="flex justify-between items-center text-gray-300 border-t border-gray-700 pt-3">
                        <span className="font-medium">Điểm trung bình lớp</span>
                        <span className="text-2xl font-extrabold text-white">{avgScore}</span>
                    </div>
                    <div className="flex justify-between items-center text-gray-300 border-t border-gray-700 pt-3">
                        <span className="font-medium">Tỷ lệ Đỗ ({'>'}= 5.0)</span>
                        <span className="text-xl font-extrabold text-green-400">{percentPass}%</span>
                    </div>
                </div>
            </div>

            {/* Cột 2 & 3: Phân loại Điểm */}
            <div className="md:col-span-2 grid grid-cols-2 gap-4">
                {categories.map(cat => (
                    <div key={cat.label} className={`p-4 rounded-xl shadow-md ${cat.bgColor}`}>
                        <p className={`text-sm font-semibold ${cat.color}`}>{cat.label}</p>
                        <p className="text-2xl font-extrabold text-gray-100 mt-1">{cat.value}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{totalStudents > 0 ? ((cat.value / totalStudents) * 100).toFixed(1) : 0}% tổng số</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

// =======================================================
// 5. RESULTS TABLE COMPONENT
// =======================================================

/**
 * Component hiển thị kết quả trích xuất
 * @param {{results: ExtractionResult[], onSort: function(string): void, sortConfig: {key: string, direction: string}, filterStatus: string, onRowClick: function(string): void}} props
 */
const ResultsTable = ({ results, onSort, sortConfig, filterStatus, onRowClick }) => {
    if (results.length === 0) return null;

    // Logic Lọc theo trạng thái
    const filteredResults = results.filter(result => {
        if (filterStatus === 'all') return true;
        
        const score = parseFloat(result.diem_so);
        const passed = !isNaN(score) && score >= 5.0;

        if (filterStatus === 'pass') return result.status === 'success' && passed;
        if (filterStatus === 'fail') return result.status === 'success' && !passed;

        // Nếu là lỗi trích xuất, luôn hiển thị trong chế độ 'all'
        return result.status === 'error';
    });


    const successfulCount = filteredResults.filter(r => r.status === 'success').length;
    const errorCount = filteredResults.filter(r => r.status === 'error').length;

    const getSortIndicator = (key) => {
        if (sortConfig.key !== key) return null;
        return sortConfig.direction === 'ascending' ? ' ▲' : ' ▼';
    };

    return (
        <div className="mt-10 overflow-x-auto shadow-lg rounded-xl">
            <h2 className="text-xl font-bold p-4 bg-gray-700 text-gray-100 rounded-t-xl">
                Chi Tiết Kết Quả ({successfulCount} thành công, {errorCount} lỗi)
            </h2>
            <table className="min-w-full divide-y divide-gray-600">
                <thead className="bg-gray-600">
                    <tr>
                        {/* Cột 1: Trạng thái (Fixed width) */}
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-300 uppercase tracking-wider w-auto">Trạng thái</th>
                        {/* Cột 2: Tên Học sinh (Takes remaining space) - Sắp xếp theo Tên */}
                        <th 
                            className="px-4 py-3 text-left text-xs font-bold text-gray-300 uppercase tracking-wider w-full cursor-pointer hover:text-white transition-colors"
                            onClick={() => onSort('ten_hoc_sinh')}
                        >
                            Tên Học sinh {getSortIndicator('ten_hoc_sinh')}
                        </th>
                        {/* Cột 3: Điểm số (Fixed small width) - Sắp xếp theo Điểm */}
                        <th 
                            className="px-4 py-3 text-left text-xs font-bold text-gray-300 uppercase tracking-wider w-20 cursor-pointer hover:text-white transition-colors"
                            onClick={() => onSort('diem_so')}
                        >
                            Điểm số {getSortIndicator('diem_so')}
                        </th>
                    </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                    {filteredResults.map((result, index) => (
                        <tr 
                            key={index} 
                            className={result.status === 'error' ? 'bg-red-900/20 hover:bg-red-900/40 transition-colors cursor-pointer' : 'hover:bg-indigo-900/20 transition-colors cursor-pointer'}
                            onClick={() => onRowClick(result.fileName)}
                        >
                            {/* Ô Trạng thái */}
                            <td className="px-4 py-3 align-top w-auto">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${result.status === 'success' ? 'bg-green-700 text-green-100' : 'bg-red-700 text-red-100'}`}>
                                    {result.status === 'success' ? 'Thành công' : 'Lỗi'}
                                </span>
                            </td>
                            {/* Ô Tên Học sinh: NGẮT DÒNG VÀ CĂN CHỈNH CHIỀU CAO */}
                            <td className="px-4 py-3 text-sm text-gray-300 font-medium w-full break-all">
                                {result.ten_hoc_sinh}
                            </td>
                            {/* Ô Điểm số */}
                            <td className="px-4 py-3 text-sm font-bold text-gray-100 w-20 text-right align-top">
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
            {filteredResults.length === 0 && (
                <div className="p-6 text-center text-gray-500 bg-gray-800 rounded-b-xl">
                    Không tìm thấy kết quả phù hợp với bộ lọc hiện tại.
                </div>
            )}
        </div>
    );
};


// =======================================================
// 6. MAIN APP COMPONENT
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
    
    // Sắp xếp và Lọc
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });
    const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'pass', 'fail'
    
    // IMAGE PREVIEW STATE
    const [selectedImageFile, setSelectedImageFile] = useState(null); // Lưu trữ File object được chọn

    // Logic Sắp xếp
    const sortedResults = React.useMemo(() => {
        let sortableItems = [...results];
        // Sắp xếp
        sortableItems.sort((a, b) => {
            const isAError = a.status !== 'success';
            const isBError = b.status !== 'success';

            if (isAError && !isBError) return 1;
            if (!isAError && isBError) return -1;
            if (isAError && isBError) return 0; 

            if (sortConfig.key !== null) {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];

                if (sortConfig.key === 'diem_so') {
                    aValue = parseFloat(aValue) || -1;
                    bValue = parseFloat(bValue) || -1;
                }
                
                if (aValue < bValue) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
            }
            return 0;
        });
        return sortableItems;
    }, [results, sortConfig]);

    const handleSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };


    // NEW STATE: Lưu trữ API Key ở Runtime (Khởi tạo là null)
    const [apiKey, setApiKey] = useState(null);

    // Sử dụng useEffect để khởi tạo API Key an toàn sau khi component đã render
    useEffect(() => {
        let key = "";
        
        // 1. Cố gắng lấy key từ biến môi trường Netlify/Vite
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
        
        if (!key && !error) {
             setError("API Key chưa được thiết lập. Vui lòng kiểm tra biến môi trường VITE_GEMINI_API_KEY trên Netlify.");
        }
    }, [error]);

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
        setSortConfig({ key: null, direction: 'ascending' }); // Reset sắp xếp khi tải file mới
        
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

    // Hàm xử lý khi click vào hàng trong bảng
    const handleRowClick = (fileName) => {
        const fileObject = files.find(f => f.name === fileName);
        if (fileObject) {
            setSelectedImageFile(fileObject);
        }
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
            {/* Modal hiển thị ảnh */}
            <ImageModal 
                file={selectedImageFile} 
                onClose={() => setSelectedImageFile(null)} 
                accentColor={accentColor}
            />

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

                {/* Phân tích hiệu suất */}
                <PerformanceSummary results={sortedResults} accentColor={accentColor} />
                
                {/* Thanh Lọc */}
                <div className="mt-4 flex flex-wrap gap-3 items-center justify-start text-sm">
                    <span className="text-gray-400 font-semibold">Lọc kết quả:</span>
                    {['all', 'pass', 'fail'].map(status => (
                        <button
                            key={status}
                            onClick={() => setFilterStatus(status)}
                            className={`px-4 py-1.5 rounded-full font-medium transition-all ${
                                filterStatus === status 
                                ? 'shadow-md text-white' 
                                : 'text-gray-400 border border-gray-600 hover:bg-gray-700'
                            }`}
                            style={filterStatus === status ? { backgroundColor: accentColor } : {}}
                        >
                            {status === 'all' ? 'Tất cả' : status === 'pass' ? 'Đỗ ({'>'}= 5.0)' : 'Trượt ({'<'} 5.0)'}
                        </button>
                    ))}
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
                
                <ResultsTable results={sortedResults} onSort={handleSort} sortConfig={sortConfig} filterStatus={filterStatus} onRowClick={handleRowClick} />
            </main>
            <footer className="w-full max-w-4xl mx-auto text-center mt-6">
                <p className="text-sm text-gray-500">Powered by Google Gemini</p>
            </footer>
        </div>
    );
}
