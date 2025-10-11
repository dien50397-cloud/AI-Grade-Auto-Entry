
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
      setResults([]);
      setError(null);
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
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFiles(Array.from(e.dataTransfer.files));
      setResults([]);
      setError(null);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleProcessFiles = useCallback(async () => {
    if (files.length === 0) return;
    setIsLoading(true);
    setResults([]);
    setError(null);
    
    const newResults: ExtractionResult[] = [];
    for (let i = 0; i < files.length; i++) {
        setProcessingStatus(`Processing file ${i + 1} of ${files.length}: ${files[i].name}`);
        const file = files[i];
        try {
            const data = await extractDataFromImage(file);
            newResults.push({
                status: 'success',
                fileName: file.name,
                ten_hoc_sinh: data.ten_hoc_sinh,
                diem_so: data.diem_so
            });
        } catch (err) {
            newResults.push({
                status: 'error',
                fileName: file.name,
                ten_hoc_sinh: '',
                diem_so: '',
                errorMessage: err instanceof Error ? err.message : 'Unknown error'
            });
        }
    }

    setResults(newResults);
    setIsLoading(false);
    setProcessingStatus('');
  }, [files]);

const downloadCSV = () => {
    const successfulResults = results.filter(r => r.status === 'success');
    if (successfulResults.length === 0) {
      alert("No successful extractions to download.");
      return;
    }

    const headers = ['"ten_hoc_sinh"', '"diem_so"', '"file_name"'];
    const rows = successfulResults.map(r => 
      [`"${r.ten_hoc_sinh}"`, `"${r.diem_so}"`, `"${r.fileName}"`].join(',')
    );

    const csvContent = [headers.join(','), ...rows].join('\n');
    
    // Dòng ĐÃ SỬA: Thêm Byte Order Mark ('\uFEFF') để buộc Excel dùng UTF-8
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
  };
  const hasSuccessfulResults = results.some(r => r.status === 'success');

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8" onDragEnter={handleDrag}>
      <main className="w-full max-w-4xl mx-auto bg-white p-6 sm:p-8 lg:p-10 rounded-2xl shadow-lg">
        <div className="text-center">
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-800">Trích xuất điểm thi tự động</h1>
            <p className="mt-2 text-md text-slate-600">Upload images of test papers to extract student names and scores.</p>
        </div>

        <div className="mt-8">
          <form id="form-file-upload" className="relative w-full" onDragEnter={handleDrag} onSubmit={(e) => e.preventDefault()}>
            <input ref={fileInputRef} type="file" id="input-file-upload" multiple={true} accept="image/png, image/jpeg, image/jpg" className="hidden" onChange={handleFileChange} />
            <label id="label-file-upload" htmlFor="input-file-upload" className={`h-64 border-2 rounded-lg flex flex-col justify-center items-center cursor-pointer transition-colors ${dragActive ? "border-blue-500 bg-blue-50" : "border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100"}`} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}>
                <UploadIcon className="w-12 h-12 text-slate-400 mb-2" />
                <p className="font-semibold text-slate-700">Drag and drop your files here or</p>
                <button type="button" onClick={onButtonClick} className="mt-2 rounded-md bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50">
                    Browse Files
                </button>
            </label>
          </form>
          {files.length > 0 && (
            <div className="mt-4 text-sm text-slate-600">
              <p className="font-semibold">Selected Files:</p>
              <ul className="list-disc list-inside max-h-32 overflow-y-auto mt-1">
                {files.map((file, i) => <li key={i} className="truncate">{file.name}</li>)}
              </ul>
            </div>
          )}
        </div>

        <div className="mt-8 flex flex-col sm:flex-row justify-center items-center gap-4">
          <button
            onClick={handleProcessFiles}
            disabled={files.length === 0 || isLoading}
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-md bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:bg-slate-400 disabled:cursor-not-allowed"
          >
            {isLoading ? <SpinnerIcon className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" /> : null}
            {isLoading ? 'Processing...' : `Process ${files.length} File${files.length !== 1 ? 's' : ''}`}
          </button>
          
          {results.length > 0 && hasSuccessfulResults && (
            <button
              onClick={downloadCSV}
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-md bg-green-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-green-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600"
            >
              <CsvIcon className="h-5 w-5 mr-2" />
              Download Results (.csv)
            </button>
          )}
        </div>

        {isLoading && <p className="mt-4 text-center text-sm text-slate-500 animate-pulse">{processingStatus}</p>}
        {error && <p className="mt-4 text-center text-red-500">{error}</p>}
        
        <ResultsTable results={results} />
      </main>
      <footer className="w-full max-w-4xl mx-auto text-center mt-6">
        <p className="text-sm text-slate-500">Powered by Google Gemini</p>
      </footer>
    </div>
  );
}
