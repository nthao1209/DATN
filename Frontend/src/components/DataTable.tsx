import React, { useEffect, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, AlertCircle, Loader2, ListFilter, Search } from 'lucide-react';
import TableActionBar, { type FilterConfig } from './TableActionBar';
import useDebounce from '../hooks/useDebounce';
import './DataTable.css';

export interface Column<T> {
  header: string;
  key: string;
  render?: (item: T, index: number) => React.ReactNode;
  width?: string;
}

export interface DataTableProps<T> {
  title: React.ReactNode;
  titleActions?: React.ReactNode;
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
  focusRowKey?: string | number | null;
  focusRowSignal?: number;
  density?: 'compact' | 'comfortable';
  minTableWidth?: string;
}

function DataTable<T extends object>({
  title,
  titleActions,
  columns,
  queryKey,
  fetchFn,
  data,
  isLoading: externalLoading,
  isError: externalError,
  onAdd,
  filters,
  pageSizeOptions = [5, 10, 20, 30, 40, 50],
  initialPageSize = 10,
  showActionBar = true,
  showPagination = true,
  focusRowKey = null,
  focusRowSignal = 0,
  density = 'compact',
  minTableWidth
}: DataTableProps<T>) {
  const normalizeText = (text: string) => {
    // Tìm kiếm không dấu để người dùng gõ "nguyen" vẫn ra "Nguyễn".
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .trim();
  };

  const smartMatch = (source: string, keyword: string) => {
    const text = normalizeText(source);
    const query = normalizeText(keyword);
    if (text.includes(query)) return true;
    return false;
  };

  const [searchText, setSearchText] = useState('');
  const debouncedSearchText = useDebounce(searchText, 300);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const queryResult = fetchFn
    // DataTable có thể tự fetch bằng React Query hoặc nhận data đã fetch sẵn từ page.
    ? useQuery({ queryKey, queryFn: fetchFn })
    : { data: undefined, isLoading: false, isError: false, refetch: () => {}, isFetching: false };

  const { data: queryData, isLoading: queryLoading, isError: queryError,isFetching } = queryResult;

  const tableData = useMemo(() => data ?? queryData ?? [], [data, queryData]);
  const isLoading = externalLoading ?? queryLoading;
  const isError = externalError ?? queryError;

  const filteredData = useMemo(() => {
    // Search toàn dòng bằng JSON và filter từng cột nếu TableActionBar truyền filter.
    if (!tableData) return [];
    return tableData.filter((item: any) => {
      const matchesSearch = debouncedSearchText === '' || smartMatch(JSON.stringify(item), debouncedSearchText);
      const matchesColumnFilters = Object.keys(columnFilters).every(key => {
        const filterVal = columnFilters[key].toLowerCase();
        if (!filterVal) return true;
        const itemVal = String(item[key] || '').toLowerCase();
        return itemVal.includes(filterVal);
      });
      return matchesSearch && matchesColumnFilters;
    });
  }, [tableData, debouncedSearchText, columnFilters]);

  const totalPages = Math.ceil(filteredData.length / pageSize);
  const paginatedData = useMemo(() => {
    // Cắt dữ liệu theo trang hiện tại sau khi đã search/filter.
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  useEffect(() => {
    // Khi page vừa thêm/sửa dòng, focusRowKey giúp nhảy tới đúng trang chứa dòng đó.
    if (focusRowKey == null) return;

    const targetIndex = filteredData.findIndex((item, index) => {
      const rowKey = (item as any)?.localId ?? (item as any)?.id ?? index;
      return String(rowKey) === String(focusRowKey);
    });

    if (targetIndex >= 0) {
      setCurrentPage(Math.floor(targetIndex / pageSize) + 1);
    }
  }, [focusRowSignal, focusRowKey, filteredData, pageSize]);

  const handleFilterChange = (key: string, value: string) => {
    setColumnFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1); 
  };

  const handlePageSizeChange = (value: string) => {
    setPageSize(Number(value));
    setCurrentPage(1);
  };

  const densityClass = density === 'comfortable' ? 'datatable-comfortable' : 'datatable-compact';
  const tableMinWidth = minTableWidth || '100%';
  const shellStyle = { '--datatable-min-width': tableMinWidth } as React.CSSProperties;

  return (
    <div className={`data-table-shell ${densityClass} card shadow-lg border-0 mb-4 overflow-hidden`} style={shellStyle}>
      
      <div className="data-table-card-header card-header bg-transparent py-2 px-3">
        <div className="d-flex flex-wrap flex-lg-nowrap align-items-center justify-content-between gap-3">
          
          <div className="d-flex align-items-center gap-2 w-100 w-lg-auto">
            <div className="data-table-title-icon p-2 rounded-3">
              <ListFilter size={20} />
            </div>
            <h5 className="data-table-title mb-0 fw-bold text-nowrap">{title}</h5>
          </div>

          <div className="d-flex align-items-center justify-content-start justify-content-lg-end gap-3 flex-wrap flex-grow-1 ms-auto">
            {titleActions}
            {isFetching && !isLoading && (
              <div className="d-flex align-items-center gap-2 text-info small animate-pulse">
                <Loader2 size={14} className="spin" />
                <span className="d-none d-sm-inline">Đang đồng bộ...</span>
              </div>
            )}
          </div>

        </div>
      </div>

      {showActionBar && (
        <TableActionBar 
          onSearch={(val) => { setSearchText(val); setCurrentPage(1); }}
          onAdd={onAdd}
          filters={filters}
          onFilterChange={handleFilterChange}
        />
      )}

      <div className="card-body p-0">
        <div className="table-responsive custom-scrollbar">
          <table className="table table-hover align-middle mb-0 custom-table responsive-stack-table">
            <thead className="datatable-head">
              <tr>
                {columns.map((col, idx) => (
                  <th key={idx} 
                      style={{ width: col.width }}
                      className="py-1 px-2 small text-uppercase fw-bold border-0">
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={columns.length} className="text-center py-5">
                    <div className="d-flex flex-column align-items-center">
                      <div className="spinner-glow mb-3"></div>
                      <p className="text-gray-500 mb-0 small">Đang tải dữ liệu...</p>
                    </div>
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={columns.length} className="text-center py-5">
                    <AlertCircle size={40} className="text-danger mb-2 opacity-50" />
                    <p className="text-danger mb-0 small">Lỗi kết nối cơ sở dữ liệu!</p>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="text-center py-5 text-gray-600 italic small">
                    <Search size={24} className="mb-2 opacity-25" />
                    <br /> Không tìm thấy dữ liệu phù hợp.
                  </td>
                </tr>
              ) : (
                paginatedData.map((item, rowIdx) => (
                  <tr key={(item as any)?.localId ?? (item as any)?.id ?? rowIdx} className="table-row-dark">
                    {columns.map((col, colIdx) => (
                      <td key={colIdx} 
                          className="px-2 py-1 border-0 text-gray-300 small"
                          data-label={col.header}
                      >
                        <div className="td-content">
                          {col.render
                            ? col.render(item, (currentPage - 1) * pageSize + rowIdx)
                            : (item as any)[col.key]}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showPagination && !isLoading && !isError && filteredData.length > 0 && (
        <div className="data-table-footer card-footer bg-transparent py-2 px-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div className="d-flex align-items-center gap-4">
            <span className="data-table-summary">
              Hiển thị <span className="data-table-summary-strong fw-bold">{((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, filteredData.length)}</span> trên <span className="data-table-summary-strong fw-bold">{filteredData.length}</span>
            </span>
            <div className="d-flex align-items-center gap-2">
              <select
                className="form-select-dynamic"
                value={pageSize}
                onChange={(e) => handlePageSizeChange(e.target.value)}
              >
                {pageSizeOptions.map((size) => (
                  <option key={size} value={size}>{size} dòng</option>
                ))}
              </select>
            </div>
          </div>

          <nav>
            <ul className="pagination pagination-sm m-0 gap-1">
              <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                <button className="page-link rounded-circle" onClick={() => setCurrentPage(p => p - 1)}>
                  <ChevronLeft size={16} />
                </button>
              </li>
              {[...Array(totalPages)].map((_, i) => {
                const pageNum = i + 1;
                if (totalPages > 5 && (pageNum > 2 && pageNum < totalPages && Math.abs(pageNum - currentPage) > 1)) {
                  if (pageNum === currentPage - 2 || pageNum === currentPage + 2) return <li key={i} className="px-1 text-gray-600 align-self-center">...</li>;
                  return null;
                }
                return (
                  <li key={i} className={`page-item ${currentPage === pageNum ? 'active' : ''}`}>
                    <button className="page-link rounded-circle mx-1 shadow-sm" onClick={() => setCurrentPage(pageNum)}>
                      {pageNum}
                    </button>
                  </li>
                );
              })}
              <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                <button className="page-link rounded-circle" onClick={() => setCurrentPage(p => p + 1)}>
                  <ChevronRight size={16} />
                </button>
              </li>
            </ul>
          </nav>
        </div>
      )}
    </div>
  );
}

export default DataTable;
