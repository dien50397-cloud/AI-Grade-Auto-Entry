
export interface StudentScore {
  ten_hoc_sinh: string;
  diem_so: string | number;
}

export interface ExtractionResult {
  fileName: string;
  status: 'success' | 'error';
  ten_hoc_sinh: string;
  diem_so: string | number;
  errorMessage?: string;
}
