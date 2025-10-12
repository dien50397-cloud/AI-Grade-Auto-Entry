import React, { useState, useCallback, useRef } from 'react';
import { extractDataFromImage } from './GeminiService';
import { ResultsTable } from './ResultsTable';
import { CsvIcon, SpinnerIcon, UploadIcon } from './icons';
import type { ExtractionResult } from './types';

// Hàm mặc định này sẽ bị xóa vì chúng ta dùng màu Hex trực tiếp
// const getColorClasses = (color: string, type: 'text' | 'bg' | 'border') => { ... };

export default function App() {
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<ExtractionResult[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  // State màu nền đã chuyển sang dùng mã Hex mặc định của Teal
  const [accentColor, setAccentColor] = useState<string>('#0d9488'); 
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hàm tải về CSV (Không đổi)
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
      set
