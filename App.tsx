import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
// ĐÃ XÓA TẤT CẢ CÁC IMPORT CỦA FIREBASE ĐỂ KHẮC PHỤC LỖI ROLLUP VÀ SỬ DỤNG HÀM GLOBAL

// =======================================================
// 1. TYPES & HẰNG SỐ (CONSTANTS)
// =======================================================

/**
 * Định nghĩa kiểu dữ liệu cho kết quả trích xuất
 * @typedef {object} StudentScore
 * @property {string} ten_hoc_sinh
 * @property {string} diem_so
 * @property {object} [custom_data] Lưu trữ tất cả cột tùy chỉnh (ví dụ: { 'Mã học sinh': '123' })
 */
interface StudentScore {
    ten_hoc_sinh: string;
    diem_so: string;
    custom_data?: { [key: string]: string };
}

/**
 * Định nghĩa kiểu dữ liệu cho kết quả hiển thị
 * @typedef {object} ExtractionResult
 * @property {string} id - Firestore Document ID
 * @property {'success' | 'error'} status
 * @property {string} fileName
 * @property {string} ten_hoc_sinh
 * @property {string} diem_so
 * @property {object} [custom_data]
 * @property {string} [errorMessage]
 */
interface ExtractionResult extends StudentScore {
    id: string;
    status: 'success' | 'error';
    fileName: string;
    errorMessage?: string;
}

// KHAI BÁO CÁC HẰNG SỐ CỦA DỊCH VỤ (KHÔNG BAO GỒM API KEY)
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent";

// Các biến toàn cục cho Firebase (sẽ được khởi tạo trong useEffect)
let db: any = null;
let auth: any = null;
let resultsCollection: any = null;

/**
 * Hàm chuyển đổi tệp hình ảnh thành định dạng Base64
 */
const fileToGenerativePart = async (file: File) => {
    const base64EncodedDataPromise = new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result!.toString().split(',')[1]);
        reader.readAsDataURL(file);
    });
    return {
        inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
    };
};

/**
 * Hàm gọi API Gemini để trích xuất dữ liệu (Đã tích hợp Chuẩn hóa Tên và Điểm)
 * @param {File} imageFile 
 * @param {string} apiKey - Phải được truyền từ React State
 * @param {string[]} requiredColumns - Các cột tùy chỉnh cần trích xuất
 * @returns {Promise<StudentScore[]>}
 */
const extractDataFromImage = async (imageFile: File, apiKey: string | null, requiredColumns: string[]): Promise<StudentScore[]> => {
    if (!apiKey) {
         throw new Error("API Key chưa được thiết lập. (Lỗi Runtime)");
    }

    const imagePart = await fileToGenerativePart(imageFile);
    
    const columnsStr = requiredColumns.join(', ');

    // Prompt yêu cầu trích xuất cột tùy chỉnh và chuẩn hóa
    const prompt = `Bạn là một CHUYÊN GIA PHÂN TÍCH BÀI KIỂM TRA. Từ hình ảnh danh sách điểm, hãy trích xuất **TẤT CẢ** các cột sau: [${columnsStr}].

YÊU CẦU:
1. Trích xuất tất cả học sinh.
2. Cột Tên học sinh phải được chuẩn hóa về định dạng Proper Case (Chữ cái đầu mỗi từ viết hoa, ví dụ: 'nguyẽn văn a' -> 'Nguyễn Văn A').
3. Điểm số phải được chuẩn hóa về thang điểm 10.0 (nếu phát hiện thang điểm khác, hãy quy đổi về 10.0).
4. Đảm bảo trả về chính xác các trường trong cấu trúc JSON, sử dụng tên trường là dạng snake_case (ví dụ: 'Mã học sinh' -> 'ma_hoc_sinh').`;

    // Định nghĩa Schema dựa trên các cột tùy chỉnh
    const properties: { [key: string]: any } = {
        ten_hoc_sinh: { type: "STRING", description: "Họ tên đầy đủ của học sinh (đã chuẩn hóa)." },
        diem_so: { type: "STRING", description: "Điểm số cuối cùng đã chuẩn hóa về thang 10.0." }
    };

    const requiredFields = ['ten_hoc_sinh', 'diem_so'];

    // Thêm cột tùy chỉnh vào schema
    requiredColumns.forEach(col => {
        const key = col.toLowerCase().replace(/\s/g, '_');
        if (key !== 'ten_hoc_sinh' && key !== 'diem_so') {
            properties[key] = { 
                type: "STRING", 
                description: `Dữ liệu trích xuất cho cột: ${col}` 
            };
            requiredFields.push(key);
        }
    });

    const responseSchema = {
        type: "ARRAY",
        items: {
            type: "OBJECT",
            properties: properties,
            required: requiredFields,
        },
    };

    const payload = {
        contents: [{ parts: [imagePart, { text: prompt }] }],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: responseSchema,
        },
    };

    // Áp dụng tính năng Retry (Backoff)
    const MAX_RETRIES = 3;
    let lastError: Error | null = null;

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

                if (!jsonText) throw new Error("Không nhận được nội dung phản hồi từ API.");
            
                const parsedData = JSON.parse(jsonText);
                if (!Array.isArray(parsedData)) throw new Error("Đầu ra JSON không phải là Mảng hợp lệ.");

                // Xử lý và chuẩn hóa tên trường dữ liệu tùy chỉnh
                const standardizedData: StudentScore[] = parsedData.map((item: any) => {
                    const newItem: StudentScore = { ten_hoc_sinh: item.ten_hoc_sinh, diem_so: item.diem_so, custom_data: {} };
                    Object.keys(item).forEach(key => {
                        const originalColumnName = requiredColumns.find(col => col.toLowerCase().replace(/\s/g, '_') === key);
                        
                        // Lưu dữ liệu tùy chỉnh vào đối tượng custom_data
                        if (originalColumnName && key !== 'ten_hoc_sinh' && key !== 'diem_so') {
                            newItem.custom_data![originalColumnName] = item[key];
                        }
                    });
                    return newItem;
                });
                
                return standardizedData;

            } else if (response.status === 429 || response.status >= 500) {
                lastError = new Error(`API call failed with status ${response.status}. Retrying...`);
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
                continue;
            } else {
                throw new Error(`API call failed with status ${response.status}: ${response.statusText}`);
            }

        } catch (e) {
            const error = e as Error;
            if (error.message.includes('Retrying')) {
                lastError = error;
                continue;
            }
            throw new Error(`Lỗi mạng hoặc cú pháp: ${error.message}`);
        }
    }

    if (lastError) {
        throw new Error(`API đã thất bại sau ${MAX_RETRIES} lần thử. ${lastError.message}`);
    }
    return []; // Should be unreachable
};

/**
 * Hàm gọi AI lần 2 để lấy nhận xét (feedback)
 */
const getAiFeedback = async (apiKey: string | null, successfulResults: ExtractionResult[], performanceSummary: any) => {
    if (!apiKey || successfulResults.length === 0) return null;

    const dataSnapshot = successfulResults.map(r => ({
        ten_hoc_sinh: r.ten_hoc_sinh,
        diem_so: r.diem_so,
    }));

    const prompt = `Phân tích bộ dữ liệu điểm số sau: ${JSON.stringify(dataSnapshot)}. Điểm trung bình là ${performanceSummary.averageScore}, Tỷ lệ đỗ là ${performanceSummary.passRate}. Dựa trên các chỉ số này, hãy đưa ra một nhận xét ngắn gọn (tối đa 2 câu) về hiệu suất của lớp. Nếu phát hiện điểm số bất thường (quá cao hoặc quá thấp so với trung bình), hãy đưa ra cảnh báo.`;

    try {
        const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        const result = await response.json();
        return result?.candidates?.[0]?.content?.parts?.[0]?.text || "Không thể tạo nhận xét từ AI.";
    } catch (e) {
        console.error("Lỗi khi lấy feedback từ AI:", e);
        return "Lỗi khi kết nối AI để phân tích.";
    }
};


// =======================================================
// 2. ICON COMPONENTS
// =======================================================

const UploadIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-upload">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" />
    </svg>
);

const SpinnerIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-loader-2 animate-spin">
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
);

const CsvIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-file-text">
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" />
    </svg>
);

const InfoIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-info">
        <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
    </svg>
);

const ChevronDownIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-down">
        <path d="m6 9 6 6 6-6" />
    </svg>
);


// =======================================================
// 3. RESULTS TABLE COMPONENTS (Đã hợp nhất Logic)
// =======================================================

interface PerformanceSummaryProps {
    totalStudents: number;
    averageScore: number;
    passCount: number;
    passRate: number;
    excellentCount: number;
}

const PerformanceSummary: React.FC<{ summary: PerformanceSummaryProps, accentColor: string }> = ({ summary, accentColor }) => {
    const data = [
        { label: "Tổng số học sinh", value: summary.totalStudents },
        { label: "Điểm trung bình lớp", value: `${summary.averageScore.toFixed(2)} / 10.0`, color: summary.averageScore >= 5.0 ? 'text-green-400' : 'text-red-400' },
        { label: "Tỷ lệ Đỗ ({'>'}= 5.0)", value: `${summary.passRate.toFixed(1)}%`, color: summary.passRate >= 70 ? 'text-green-400' : 'text-yellow-400' },
        { label: "Giỏi ({'>'}= 8.0)", value: `${summary.excellentCount} hs`, color: 'text-indigo-400' },
    ];

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            {data.map((item, index) => (
                <div key={index} className="bg-gray-700 p-4 rounded-xl shadow-lg">
                    <p className="text-sm font-semibold text-gray-400">{item.label}</p>
                    <p className={`text-2xl font-bold mt-1 ${item.color || 'text-gray-100'}`}>{item.value}</p>
                </div>
            ))}
        </div>
    );
};

const AiFeedbackBox: React.FC<{ feedback: string | null, accentColor: string, isLoading: boolean }> = ({ feedback, accentColor, isLoading }) => {
    if (!feedback && !isLoading) return null;

    const isWarning = feedback && (feedback.toLowerCase().includes('bất thường') || feedback.toLowerCase().includes('cảnh báo'));

    return (
        <div className="mt-6 p-4 rounded-xl shadow-lg border-l-4"
             style={{ 
                 borderColor: isWarning ? '#ef4444' : accentColor,
                 backgroundColor: isWarning ? 'rgba(239, 68, 68, 0.1)' : 'rgba(79, 70, 229, 0.1)'
             }}>
            <h3 className="text-lg font-bold flex items-center mb-2" style={{ color: isWarning ? '#ef4444' : accentColor }}>
                <InfoIcon className="w-5 h-5 mr-2" /> 
                Phân tích của AI
            </h3>
            {isLoading ? (
                <p className="text-sm text-gray-400 animate-pulse">AI đang phân tích dữ liệu...</p>
            ) : (
                <p className="text-sm text-gray-300">{feedback}</p>
            )}
        </div>
    );
};


/**
 * Component hiển thị bảng kết quả (Bao gồm chức năng Chỉnh sửa Inline)
 */
interface ResultsTableProps {
    results: ExtractionResult[];
    editedScores: { [key: string]: string };
    onScoreChange: (id: string, newScore: string) => void;
    onSort: (key: 'ten_hoc_sinh' | 'diem_so') => void;
    sortConfig: { key: string, direction: 'ascending' | 'descending' };
    customColumnsDisplay: string[];
}

const ResultsTable: React.FC<ResultsTableProps> = ({ results, editedScores, onScoreChange, onSort, sortConfig, customColumnsDisplay }) => {
    
    // Tạo tiêu đề động cho bảng
    const headers = [
        { key: 'status', label: 'Trạng thái', sortable: false },
        { key: 'ten_hoc_sinh', label: 'Tên Học sinh', sortable: true },
    ];

    // Thêm các cột tùy chỉnh vào header
    customColumnsDisplay.forEach(colName => {
        headers.push({ 
            key: colName, 
            label: colName,
            sortable: false 
        });
    });

    headers.push({ key: 'diem_so', label: 'Điểm số (Thang 10)', sortable: true });

    const getSortIndicator = (key: string) => {
        if (sortConfig.key === key) {
            return sortConfig.direction === 'ascending' ? ' ▲' : ' ▼';
        }
        return '';
    };

    return (
        <div className="mt-10 overflow-x-auto shadow-lg rounded-xl">
            <h2 className="text-xl font-bold p-4 bg-gray-700 text-gray-100 rounded-t-xl">
                Chi Tiết Kết Quả ({results.filter(r => r.status === 'success').length} thành công)
            </h2>
            <table className="min-w-full divide-y divide-gray-600">
                <thead className="bg-gray-600">
                    <tr>
                        {headers.map((header) => (
                            <th 
                                key={header.key} 
                                className={`px-4 py-3 text-left text-xs font-bold text-gray-300 uppercase tracking-wider ${header.sortable ? 'cursor-pointer hover:bg-gray-500 transition-colors' : ''}`}
                                onClick={() => header.sortable && onSort(header.key as 'ten_hoc_sinh' | 'diem_so')}
                                style={{ width: header.key === 'diem_so' ? '120px' : header.key === 'status' ? '100px' : 'auto' }}
                            >
                                {header.label}
                                {getSortIndicator(header.key)}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                    {results.map((result) => {
                        const editKey = `${result.id}`;
                        const isEdited = result.id && !!editedScores[editKey]; // Kiểm tra ID hợp lệ
                        const displayScore = editedScores[editKey] !== undefined ? editedScores[editKey] : result.diem_so;

                        return (
                            <tr key={editKey} className={result.status === 'error' ? 'bg-red-900/20 hover:bg-red-900/40 transition-colors' : (isEdited ? 'bg-yellow-800/30 hover:bg-yellow-800/40 transition-colors' : 'hover:bg-indigo-900/20 transition-colors')}>
                                <td className="px-4 py-3 min-w-[100px]">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${result.status === 'success' ? 'bg-green-700 text-green-100' : 'bg-red-700 text-red-100'}`}>
                                        {result.status === 'success' ? 'Thành công' : 'Lỗi'}
                                    </span>
                                </td>
                                
                                <td className="px-4 py-3 text-sm text-gray-300 font-medium break-words min-w-[150px] max-w-[300px]">
                                    {result.ten_hoc_sinh}
                                </td>

                                {/* Hiển thị các cột tùy chỉnh */}
                                {customColumnsDisplay.map(colName => (
                                    <td key={colName} className="px-4 py-3 text-sm text-gray-400 break-words min-w-[100px] max-w-[200px]">
                                        {result.custom_data?.[colName] || 'N/A'}
                                    </td>
                                ))}

                                <td className="px-4 py-2 text-sm font-bold text-gray-100 w-20">
                                    {result.status === 'error' ? (
                                        <span className="text-red-400 italic text-xs" title={result.errorMessage}>
                                            {result.errorMessage || 'Lỗi chung'}
                                        </span>
                                    ) : (
                                        <input
                                            type="text"
                                            value={displayScore}
                                            onChange={(e) => onScoreChange(result.id, e.target.value)}
                                            className="w-full text-center p-1 rounded bg-gray-900 border"
                                            style={{ borderColor: isEdited ? '#fcd34d' : '#4b5563', color: isEdited ? '#fcd34d' : '#e5e7eb' }}
                                        />
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};


// =======================================================
// 4. MAIN APP COMPONENT
// =======================================================

export default function App() {
    // --- States
    /** @type {[File[], React.Dispatch<React.SetStateAction<File[]>>]} */
    const [files, setFiles] = useState<File[]>([]);
    /** @type {[ExtractionResult[], React.Dispatch<React.SetStateAction<ExtractionResult[]>>]} */
    const [results, setResults] = useState<ExtractionResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dragActive, setDragActive] = useState(false);
    const [processingStatus, setProcessingStatus] = useState('');
    const [aiFeedback, setAiFeedback] = useState<string | null>(null);
    const [isAiFeedbackLoading, setIsAiFeedbackLoading] = useState(false);
    
    // --- States Cấu hình (Lưu trữ và Khôi phục)
    const getInitialConfig = (key: string, defaultValue: any): any => {
        try {
            const saved = localStorage.getItem(key);
            if (saved !== null) {
                return key.includes('Checked') ? JSON.parse(saved) : saved;
            }
            return defaultValue;
        } catch (e) {
            return defaultValue;
        }
    };
    
    // Cấu hình (lưu trong localStorage)
    const [accentColor, setAccentColorState] = useState<string>(getInitialConfig('accentColor', '#4f46e5')); 
    const [customColumnsChecked, setCustomColumnsCheckedState] = useState<string[]>(getInitialConfig('customColumnsChecked', ['Mã học sinh'])); 
    const [customColumnsText, setCustomColumnsTextState] = useState<string>(getInitialConfig('customColumnsText', '')); 
    const [isColumnPickerOpen, setIsColumnPickerOpen] = useState(false);
    
    const setConfigState = (key: string, value: any, setter: React.Dispatch<React.SetStateAction<any>>) => {
        setter(value);
        try { localStorage.setItem(key, typeof value === 'object' ? JSON.stringify(value) : value); } catch (e) {}
    };

    const setAccentColor = (newColor: string) => setConfigState('accentColor', newColor, setAccentColorState);
    const setCustomColumnsChecked = (newChecked: string[]) => setConfigState('customColumnsChecked', newChecked, setCustomColumnsCheckedState);
    const setCustomColumnsText = (newText: string) => setConfigState('customColumnsText', newText, setCustomColumnsTextState);

    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [dbInstance, setDbInstance] = useState<any>(null);
    const [userId, setUserId] = useState<string | null>(null); 
    const [isAuthReady, setIsAuthReady] = useState(false); // Thêm biến trạng thái Auth
    const [apiKey, setApiKey] = useState<string | null>(null); 
    const [filter, setFilter] = useState('all');
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'ascending' | 'descending' }>({ key: 'ten_hoc_sinh', direction: 'ascending' });
    const [editedScores, setEditedScores] = useState<{ [key: string]: string }>({});

    // Hợp nhất cột tùy chỉnh (giữ nguyên logic)
    const requiredColumnsList = useMemo(() => {
        const textCols = customColumnsText.split(',').map(c => c.trim()).filter(c => c.length > 0);
        const combined = [...customColumnsChecked, ...textCols];
        const unique = [...new Set(combined)].filter(c => c.toLowerCase() !== 'tên học sinh' && c.toLowerCase() !== 'điểm số');
        return unique;
    }, [customColumnsChecked, customColumnsText]);

    const customColumnsDisplay = useMemo(() => requiredColumnsList, [requiredColumnsList]);
    
    // --- Hooks khởi tạo và Service Calls

    // 1. Khởi tạo Firebase và Auth (Tối ưu hóa Khởi tạo)
    useEffect(() => {
        let isCancelled = false;

        // Dùng các hàm global thay vì import
        const firebase: any = (window as any).firebase || {};
        const { initializeApp, getApp } = firebase;
        const authModule = firebase.auth || {};
        const firestoreModule = firebase.firestore || {};

        const { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } = authModule;
        const { getFirestore } = firestoreModule;

        // --- Xử lý Auth và Firebase ---
        if (typeof (window as any).__firebase_config !== 'undefined' && initializeApp && getAuth && getFirestore && !dbInstance) {
            const firebaseConfig = JSON.parse((window as any).__firebase_config);
            
            try {
                 getApp();
            } catch (e) {
                initializeApp(firebaseConfig);
            }
            
            auth = getAuth();
            db = getFirestore();
            setDbInstance(db);
            
            const handleAuth = async () => {
                if (isCancelled) return;
                try {
                    if (typeof (window as any).__initial_auth_token !== 'undefined') {
                        await signInWithCustomToken(auth, (window as any).__initial_auth_token);
                    } else {
                        await signInAnonymously(auth);
                    }
                } catch (e) {
                    console.error("Lỗi đăng nhập Firebase:", e);
                }
            };
            
            // Theo dõi trạng thái Auth và đặt userId
            const unsubscribe = onAuthStateChanged(auth, (user: any) => {
                if (user) {
                    setUserId(user.uid);
                } else {
                    handleAuth();
                }
                if (!isCancelled) {
                    setIsAuthReady(true); // Đánh dấu Auth đã sẵn sàng
                }
            });
            return () => { 
                isCancelled = true; 
                unsubscribe();
            };
        }
        
        // --- Xử lý API Key ---
        let key: string = "";
        try {
            // Cố gắng đọc từ biến môi trường Vite
            if (typeof import.meta !== 'undefined' && import.meta.env) {
                key = import.meta.env.VITE_GEMINI_API_KEY || "";
            }
        } catch (e) {}
        
        // Ưu tiên khóa từ Canvas (nếu có)
        if (typeof (window as any).__api_key !== 'undefined') {
            key = (window as any).__api_key;
        }
        
        setApiKey(key);
        if (!key) {
             setError("API Key chưa được thiết lập. Vui lòng kiểm tra biến môi trường.");
        }
        // Nếu không có firebase config, coi như Auth sẵn sàng để ít nhất hiển thị lỗi API Key (nếu có)
        if (typeof (window as any).__firebase_config === 'undefined' && !isCancelled) {
            setIsAuthReady(true);
        }

    }, [dbInstance]);


    // 2. Lắng nghe dữ liệu Firestore khi userId có sẵn
    useEffect(() => {
        const firestoreModule: any = (window as any).firebase ? (window as any).firebase.firestore : {};
        const { collection, query, onSnapshot } = firestoreModule;

        if (dbInstance && userId && isAuthReady && collection && query && onSnapshot) {
            const appId = typeof (window as any).__app_id !== 'undefined' ? (window as any).__app_id : 'default-app-id';
            const collectionPath = `/artifacts/${appId}/users/${userId}/results`;
            resultsCollection = collection(dbInstance, collectionPath);
            
            const q = query(resultsCollection);

            const unsubscribe = onSnapshot(q, (snapshot: any) => {
                const loadedResults: ExtractionResult[] = snapshot.docs.map((doc: any) => ({
                    ...doc.data(),
                    id: doc.id
                }));
                setResults(loadedResults);
            }, (error: any) => {
                console.error("Lỗi lắng nghe Firestore:", error);
                setError("Không thể tải dữ liệu đã lưu. Vui lòng kiểm tra kết nối.");
            });

            return () => unsubscribe();
        }
    }, [dbInstance, userId, isAuthReady]); 

    // 3. Logic API Callback (Sử dụng API Key từ State)
    const extractDataFromImageCallback = useCallback(async (imageFile: File) => {
        return extractDataFromImage(imageFile, apiKey, ['Tên học sinh', 'Điểm số', ...requiredColumnsList]);
    }, [apiKey, requiredColumnsList]);

    // --- Logic Tóm tắt Hiệu suất & Sắp xếp (useMemo)

    const processedResults = useMemo(() => {
        // Áp dụng điểm đã chỉnh sửa
        const resultsWithEdits = results.map((result) => {
            const editKey = `${result.id}`;
            const score = editedScores[editKey] !== undefined ? editedScores[editKey] : result.diem_so;
            
            if (result.status === 'success' || (score !== 'N/A' && score !== '' && !isNaN(parseFloat(score)))) {
                 return { ...result, diem_so: score };
            }
            return null;
        }).filter((r): r is ExtractionResult => r !== null && r.diem_so !== 'N/A' && r.diem_so !== ''); 

        // Tính tóm tắt hiệu suất
        const totalStudents = resultsWithEdits.length;
        const totalScore = resultsWithEdits.reduce((sum, r) => sum + parseFloat(r.diem_so || '0'), 0);
        const averageScore = totalStudents > 0 ? (totalScore / totalStudents) : 0;
        const passCount = resultsWithEdits.filter(r => parseFloat(r.diem_so) >= 5.0).length;
        const passRate = totalStudents > 0 ? (passCount / totalStudents * 100) : 0;
        const excellentCount = resultsWithEdits.filter(r => parseFloat(r.diem_so) >= 8.0).length;

        const performanceSummary: PerformanceSummaryProps = { totalStudents, averageScore, passCount, passRate, excellentCount };

        // Lọc và Sắp xếp
        const filtered = results.filter(r => {
            const editKey = `${r.id}`;
            const score = parseFloat(editedScores[editKey] || r.diem_so || '0');

            if (filter === 'pass') return r.status === 'success' && score >= 5.0;
            if (filter === 'fail') return r.status === 'success' && score < 5.0;
            return true;
        });

        const sorted = [...filtered].sort((a, b) => {
            const getScore = (result: ExtractionResult) => parseFloat(editedScores[`${result.id}`] || result.diem_so || '-1');

            const aValue = (a as any)[sortConfig.key];
            const bValue = (b as any)[sortConfig.key];
            
            let comparison = 0;
            
            if (sortConfig.key === 'ten_hoc_sinh') {
                if (aValue < bValue) comparison = -1;
                if (aValue > bValue) comparison = 1;
            } else if (sortConfig.key === 'diem_so') {
                const aNum = getScore(a); 
                const bNum = getScore(b); 
                if (aNum < bNum) comparison = -1;
                if (aNum > bNum) comparison = 1;
            }
            return sortConfig.direction === 'ascending' ? comparison : comparison * -1;
        });


        return { sortedResults: sorted, performanceSummary, successfulResults: resultsWithEdits };

    }, [results, filter, sortConfig, editedScores]);
    
    // 4. Effect để gọi AI Feedback sau khi xử lý xong (Lần gọi thứ 2)
    useEffect(() => {
        if (!isLoading && processedResults.successfulResults.length > 0 && apiKey) {
            setIsAiFeedbackLoading(true);
            getAiFeedback(apiKey, processedResults.successfulResults, processedResults.performanceSummary)
                .then(setAiFeedback)
                .catch(e => setAiFeedback(`Lỗi khi phân tích AI: ${e.message}`))
                .finally(() => setIsAiFeedbackLoading(false));
        } else if (results.length === 0) {
            setAiFeedback(null);
        }
    }, [isLoading, processedResults.successfulResults.length, apiKey, processedResults.performanceSummary, results.length]);


    // --- Handlers

    const handleScoreChange = useCallback((id: string, newScore: string) => {
        setEditedScores(prev => ({ ...prev, [id]: newScore }));

        const firestoreModule: any = (window as any).firebase ? (window as any).firebase.firestore : {};
        const { doc, updateDoc } = firestoreModule;

        if (dbInstance && userId && id && doc && updateDoc) {
            const appId = typeof (window as any).__app_id !== 'undefined' ? (window as any).__app_id : 'default-app-id';
            const docRef = doc(dbInstance, `/artifacts/${appId}/users/${userId}/results/${id}`);
            updateDoc(docRef, { diem_so: newScore })
                .catch((e: any) => console.error("Lỗi cập nhật điểm số Firestore:", e));
        }

    }, [dbInstance, userId]);

    const handleSort = (key: 'ten_hoc_sinh' | 'diem_so') => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const downloadCSV = useCallback((finalResults: ExtractionResult[]) => {
        if (finalResults.length === 0) return;

        const customColsHeader = requiredColumnsList.map(h => `"${h}"`).join(';');
        const headers = ['"Tên học sinh"', '"Điểm số"', customColsHeader].filter(h => h).join(';');
        
        const rows = finalResults.map(r => {
            const displayScore = r.diem_so; 
            
            const fields = [`"${r.ten_hoc_sinh}"`, `"${displayScore}"`];
            if (r.custom_data) {
                 requiredColumnsList.forEach(colName => {
                    fields.push(`"${r.custom_data![colName] || ''}"`);
                });
            }
            return fields.join(';');
        });

        const csvContent = [headers, ...rows].join('\n');
        
        const blob = new Blob(['\uFEFF', csvContent], { type: 'text/csv;charset=utf-8;' });
        
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'diem_so_hoc_sinh.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, [requiredColumnsList]);

    
    const handleProcessFiles = useCallback(async (filesToProcess: File[]) => {
        const firestoreModule: any = (window as any).firebase ? (window as any).firebase.firestore : {};
        const { addDoc } = firestoreModule;

        if (filesToProcess.length === 0 || !apiKey || !dbInstance || !userId || !addDoc) return;
        
        setIsLoading(true);
        setEditedScores({}); 
        setError(null);
        setAiFeedback(null);
        
        const newResults: ExtractionResult[] = [];
        
        for (let i = 0; i < filesToProcess.length; i++) {
            const file = filesToProcess[i];
            setProcessingStatus(`Đang xử lý file ${i + 1} of ${filesToProcess.length}: ${file.name}`);
            
            try {
                const extractedData = await extractDataFromImage(file, apiKey, ['Tên học sinh', 'Điểm số', ...requiredColumnsList]);
                
                if (Array.isArray(extractedData) && extractedData.length > 0) {
                    extractedData.forEach(async (data) => {
                        const appId = typeof (window as any).__app_id !== 'undefined' ? (window as any).__app_id : 'default-app-id';
                        const docData = {
                            status: 'success',
                            fileName: file.name,
                            ten_hoc_sinh: data.ten_hoc_sinh || 'N/A',
                            diem_so: data.diem_so || 'N/A',
                            custom_data: data.custom_data || {},
                            createdAt: new Date().toISOString(),
                            userId: userId
                        };
                        await addDoc(resultsCollection, docData);
                    });
                } else {
                    newResults.push({ id: `temp-${Date.now()}-${i}`, status: 'error', fileName: file.name, ten_hoc_sinh: 'N/A', diem_so: 'N/A', errorMessage: 'Không trích xuất được dữ liệu hợp lệ.' });
                }

            } catch (err) {
                const error = err as Error;
                const errorMessage = error.message || 'Lỗi không xác định.';
                if (errorMessage.includes("API Key chưa được thiết lập")) {
                    setError(errorMessage);
                }
                console.error("Lỗi xử lý file:", errorMessage);
                newResults.push({ id: `temp-${Date.now()}-${i}`, status: 'error', fileName: file.name, ten_hoc_sinh: 'N/A', diem_so: 'N/A', errorMessage: errorMessage });
            }
        }

        if (newResults.length > 0) {
            setResults(prev => [...newResults, ...prev]);
        }
        
        setIsLoading(false);
        setProcessingStatus('');
        
    }, [apiKey, dbInstance, userId, requiredColumnsList]);


    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            setFiles(newFiles);
            setEditedScores({});
            setError(null);
            if (newFiles.length > 0) {
                handleProcessFiles(newFiles);
            }
        }
    };
    
    const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const newFiles = Array.from(e.dataTransfer.files);
            setFiles(newFiles);
            setEditedScores({});
            setError(null);
            handleProcessFiles(newFiles);
        }
    };

    const handleDrag = (e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };
    
    const onButtonClick = () => {
        fileInputRef.current?.click();
    };

    // Render logic: Đợi Auth sẵn sàng và có API Key
    if (!isAuthReady || apiKey === null) {
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
        // Chỉ hiện lỗi API Key sau khi Auth đã Ready
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
                    <p className="mt-2 text-md text-gray-400">Ứng dụng đã được nâng cấp với khả năng phân tích và tùy chỉnh cột. User ID: <code className='text-xs bg-gray-700 p-1 rounded'>{userId || 'Đang tải...'}</code></p>
                </div>

                {/* Phần Nhập cột Tùy chỉnh (Dạng Mở rộng) */}
                <div className='mt-6 p-4 bg-gray-700 rounded-xl'>
                    <button 
                        type="button"
                        onClick={() => setIsColumnPickerOpen(prev => !prev)}
                        className='flex justify-between items-center w-full p-3 rounded-lg bg-gray-900 text-gray-100 border border-gray-600 hover:bg-gray-700 transition-colors'
                        style={{ borderColor: isColumnPickerOpen ? accentColor : 'transparent' }}
                    >
                        <span className='font-semibold'>Tùy chỉnh Cột (Đang chọn: {requiredColumnsList.length} cột)</span>
                        <ChevronDownIcon className={`w-5 h-5 transition-transform duration-300 ${isColumnPickerOpen ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {isColumnPickerOpen && (
                        <div className='mt-4 p-4 border border-gray-600 rounded-lg'>
                            <h4 className='text-sm font-bold text-gray-300 mb-2'>1. Chọn các cột phổ biến:</h4>
                            <div className='flex flex-wrap gap-4 text-sm text-gray-300 mb-4'>
                                {['Mã học sinh', 'Tên lớp', 'Chữ ký'].map(col => (
                                    <label key={col} className='flex items-center space-x-2'>
                                        <input
                                            type='checkbox'
                                            checked={customColumnsChecked.includes(col)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setCustomColumnsChecked([...customColumnsChecked, col]);
                                                } else {
                                                    setCustomColumnsChecked(customColumnsChecked.filter(c => c !== col));
                                                }
                                            }}
                                            className='form-checkbox rounded h-4 w-4 text-indigo-500 bg-gray-800 border-gray-600'
                                            style={{ color: accentColor }}
                                        />
                                        <span>{col}</span>
                                    </label>
                                ))}
                            </div>

                            <h4 className='text-sm font-bold text-gray-300 mt-4 mb-2'>2. Thêm cột tùy thích khác:</h4>
                            <input
                                type="text"
                                placeholder='Ví dụ: Ngày thi, Số báo danh (phân tách bằng dấu phẩy)'
                                value={customColumnsText}
                                onChange={(e) => setCustomColumnsText(e.target.value)}
                                className='w-full p-2 rounded-lg bg-gray-900 text-gray-100 border border-gray-600 focus:ring-2 focus:ring-indigo-500'
                            />
                        </div>
                    )}
                </div>


                <div className="mt-8">
                    <form id="form-file-upload" className="relative w-full" onDragEnter={handleDrag}>
                        <input
                            ref={fileInputRef}
                            type="file"
                            id="input-file-upload"
                            multiple={true}
                            accept="image/png, image/jpeg, image/jpg"
                            className="hidden"
                            onChange={handleFileChange}
                        />
                        {/* Hộp tải lên ĐÃ TỐI ƯU HÓA */}
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
                            <p className="font-bold mb-1" style={{ color: accentColor }}>{files.length} File đang xử lý:</p>
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

                {/* Hiển thị Tổng hợp Hiệu suất nếu có dữ liệu */}
                {processedResults.successfulResults.length > 0 && (
                    <>
                        <PerformanceSummary summary={processedResults.performanceSummary} accentColor={accentColor} />
                        <AiFeedbackBox feedback={aiFeedback} accentColor={accentColor} isLoading={isAiFeedbackLoading} />
                    </>
                )}

                {/* Thông báo lỗi nếu có */}
                {error && <p className="mt-4 text-center text-red-400 font-medium p-3 bg-red-900/40 rounded-lg">{error}</p>}
                
                {/* Nút tải về CSV */}
                {processedResults.successfulResults.length > 0 && (
                    <div className="mt-6 flex justify-center">
                        <button 
                            onClick={() => downloadCSV(processedResults.successfulResults)} 
                            className="flex items-center gap-2 rounded-xl px-6 py-3 text-white font-bold shadow-lg transition-all transform hover:scale-[1.03] active:scale-[0.98]"
                            style={{ backgroundColor: accentColor, color: 'white' }}
                        >
                            <CsvIcon className="w-5 h-5" />
                            Tải về CSV ({processedResults.successfulResults.length} kết quả)
                        </button>
                    </div>
                )}
                
                {/* Bảng Kết quả */}
                {processedResults.sortedResults.length > 0 && (
                    <ResultsTable
                        results={processedResults.sortedResults}
                        editedScores={editedScores}
                        onScoreChange={handleScoreChange}
                        onSort={handleSort}
                        sortConfig={sortConfig}
                        customColumnsDisplay={customColumnsDisplay}
                    />
                )}
            </main>
            <footer className="w-full max-w-4xl mx-auto text-center mt-6">
                <p className="text-sm text-gray-500">Powered by Google Gemini. Dữ liệu được lưu trữ trong Firebase Firestore.</p>
            </footer>
        </div>
    );
}
