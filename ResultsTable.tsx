// ResultsTable.tsx

import React from 'react';
import { Result } from './types'; // Giả định bạn có tệp types.ts

const ResultsTable: React.FC<{ results: Result[] }> = ({ results }) => {

    const handleExport = () => {
        alert('Chức năng xuất dữ liệu đang được phát triển!');
    };

    return (
        <div className="shadow-2xl overflow-hidden rounded-xl border border-gray-200">
            {/* Nút Export */}
            <div className="flex justify-end p-3 bg-gray-50 border-b">
                 <button
                    onClick={handleExport}
                    className="flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-green-600 hover:bg-green-700 shadow-md transition duration-150"
                 >
                    Xuất CSV
                 </button>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    
                    {/* ĐẦU BẢNG */}
                    <thead className="bg-indigo-600">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                                Tên Học Sinh
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                                Môn Học
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                                Điểm Cuối Cùng
                            </th>
                        </tr>
                    </thead>
                    
                    {/* THÂN BẢNG */}
                    <tbody className="bg-white divide-y divide-gray-200">
                        {results.map((item, index) => (
                            <tr 
                                key={index} 
                                className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50 hover:bg-gray-100 transition duration-100'}
                            >
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {item.student_name}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {item.subject}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-lg font-extrabold text-indigo-700">
                                    {item.final_score}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ResultsTable;
