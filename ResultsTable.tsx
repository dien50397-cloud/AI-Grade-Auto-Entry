// ResultsTable.tsx

import React from 'react';
import { Result } from './types'; 
import { CsvIcon } from './icons'; 

// Hàm chuyển đổi dữ liệu thành CSV (Không thay đổi)
const convertToCSV = (data: Result[]): string => {
    const headers = ["Tên Học Sinh", "Môn Học", "Điểm Cuối Cùng"];
    const csvRows = [];
    
    // Thêm hàng tiêu đề
    csvRows.push(headers.join(','));

    // Thêm dữ liệu
    for (const item of data) {
        // Đảm bảo dữ liệu được bọc trong dấu ngoặc kép để xử lý tên có dấu phẩy, và xử lý dấu nháy kép
        const values = [
            `"${item.student_name.replace(/"/g, '""')}"`, 
            `"${item.subject.replace(/"/g, '""')}"`,
            item.final_score.toString().replace(/"/g, '""')
        ];
        csvRows.push(values.join(','));
    }

    // Byte Order Mark (BOM) \ufeff giúp Excel mở file CSV tiếng Việt đúng encoding (UTF-8)
    return csvRows.join('\n');
};

const ResultsTable: React.FC<{ results: Result[] }> = ({ results }) => {

    const handleExport = () => {
        if (results.length === 0) {
            alert('Không có dữ liệu để xuất!');
            return;
        }

        const csvString = convertToCSV(results);
        
        // Tạo đối tượng Blob
        const blob = new Blob(['\ufeff', csvString], { type: 'text/csv;charset=utf-8;' });
        
        // Tạo URL tải xuống
        const link = document.createElement("a");
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", "ket_qua_nhap_diem.csv");
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url); // Dọn dẹp URL tạm thời
        }
    };

    return (
        // ĐỔI MÀU CHO DARK MODE
        <div className="shadow-lg overflow-hidden rounded-md border border-gray-700">
            {/* Nút Export - ĐỔI MÀU CHO DARK MODE */}
            <div className="flex justify-end p-2 bg-gray-700 border-b border-gray-600">
                 <button
                    onClick={handleExport}
                    // Dùng màu sáng hơn cho nút Export để nổi bật trên nền tối
                    className="flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-green-500 hover:bg-green-600 shadow-sm transition duration-150"
                 >
                    <CsvIcon className="w-4 h-4 mr-2" />
                    Xuất CSV
                 </button>
            </div>

            <div className="overflow-x-auto">
                {/* Đổi màu đường chia của bảng */}
                <table className="min-w-full divide-y divide-gray-700">
                    
                    {/* ĐẦU BẢNG: Giữ màu Blue đậm để làm nổi bật */}
                    <thead className="bg-blue-800">
                        <tr>
                            <th className="px-5 py-2 text-left text-xs font-medium text-white uppercase tracking-wider">
                                Tên Học Sinh
                            </th>
                            <th className="px-5 py-2 text-left text-xs font-medium text-white uppercase tracking-wider">
                                Môn Học
                            </th>
                            <th className="px-5 py-2 text-left text-xs font-medium text-white uppercase tracking-wider">
                                Điểm Cuối Cùng
                            </th>
                        </tr>
                    </thead>
                    
                    {/* THÂN BẢNG: Hàng xen kẽ màu Dark Mode */}
                    <tbody className="bg-gray-800 divide-y divide-gray-700">
                        {results.map((item, index) => (
                            <tr 
                                key={index} 
                                // Hàng xen kẽ màu Dark Mode: Hàng chẵn (index % 2 === 0) màu nền đậm, hàng lẻ màu nền sáng hơn
                                className={index % 2 === 0 ? 'bg-gray-800' : 'bg-gray-700 hover:bg-gray-600 transition duration-100'}
                            >
                                {/* Tên Học Sinh: Màu trắng */}
                                <td className="px-5 py-3 whitespace-nowrap text-sm font-medium text-white">
                                    {item.student_name}
                                </td>
                                {/* Môn Học: Màu xám nhạt */}
                                <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-400">
                                    {item.subject}
                                </td>
                                {/* Điểm Cuối Cùng: Màu Xanh Sáng cho Dark Mode */}
                                <td className="px-5 py-3 whitespace-nowrap text-base font-extrabold text-blue-400">
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
