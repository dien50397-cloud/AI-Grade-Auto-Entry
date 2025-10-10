
import React from 'react';
import type { ExtractionResult } from '../types';
import { CheckCircleIcon, XCircleIcon } from './icons';

interface ResultsTableProps {
  results: ExtractionResult[];
}

export const ResultsTable: React.FC<ResultsTableProps> = ({ results }) => {
  if (results.length === 0) {
    return null;
  }

  return (
    <div className="w-full mt-10 flow-root">
       <h2 className="text-xl font-semibold text-slate-800 mb-4">Extraction Results</h2>
      <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
          <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
            <table className="min-w-full divide-y divide-slate-300">
              <thead className="bg-slate-100">
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-slate-900 sm:pl-6">File Name</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Student Name</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Score</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {results.map((result, index) => (
                  <tr key={index} className={result.status === 'error' ? 'bg-red-50' : ''}>
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-slate-900 sm:pl-6">{result.fileName}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">{result.status === 'success' ? result.ten_hoc_sinh : 'N/A'}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">{result.status === 'success' ? result.diem_so : 'N/A'}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
                      {result.status === 'success' ? (
                        <span className="inline-flex items-center rounded-md bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                          <CheckCircleIcon className="h-4 w-4 mr-1.5 text-green-500" />
                          Success
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-red-100 px-2 py-1 text-xs font-medium text-red-700" title={result.errorMessage}>
                          <XCircleIcon className="h-4 w-4 mr-1.5 text-red-500" />
                          Error
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
