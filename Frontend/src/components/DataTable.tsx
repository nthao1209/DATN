import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  ChevronLeft, ChevronRight, AlertCircle, Loader2 
} from 'lucide-react';
import TableActionBar, { type FilterConfig } from './TableActionBar';
import useDebounce from '../hooks/useDebounce';

export interface Column<T> {
  header: string;
  key: string;
  render?: (item: T, index: number) => React.ReactNode;
  width?: string;
}

interface DataTableProps<T> {
  title: string;
  columns: Column<T>[];
  queryKey: any[];
  fetchFn?: () => Promise<T[]>;
  data?: T[];
  isLoading?: boolean;
  isError?: boolean;
  onRefresh?: () => void;
  onAdd?: () => void;
  filters?: FilterConfig[];
  pageSizeOptions?: number[];
  initialPageSize?: number;
  showActionBar?: boolean;
  showPagination?: boolean;
}

function DataTable<T extends object>({
  title,
  columns,
  queryKey,
  fetchFn,
  data,
  isLoading: externalLoading,
  isError: externalError,
  onRefresh,
  onAdd,
  filters,
  pageSizeOptions = [5, 10, 20, 50],
  initialPageSize = 10,
  showActionBar = true,
  showPagination = true
}: DataTableProps<T>) {
  const normalizeText = (text: string) => {
   return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
  }
  const levenshtein = (a: string, b: string) => {
    const matrix = Array.from({ length: b.length + 1 }, () =>
      Array(a.length + 1).fill(0)
    );

    for (let i = 0; i <= b.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        const cost = a[j - 1] === b[i - 1] ? 0 : 1;

        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    return matrix[b.length][a.length];
  };
  const smartMatch = (source: string, keyword: string) => {
    const text = normalizeText(source);
    const query = normalizeText(keyword);

    if (text.includes(query)) return true;

    const words = text.split(' ');

    return words.some((word) => levenshtein(word, query) <= 1);
  };

  const [searchText, setSearchText] = useState('');
  const debouncedSearchText = useDebounce(searchText, 300);
  
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const queryResult = fetchFn
  ? useQuery({
      queryKey,
      queryFn: fetchFn,
    })
  : {
      data: undefined,
      isLoading: false,
      isError: false,
      refetch: () => {},
      isFetching: false,
    };
  // 1. Fetch dữ liệu
  const { data: queryData, isLoading: queryLoading, isError: queryError, refetch, isFetching } = queryResult;

  const tableData = useMemo(() => data ?? queryData ?? [], [data, queryData]);
  const isLoading = externalLoading ?? queryLoading;
  const isError = externalError ?? queryError;

  const filteredData = useMemo(() => {
    if (!tableData) return [];
    
    return tableData.filter((item: any) => {
      // Lọc theo ô search tổng quát
      const matchesSearch = debouncedSearchText === '' || 
        smartMatch(JSON.stringify(item), debouncedSearchText);

      // Lọc theo từng ô input chi tiết (Tên, Mô tả, Status...)
      const matchesColumnFilters = Object.keys(columnFilters).every(key => {
        const filterVal = columnFilters[key].toLowerCase();
        if (!filterVal) return true;
        
        // Nếu là object phức tạp (như _count), lấy giá trị sâu bên trong
        const itemVal = String(item[key] || '').toLowerCase();
        return itemVal.includes(filterVal);
      });

      return matchesSearch && matchesColumnFilters;
    });
  }, [tableData, debouncedSearchText, columnFilters]);

  // 3. Logic Phân trang
  const totalPages = Math.ceil(filteredData.length / pageSize);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  const handleFilterChange = (key: string, value: string) => {
    setColumnFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1); // Reset về trang 1 khi lọc
  };

  const handlePageSizeChange = (value: string) => {
    const nextSize = Number(value);
    if (!Number.isNaN(nextSize) && nextSize > 0) {
      setPageSize(nextSize);
      setCurrentPage(1);
    }
  };

  return (
    <div className="card shadow-sm border-0 mb-4 overflow-hidden app-dark-surface">
      {/* Header */}
      <div className="card-header app-dark-soft py-3 border-bottom-0">
        <h5 className="mb-0 fw-bold text-info">{title}</h5>
      </div>

      {/* Thanh công cụ tách riêng */}
      {showActionBar && (
        <TableActionBar 
          onSearch={(val) => { setSearchText(val); setCurrentPage(1); }}
          onAdd={onAdd}
          onRefresh={() => (onRefresh ? onRefresh() : refetch())}
          isFetching={isFetching}
          filters={filters}
          onFilterChange={handleFilterChange}
        />
      )}

      {/* Nội dung Bảng */}
      <div className="card-body p-0">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead>
              <tr>
                {columns.map((col, idx) => (
                  <th key={idx} style={{ width: col.width }} className="py-3 px-4 text-uppercase fw-bold" >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={columns.length} className="text-center py-5">
                    <Loader2 size={32} className="text-primary spin mb-2" />
                    <p className="text-muted mb-0">Đang tải dữ liệu...</p>
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={columns.length} className="text-center py-5 text-danger">
                    <AlertCircle size={32} className="mb-2" />
                    <p className="mb-0">Có lỗi xảy ra khi tải dữ liệu!</p>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="text-center py-5 text-muted">Không tìm thấy dữ liệu nào.</td>
                </tr>
              ) : (
                paginatedData.map((item, rowIdx) => (
                  <tr key={rowIdx}>
                    {columns.map((col, colIdx) => (
                      <td key={colIdx} className="px-4 py-3">
                        {col.render ? col.render(item, rowIdx) : (item as any)[col.key]}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer / Phân trang */}
      {showPagination && !isLoading && !isError && filteredData.length > 0 && (
        <div className="card-footer app-dark-soft py-3 border-top d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-3">
            <small className="text-muted">
              Hiển thị {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, filteredData.length)} trên tổng {filteredData.length} dòng
            </small>
            <div className="d-flex align-items-center gap-2">
              <small className="text-muted">Số dòng/trang</small>
              <select
                className="form-select form-select-sm"
                style={{ width: 90 }}
                value={pageSize}
                onChange={(e) => handlePageSizeChange(e.target.value)}
              >
                {pageSizeOptions.map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="btn-group shadow-sm">
            <button className="btn btn-sm btn-outline-secondary" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
              <ChevronLeft size={16} />
            </button>
            {[...Array(totalPages)].map((_, i) => (
              <button key={i} className={`btn btn-sm ${currentPage === i + 1 ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setCurrentPage(i + 1)}>
                {i + 1}
              </button>
            ))}
            <button className="btn btn-sm btn-outline-secondary" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .table > :not(caption) > * > * {
          background-color: transparent;
          color: #e2e8f0;
          border-color: #1f2937;
        }
        thead th {
          color: #94a3b8;
        }
        tbody tr:hover {
          background: rgba(56, 189, 248, 0.08);
        }
      `}</style>
    </div>
  );
}

export default DataTable;