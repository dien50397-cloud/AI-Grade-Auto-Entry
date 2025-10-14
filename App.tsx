import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';

// =======================================================
// 1. TYPES & HẰNG SỐ
// =======================================================

/**
 * Định nghĩa kiểu dữ liệu cho kết quả trích xuất
 * @typedef {object} StudentScore
 * @property {string} ten_hoc_sinh
 * @property {string} diem_so
 * @property {Object.<string, string>} custom_data - Dữ liệu các cột tùy chỉnh
 */

/**
 * Định nghĩa kiểu dữ liệu cho kết quả hiển thị
 * @typedef {object} ExtractionResult
 * @property {'success' | 'error'} status
 * @property {string} fileName
 * @property {string} ten_hoc_sinh
 * @property {string} diem_so
 * @property {Object.<string, string>} custom_data
 * @property {string} [errorMessage]
 */

// KHAI BÁO CÁC HẰNG SỐ CỦA DỊCH VỤ (KHÔNG BAO GỒM API KEY)
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent";
const DEFAULT_CUSTOM_COLUMNS = ['Mã học sinh', 'Tên lớp', 'Chữ ký', 'Số báo danh']; // Cột mặc định cho checkbox

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
 * @param {string[]} requiredColumns - Các cột tùy chỉnh cần trích xuất
 * @returns {Promise<StudentScore[]>}
 */
const extractDataFromImage = async (imageFile, apiKey, requiredColumns) => {
    if (!apiKey) {
         throw new Error("API Key chưa được thiết lập. (Lỗi Runtime)");
    }

    const model = 'gemini-2.5-flash-preview-05-20';
    const imagePart = await fileToGenerativePart(imageFile);
    
    const columnsStr = requiredColumns.join(', ');

    // Prompt yêu cầu trích xuất cột tùy chỉnh, chuẩn hóa tên và điểm
    const prompt = `Bạn là một CHUYÊN GIA PHÂN TÍCH BÀI KIỂM TRA. Từ hình ảnh danh sách điểm, hãy trích xuất **TẤT CẢ** các cột sau: [${columnsStr}].

YÊU CẦU:
1. Trích xuất tất cả học sinh.
2. Cột Tên học sinh phải được chuẩn hóa về định dạng Proper Case (Ví dụ: 'nguyẽn văn a' -> 'Nguyễn Văn A').
3. Điểm số (nếu có) phải được chuẩn hóa về thang điểm 10.0 (nếu phát hiện thang điểm khác, hãy quy đổi về 10.0).
4. Đảm bảo trả về chính xác các trường trong cấu trúc JSON.`;

    // Định nghĩa Schema dựa trên các cột tùy chỉnh
    const properties = {
        ten_hoc_sinh: { type: "STRING", description: "Họ tên đầy đủ của học sinh (đã chuẩn hóa)." },
        diem_so: { type: "STRING", description: "Điểm số cuối cùng đã chuẩn hóa về thang 10.0." }
    };

    const requiredFields = ['ten_hoc_sinh', 'diem_so'];

    // Thêm cột tùy chỉnh vào schema
    requiredColumns.forEach(col => {
        const standardizedKey = `col_${col.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase()}`;
        if (col.toLowerCase() !== 'tên học sinh' && col.toLowerCase() !== 'điểm số') {
            properties[standardizedKey] = { 
                type: "STRING", 
                description: `Dữ liệu trích xuất cho cột: ${col}` 
            };
            requiredFields.push(standardizedKey);
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

                // Chuyển đổi tên trường tùy chỉnh để khớp với cấu trúc trong React
                const standardizedData = parsedData.map(item => {
                    const newItem = { ten_hoc_sinh: item.ten_hoc_sinh, diem_so: item.diem_so, custom_data: {} };
                    Object.keys(item).forEach(key => {
                        if (key.startsWith('col_')) {
                            // Lưu trữ tất cả dữ liệu cột tùy chỉnh trong đối tượng custom_data
                            const originalColName = requiredColumns.find(col => `col_${col.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase()}` === key);
                            if (originalColName) {
                                newItem.custom_data[originalColName] = item[key];
                            }
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

/**
 * Hàm gọi AI lần 2 để lấy nhận xét (feedback)
 */
const getAiFeedback = async (apiKey, successfulResults, performanceSummary) => {
    if (!apiKey || successfulResults.length === 0) return null;

    const dataSnapshot = successfulResults.map(r => ({
        ten_hoc_sinh: r.ten_hoc_sinh,
        diem_so: r.diem_so,
    }));

    const prompt = `Phân tích bộ dữ liệu điểm số sau: ${JSON.stringify(dataSnapshot)}. Điểm trung bình là ${performanceSummary.averageScore}, Tỷ lệ đỗ là ${performanceSummary.passRate}. Dựa trên các chỉ số này, hãy đưa ra một nhận xét ngắn gọn (tối đa 2 câu) về hiệu suất của lớp. Nếu phát hiện điểm số bất thường (quá cao hoặc quá thấp so với trung bình), hãy đưa ra cảnh báo.`;

    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
    };

    try {
        const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
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

const InfoIcon = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-info">
        <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
    </svg>
);

const ChevronDown = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-down">
        <path d="m6 9 6 6 6-6"/>
    </svg>
);


// =======================================================
// 3. RESULTS TABLE COMPONENTS (Đã hợp nhất Logic)
// =======================================================

/**
 * Component hiển thị tóm tắt hiệu suất lớp học
 */
const PerformanceSummary = ({ summary, accentColor }) => {
    const data = [
        { label: "Tổng số học sinh", value: summary.totalStudents },
        { label: "Điểm trung bình lớp", value: `${summary.averageScore} / 10.0`, color: summary.averageScore >= 5.0 ? 'text-green-400' : 'text-red-400' },
        { label: "Tỷ lệ Đỗ ({'>'}= 5.0)", value: `${summary.passRate}%`, color: summary.passRate >= 70 ? 'text-green-400' : 'text-yellow-400' },
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

/**
 * Component hiển thị thông tin phản hồi từ AI
 */
const AiFeedbackBox = ({ feedback, accentColor, isLoading }) => {
    if (!feedback) return null;

    const isWarning = feedback.toLowerCase().includes('bất thường') || feedback.toLowerCase().includes('cảnh báo');

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
const ResultsTable = ({ results, editedScores, onScoreChange, onSort, sortConfig, customColumnsDisplay }) => {
    
    // Tạo tiêu đề động cho bảng
    const headers = [
        { key: 'status', label: 'Trạng thái', sortable: false },
        { key: 'ten_hoc_sinh', label: 'Tên Học sinh', sortable: true },
    ];

    // Thêm các cột tùy chỉnh vào header
    customColumnsDisplay.forEach((colName, index) => {
        headers.push({ 
            key: `custom_data_${colName}`, // Sử dụng tên cột gốc làm key
            label: colName,
            sortable: false 
        });
    });

    headers.push({ key: 'diem_so', label: 'Điểm số (Thang 10)', sortable: true });

    const getSortIndicator = (key) => {
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
                                onClick={() => header.sortable && onSort(header.key)}
                                style={{ width: header.key === 'diem_so' ? '120px' : header.key === 'status' ? '100px' : 'auto' }}
                            >
                                {header.label}
                                {getSortIndicator(header.key)}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                    {results.map((result, index) => {
                        const editKey = `${index}_${result.fileName}`;
                        const isEdited = !!editedScores[editKey];
                        const displayScore = editedScores[editKey] || result.diem_so;

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

                                {customColumnsDisplay.map((colName, colIndex) => (
                                    <td key={colIndex} className="px-4 py-3 text-sm text-gray-400 break-words min-w-[100px] max-w-[200px]">
                                        {result.custom_data[colName] || 'N/A'}
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
                                            onChange={(e) => onScoreChange(index, result.fileName, e.target.value)}
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
    const [files, setFiles] = useState([]);
    /** @type {[ExtractionResult[], React.Dispatch<React.SetStateAction<ExtractionResult[]>>]} */
    const [results, setResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [dragActive, setDragActive] = useState(false);
    const [processingStatus, setProcessingStatus] = useState('');
    
    // --- States Tùy chỉnh (Sử dụng localStorage)
    const getInitialConfig = (key, defaultValue) => {
        try {
            const saved = localStorage.getItem(key);
            // THAY ĐỔI: Phân tích JSON cho mảng/Set nếu cần
            if (key === 'selectedCheckboxes' && saved) {
                return new Set(JSON.parse(saved));
            }
            return saved !== null ? saved : defaultValue;
        } catch (e) {
            console.error("Lỗi khi đọc localStorage:", e);
            return defaultValue;
        }
    };

    const [accentColor, setAccentColorState] = useState(getInitialConfig('accentColor', '#4f46e5')); 
    // State cho cột tùy chỉnh (Mã hóa: "Cột 1, Cột 2")
    const [customColumnsString, setCustomColumnsString] = useState(getInitialConfig('customColumnsString', '')); 
    // State quản lý trạng thái mở/đóng của khu vực chọn cột
    const [isColumnPickerOpen, setIsColumnPickerOpen] = useState(false);
    
    // State cho các checkbox đã chọn
    const [selectedCheckboxes, setSelectedCheckboxes] = useState(() => {
        const initialSet = getInitialConfig('selectedCheckboxes', new Set());
        // Đảm bảo các cột mặc định luôn được kiểm tra nếu có trong Set
        if (initialSet instanceof Set) {
            return initialSet;
        }
        return new Set();
    });

    const setAccentColor = (newColor) => {
        setAccentColorState(newColor);
        try { localStorage.setItem('accentColor', newColor); } catch (e) {}
    };

    const handleSetCustomColumnsString = (newCols) => {
        setCustomColumnsString(newCols);
        try { localStorage.setItem('customColumnsString', newCols); } catch (e) {}
    };

    // Hàm cập nhật Checkbox (và lưu vào localStorage)
    const handleCheckboxChange = (colName, isChecked) => {
        setSelectedCheckboxes(prev => {
            const newSet = new Set(prev);
            if (isChecked) {
                newSet.add(colName);
            } else {
                newSet.delete(colName);
            }
            
            // Lưu Set vào localStorage
            try { localStorage.setItem('selectedCheckboxes', JSON.stringify(Array.from(newSet))); } catch (e) {}

            return newSet;
        });
    };
    
    
    const fileInputRef = useRef(null);
    const [apiKey, setApiKey] = useState(null); // API Key từ State (an toàn)
    const [filter, setFilter] = useState('all'); // 'all', 'pass', 'fail'
    const [sortConfig, setSortConfig] = useState({ key: 'ten_hoc_sinh', direction: 'ascending' });
    /** @type {[Object.<string, string>, React.Dispatch<React.SetStateAction<Object.<string, string>>>]} */
    const [editedScores, setEditedScores] = useState({}); // { index_fileName: 'new_score' }
    const [aiFeedback, setAiFeedback] = useState(null);
    const [isAiFeedbackLoading, setIsAiFeedbackLoading] = useState(false);


    // --- Logic Xử lý Cột Tùy chỉnh
    const customColumnsDisplay = useMemo(() => {
        // Cột từ input tùy chỉnh
        const inputCols = customColumnsString.split(',').map(c => c.trim()).filter(c => c.length > 0 && !DEFAULT_CUSTOM_COLUMNS.includes(c));
        // Cột từ checkbox
        const allCols = [...Array.from(selectedCheckboxes), ...inputCols];
        // Loại bỏ các cột trùng lặp và trả về mảng duy nhất
        return Array.from(new Set(allCols));
    }, [customColumnsString, selectedCheckboxes]);

    // 1. Khởi tạo API Key an toàn
    useEffect(() => {
        let key = "";
        try {
            if (typeof import.meta !== 'undefined' && import.meta.env) {
                key = import.meta.env.VITE_GEMINI_API_KEY || "";
            }
        } catch (e) {}
        
        if (typeof __api_key !== 'undefined') {
            key = __api_key;
        }

        setApiKey(key);
    }, []);

    // 2. Logic API Callback (Sử dụng API Key từ State)
    const extractDataFromImageCallback = useCallback(async (imageFile) => {
        // Lấy tên cột tùy chỉnh
        const requiredColumns = ['Tên học sinh', 'Điểm số', ...customColumnsDisplay];

        if (!apiKey) {
            throw new Error("API Key chưa được thiết lập. (Lỗi Runtime)");
        }
        return extractDataFromImage(imageFile, apiKey, requiredColumns);
    }, [apiKey, customColumnsDisplay]);

    // 3. Logic Tóm tắt Hiệu suất & Sắp xếp (useMemo)

    const processedResults = useMemo(() => {
        // Áp dụng điểm đã chỉnh sửa
        const resultsWithEdits = results.map((result, index) => {
            const editKey = `${index}_${result.fileName}`;
            const score = editedScores[editKey] !== undefined ? editedScores[editKey] : result.diem_so;
            
            if (result.status === 'success' || score !== 'N/A') {
                return { ...result, diem_so: score };
            }
            return null;
        }).filter(r => r !== null && r.diem_so !== 'N/A' && r.diem_so !== ''); 

        // Tính tóm tắt hiệu suất
        const totalStudents = resultsWithEdits.length;
        const totalScore = resultsWithEdits.reduce((sum, r) => sum + parseFloat(r.diem_so || 0), 0);
        const averageScore = totalStudents > 0 ? (totalScore / totalStudents).toFixed(2) : 0;
        const passCount = resultsWithEdits.filter(r => parseFloat(r.diem_so) >= 5.0).length;
        const passRate = totalStudents > 0 ? (passCount / totalStudents * 100).toFixed(1) : 0;
        const excellentCount = resultsWithEdits.filter(r => parseFloat(r.diem_so) >= 8.0).length;

        const performanceSummary = {
            totalStudents,
            averageScore: parseFloat(averageScore),
            passCount,
            passRate: parseFloat(passRate),
            excellentCount
        };

        // Áp dụng Lọc
        const filtered = results.filter(r => {
            if (r.status === 'error' && filter === 'all') return true; 
            
            const score = parseFloat(editedScores[`${results.indexOf(r)}_${r.fileName}`] || r.diem_so || 0);

            if (filter === 'pass') return r.status === 'success' && score >= 5.0;
            if (filter === 'fail') return r.status === 'success' && score < 5.0;
            
            return true; // "all"
        });

        // Áp dụng Sắp xếp
        const sorted = [...filtered].sort((a, b) => {
            const getScore = (result) => parseFloat(editedScores[`${results.indexOf(result)}_${result.fileName}`] || result.diem_so || -1);
            const aValue = a[sortConfig.key] || getScore(a);
            const bValue = b[sortConfig.key] || getScore(b);
            
            if (sortConfig.key === 'ten_hoc_sinh') {
                if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
            } else if (sortConfig.key === 'diem_so') {
                const aNum = getScore(a); 
                const bNum = getScore(b); 
                if (aNum < bNum) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aNum > bNum) return sortConfig.direction === 'ascending' ? 1 : -1;
            }
            return 0;
        });

        return { sortedResults: sorted, performanceSummary, successfulResults: resultsWithEdits };

    }, [results, filter, sortConfig, editedScores, customColumnsDisplay]);
    
    // 4. Effect để gọi AI Feedback sau khi xử lý xong (Lần gọi thứ 2)
    useEffect(() => {
        if (!isLoading && processedResults.successfulResults.length > 0) {
            setIsAiFeedbackLoading(true);
            getAiFeedback(apiKey, processedResults.successfulResults, processedResults.performanceSummary)
                .then(setAiFeedback)
                .catch(e => setAiFeedback(`Lỗi khi phân tích AI: ${e.message}`))
                .finally(() => setIsAiFeedbackLoading(false));
        } else if (results.length === 0) {
            setAiFeedback(null);
        }
    }, [isLoading, processedResults.successfulResults.length, apiKey, processedResults.performanceSummary]);


    // --- Handlers

    // Hàm tải về CSV (ĐÃ SỬA LỖI ĐỊNH DẠNG CSV VÀ ÁP DỤNG ĐA CỘT TÙY CHỈNH)
    const downloadCSV = useCallback((finalResults) => {
        const successfulResults = finalResults.filter(r => r.status === 'success');
        if (successfulResults.length === 0) return;

        // Xử lý tiêu đề cột tùy chỉnh
        const customColumnsHeader = customColumnsDisplay;
        const headers = ['"Tên học sinh"', '"Điểm số"', ...customColumnsHeader.map(h => `"${h}"`)].join(';'); // Sử dụng Dấu chấm phẩy (;)
        
        const rows = successfulResults.map(r => {
            const displayScore = r.diem_so; 
            
            const fields = [`"${r.ten_hoc_sinh}"`, `"${displayScore}"`];
            // Thêm dữ liệu tùy chỉnh (ĐÃ HỖ TRỢ ĐA CỘT)
            customColumnsDisplay.forEach(colName => {
                fields.push(`"${r.custom_data[colName] || ''}"`);
            });

            return fields.join(';');
        });

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
    }, [customColumnsDisplay]);

    // Xử lý sự kiện chỉnh sửa điểm thủ công
    const handleScoreChange = useCallback((index, fileName, newScore) => {
        const editKey = `${index}_${fileName}`;
        setEditedScores(prev => ({ ...prev, [editKey]: newScore }));

    }, []);

    // Xử lý sự kiện click tiêu đề bảng để sắp xếp
    const handleSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    // Hàm xử lý chính (Auto-processing)
    const handleProcessFiles = useCallback(async (filesToProcess) => {
        if (filesToProcess.length === 0) return;
        setIsLoading(true);
        setResults([]);
        setEditedScores({}); // Reset điểm đã chỉnh sửa
        setError(null);
        setAiFeedback(null);
        
        /** @type {ExtractionResult[]} */
        const newResults = [];
        
        for (let i = 0; i < filesToProcess.length; i++) {
            const file = filesToProcess[i];
            setProcessingStatus(`Đang xử lý file ${i + 1} of ${filesToProcess.length}: ${file.name}`);
            
            try {
                const extractedData = await extractDataFromImageCallback(file);
                
                if (Array.isArray(extractedData) && extractedData.length > 0) {
                    extractedData.forEach(data => {
                        newResults.push({
                            status: 'success',
                            fileName: file.name,
                            ten_hoc_sinh: data.ten_hoc_sinh || 'N/A',
                            diem_so: data.diem_so || 'N/A',
                            custom_data: data.custom_data || {},
                        });
                    });
                } else {
                    newResults.push({ status: 'error', fileName: file.name, ten_hoc_sinh: 'N/A', diem_so: 'N/A', errorMessage: 'Không trích xuất được dữ liệu hợp lệ.' });
                }

            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Lỗi không xác định.';
                if (errorMessage.includes("API Key chưa được thiết lập")) {
                    setError(errorMessage);
                }
                newResults.push({ status: 'error', fileName: file.name, ten_hoc_sinh: 'N/A', diem_so: 'N/A', errorMessage: errorMessage });
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
    
    // Xử lý kéo thả
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
    
    // --- Render Logic (UI)

    // Nếu API key đang trong quá trình tải hoặc bị thiếu, hiển thị thông báo
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
                    <p className="mt-2 text-md text-gray-400">Ứng dụng đã được nâng cấp với khả năng phân tích và tùy chỉnh cột.</p>
                </div>

                {/* Phần Nhập cột Tùy chỉnh (DẠNG MỞ RỘNG MỚI) */}
                <div className='mt-6 p-4 bg-gray-700/50 rounded-xl'>
                    <button 
                        onClick={() => setIsColumnPickerOpen(prev => !prev)}
                        className='w-full flex justify-between items-center p-3 rounded-lg bg-gray-900 text-gray-100 border border-gray-600 hover:bg-gray-700/70 transition-colors'
                        style={{ borderColor: accentColor }}
                    >
                        <span className='font-medium text-sm'>
                            Cột Cần Trích Xuất (Đã chọn: {customColumnsDisplay.length} cột)
                        </span>
                        <ChevronDown className={`w-5 h-5 transition-transform ${isColumnPickerOpen ? 'rotate-180' : 'rotate-0'}`} style={{ color: accentColor }} />
                    </button>
                    
                    <div className={`overflow-hidden transition-all duration-300 ${isColumnPickerOpen ? 'max-h-96 opacity-100 mt-3' : 'max-h-0 opacity-0'}`}>
                        <div className="p-3 border border-gray-600 rounded-lg bg-gray-900 space-y-4">
                            
                            {/* Checkboxes Đề xuất */}
                            <label className='block text-xs font-semibold text-gray-400 mb-2 border-b border-gray-700 pb-1'>Cột thường dùng:</label>
                            <div className='flex flex-wrap gap-x-4 gap-y-2'>
                                {DEFAULT_CUSTOM_COLUMNS.map(col => (
                                    <label key={col} className="flex items-center text-gray-400 text-sm cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={selectedCheckboxes.has(col)}
                                            onChange={(e) => handleCheckboxChange(col, e.target.checked)}
                                            className="h-4 w-4 text-indigo-600 rounded border-gray-600 focus:ring-indigo-500 bg-gray-700"
                                            style={{ accentColor: accentColor }}
                                        />
                                        <span className="ml-2">{col}</span>
                                    </label>
                                ))}
                            </div>

                            {/* Input Tùy chỉnh */}
                            <label htmlFor="custom-columns-input" className='block text-xs font-semibold text-gray-400 pt-3 mt-3 border-t border-gray-700'>
                                Nhập cột khác (phân tách bằng dấu phẩy):
                            </label>
                            <input
                                id="custom-columns-input"
                                type="text"
                                placeholder='Ví dụ: Chữ ký, Số báo danh'
                                value={customColumnsString}
                                onChange={(e) => handleSetCustomColumnsString(e.target.value)}
                                className='w-full p-2 rounded-lg bg-gray-800 text-gray-100 border border-gray-600 focus:ring-2 focus:ring-indigo-500'
                                style={{ borderColor: accentColor }}
                            />
                        </div>
                    </div>
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
                <p className="text-sm text-gray-500">Powered by Google Gemini</p>
            </footer>
            {/* Modal Image Preview (Không cần thiết trong phiên bản này) */}
        </div>
    );
}
