import React, { useState, useCallback, useRef } from 'react';
import { extractDataFromImage } from './GeminiService';
import { ResultsTable } from './ResultsTable';
import { CsvIcon, SpinnerIcon, UploadIcon } from './icons';
import type { ExtractionResult } from './types';

// Định nghĩa các màu sắc và lớp Tailwind CSS
const colorOptions = [
    { name: 'Teal', class: 'teal' },
    { name: 'Indigo', class: 'indigo' },
    { name: 'Pink', class: 'pink' },
];

// Hàm lấy các lớp màu động dựa trên màu đã chọn
const getColorClasses = (color: string, type: 'text' | 'bg' | 'border') => {
    switch (type) {
        case 'text':
            return `text-${color}-800`;
        case 'bg':
            return `bg-${color}-600 hover:bg-${color}-500 focus-visible:outline-${color}-600`;
        case 'border':
            return `border-${color}-300 hover:bg-${color}-50`;
        default:
            return '';
    }
};


export default function App() {
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<ExtractionResult[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [accentColor, setAccentColor] = useState<'teal' | 'indigo' | 'pink'>('teal'); // State MÀU NỀN
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hàm tải về CSV (Không đổi, dùng TAB)
  const downloadCSV = useCallback((finalResults: ExtractionResult[]) => {
    const successfulResults = finalResults.filter(r => r.status === 'success');
    if (successfulResults.length === 0) {
      return;
    }

    const headers = ['"Tên học sinh"', '"Điểm số"', '"Tên file"'].join('\t');
    const rows = successfulResults.map(r => 
      [`"${r.ten_hoc_sinh}"`, `"${r.diem_so}"`, `"${r.fileName}"`].join('\t') 
    );

    const csvContent = [headers, ...rows].join('\n');
    
    const blob = new Blob(['\uFEFF', csvContent], { type: 'text/csv;charset=utf-8;' }); 
    
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'diem_so_hoc_sinh.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);


  // Hàm xử lý chính (Auto-processing)
  const handleProcessFiles = useCallback(async (filesToProcess: File[]) => {
    if (filesToProcess.length === 0) return;
    setIsLoading(true);
    setResults([]);
    setError(null);
    
    const newResults: ExtractionResult[] = [];
    for (let i = 0; i < filesToProcess.length; i++) {
        setProcessingStatus(`Đang xử lý file ${i + 1} of ${filesToProcess.length}: ${filesToProcess[i].name}`);
        const file = filesToProcess[i];
        try {
            const extractedData = await extractDataFromImage(file);
             
            if (Array.isArray(extractedData) && extractedData.length > 0) {
                extractedData.forEach(data => {
                    newResults.push({
                        status: 'success',
                        fileName: file.name,
                        ten_hoc_sinh: data.ten_hoc_sinh,
                        diem_so: data.diem_so
                    });
                });
            } else {
                newResults.push({
                    status: 'error',
                    fileName: file.name,
                    ten_hoc_sinh: 'N/A',
                    diem_so: 'N/A',
                    errorMessage: 'Không trích xuất được dữ liệu.'
                });
            }

        } catch (err) {
            newResults.push({
                status: 'error',
                fileName: file.name,
                ten_hoc_sinh: 'N/A',
                diem_so: 'N/A',
                errorMessage: err instanceof Error ? err.message : 'Unknown error'
            });
        }
    }

    setResults(newResults);
    setIsLoading(false);
    setProcessingStatus('');
    
    if (newResults.some(r => r.status === 'success')) {
        downloadCSV(newResults);
    }
    
  }, [downloadCSV]);


  // Hàm xử lý thay đổi tệp (TỰ ĐỘNG XỬ LÝ)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
  
  // Hàm xử lý kéo thả (TỰ ĐỘNG XỬ LÝ)
  const handleDrop = (e: React.DragEvent) => {
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


  const handleDrag = (e: React.DragEvent) => {
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
  

  return (
    // Sửa main container và bóng
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8" onDragEnter={handleDrag}>
        {/* KHỐI CHỌN MÀU NỀN */}
        <div className="absolute top-4 right-4 p-3 bg-white rounded-lg shadow-md flex flex-col items-center">
            <p className="text-sm font-semibold text-gray-700 mb-2">Đổi Màu Nhấn</p>
            <div className="flex space-x-2">
                {colorOptions.map((color) => (
                    <button
                        key={color.name}
                        onClick={() => setAccentColor(color.class as 'teal' | 'indigo' | 'pink')}
                        className={`w-6 h-6 rounded-full shadow-sm ring-2 ${color.class === accentColor ? 'ring-offset-2 ring-gray-400' : 'ring-transparent'} 
                                    ${color.class === 'teal' ? 'bg-teal-500' : color.class === 'indigo' ? 'bg-indigo-500' : 'bg-pink-500'}`}
                        title={color.name}
                    />
                ))}
            </div>
        </div>

      <main className={`w-full max-w-4xl mx-auto bg-white p-6 sm:p-8 lg:p-10 rounded-2xl shadow-xl shadow-${accentColor}-100 transition-shadow duration-300`}> 
        <div className="text-center">
            {/* Sửa tiêu đề dùng màu động */}
            <h1 className={`text-3xl sm:text-4xl font-bold ${getColorClasses(accentColor, 'text')}`}>Trích xuất điểm thi tự động</h1>
            <p className="mt-2 text-md text-slate-600">Tải ảnh các bài kiểm tra lên để trích xuất tên học sinh và điểm số.</p>
        </div>

        <div className="mt-8">
          <form id="form-file-upload" className="relative w-full" onDragEnter={handleDrag} onSubmit={(e) => e.preventDefault()}>
            <input ref={fileInputRef} type="file" id="input-file-upload" multiple={true} accept="image/png, image/jpeg, image/jpg" className="hidden" onChange={handleFileChange} />
            {/* Hộp tải lên TỐI GIẢN và TƯƠI SÁNG (dùng màu động) */}
            <label id="label-file-upload" htmlFor="input-file-upload" className={`h-40 border-2 rounded-lg flex flex-col justify-center items-center cursor-pointer transition-all duration-300 
                                    ${dragActive 
                                        ? `border-${accentColor}-600 bg-${accentColor}-100 transform scale-105` 
                                        : `border-dashed border-${accentColor}-300 bg-gray-50 hover:bg-${accentColor}-50`}`} 
                                    onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}>
                <UploadIcon className={`w-12 h-12 text-${accentColor}-500 mb-2`} />
                <p className={`font-semibold text-${accentColor}-800`}>Kéo và thả file tại đây</p>
                <button type="button" onClick={onButtonClick} className="mt-2 rounded-lg bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50">
                    Chọn File
                </button>
            </label>
          </form>
          {files.length > 0 && (
            <div className="mt-4 text-sm text-slate-600">
              <p className="font-semibold">Selected Files (Tự động xử lý):</p>
              <ul className="list-disc list-inside max-h-32 overflow-y-auto mt-1">
                {files.map((file, i) => <li key={i} className="truncate">{file.name}</li>)}
              </ul>
            </div>
          )}
        </div>

        {/* Xóa nút Xử lý chính vì đã tự động hóa */}
        <div className="mt-8 flex flex-col sm:flex-row justify-center items-center gap-4">
            {/* Sử dụng màu động cho trạng thái xử lý */}
            {isLoading && <p className={`mt-4 text-center text-sm ${getColorClasses(accentColor, 'text')} animate-pulse`}>{processingStatus || 'Đang chờ xử lý...'}</p>}
        </div>

        {error && <p className="mt-4 text-center text-red-500">{error}</p>}
        
        <ResultsTable results={results} />
      </main>
      <footer className="w-full max-w-4xl mx-auto text-center mt-6">
        <p className="text-sm text-slate-500">Powered by Google Gemini</p>
      </footer>
    </div>
  );
}
