// dien50397-cloud/ai-grade-auto-entry/AI-Grade-Auto-Entry-a82c0aeeb5a2e37bbb85c12d2a70933e43fdd660/index.tsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
// BỔ SUNG: Dòng này đảm bảo tệp CSS chính (chứa Tailwind) được tải vào ứng dụng
import './index.css'; 

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
