import React, { useState, useCallback, useRef } from 'react';
import { extractDataFromImage } from './GeminiService';
import { ResultsTable } from './ResultsTable';
import { CsvIcon, SpinnerIcon, UploadIcon } from './icons';
import type { ExtractionResult } from './types';

export default function App() {
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<ExtractionResult[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hàm tải về CSV (Dùng TAB để chắc chắn tách cột)
  const downloadCSV = useCallback((finalResults: ExtractionResult[]) => {
    const successfulResults = finalResults.filter(r => r.status === 'success');
    if (successfulResults.length === 0) {
      return;
    }

    // SỬ DỤNG KÝ TỰ TAB ('\t') LÀM DẤU PHÂN CÁCH CUỐI CÙNG
    const headers = ['"Tên học sinh"', '"Điểm số"', '"Tên file"'].join('\t');
    const rows = successfulResults.map(r => 
      // Thay đổi sang join('\t') để tách cột bằng ký tự Tab
      [`"${r.ten_hoc_sinh}"`, `"${r.diem_so}"`, `"${r.fileName}"`].join('\t') 
    );

    const csvContent = [headers, ...rows].join('\n');
    
    // Giữ lại BOM ('\uFEFF') để buộc Excel hiển thị Tiếng Việt
    const blob = new Blob(['\uFEFF', csvContent], { type: 'text/csv;charset=utf-8;' }); 
    
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'diem_so_hoc_sinh.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click(); // Kích hoạt tải về
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);


  // Hàm xử lý chính (đã sửa để nhận files trực tiếp và kích hoạt auto-download)
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
            // HÀM NÀY ĐƯỢC CẤU HÌNH ĐỂ TRẢ VỀ MẢNG KẾT QUẢ
            const extractedData = await extractDataFromImage(file);
             
            // Xử lý và kiểm tra mảng kết quả (Logic Fix)
            if (Array.isArray(extractedData) && extractedData.length > 0) {
                // Lặp qua TẤT CẢ các kết quả trong mảng
                extractedData.forEach(data => {
                    newResults.push({
                        status: 'success',
                        fileName: file.name,
                        ten_hoc_sinh: data.ten_hoc_sinh,
                        diem_so: data.diem_so
                    });
                });
            } else {
                // Thêm kết quả rỗng nếu không có dữ liệu nào được trích xuất
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
    
    // TỰ ĐỘNG GỌI HÀM TẢI VỀ SAU KHI XỬ LÝ XONG
    if (newResults.some(r => r.status === 'success')) {
        downloadCSV(newResults);
    }
    
  }, [downloadCSV]); // Phụ thuộc vào downloadCSV


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
      <main className="w-full max-w-4xl mx-auto bg-white p-6 sm:p-8 lg:p-10 rounded-2xl shadow-xl shadow-amber-100"> 
        <div className="text-center">
            {/* Sửa tiêu đề */}
            <h1 className="text-3xl sm:text-4xl font-bold text-teal-800">Trích xuất điểm thi tự động</h1>
            <p className="mt-2 text-md text-slate-600">Tải ảnh các bài kiểm tra lên để trích xuất tên học sinh và điểm số.</p>
        </div>

        <div className="mt-8">
          <form id="form-file-upload" className="relative w-full" onDragEnter={handleDrag} onSubmit={(e) => e.preventDefault()}>
            <input ref={fileInputRef} type="file" id="input-file-upload" multiple={true} accept="image/png, image/jpeg, image/jpg" className="hidden" onChange={handleFileChange} />
            {/* Hộp tải lên TỐI GIẢN (h-40) và tươi sáng (Teal) */}
            <label id="label-file-upload" htmlFor="input-file-upload" className={`h-40 border-2 rounded-lg flex flex-col justify-center items-center cursor-pointer transition-colors ${dragActive ? "border-teal-500 bg-teal-100" : "border-dashed border-teal-300 bg-teal-50 hover:bg-teal-100"}`} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}>
                <UploadIcon className="w-12 h-12 text-teal-400 mb-2" />
                <p className="font-semibold text-teal-800">Kéo và thả file tại đây</p>
                <button type="button" onClick={onButtonClick} className="mt-2 rounded-md bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50">
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
            {isLoading && <p className="mt-4 text-center text-sm text-teal-700 animate-pulse">{processingStatus || 'Đang chờ xử lý...'}</p>}
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
