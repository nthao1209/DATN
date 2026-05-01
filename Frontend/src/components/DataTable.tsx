import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  ChevronLeft, ChevronRight, AlertCircle, Loader2, ListFilter, Search 
} from 'lucide-react';
import TableActionBar, { type FilterConfig } from './TableActionBar';
import useDebounce from '../hooks/useDebounce';
import { useTheme } from '../theme/ThemeContext';

export interface Column<T> {
  header: string;
  key: string;
  render?: (item: T, index: number) => React.ReactNode;
  width?: string;
}

interface DataTableProps<T> {
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
  onRefresh,
  onAdd,
  filters,
  pageSizeOptions = [5, 10, 20, 30, 40, 50],
  initialPageSize = 10,
  showActionBar = true,
  showPagination = true
}: DataTableProps<T>) {
  
  const { colors, effects } = useTheme();

  // --- LOGIC TÌM KIẾM THÔNG MINH ---
  const normalizeText = (text: string) => {
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

  const { data: queryData, isLoading: queryLoading, isError: queryError, refetch, isFetching } = queryResult;

  const tableData = useMemo(() => data ?? queryData ?? [], [data, queryData]);
  const isLoading = externalLoading ?? queryLoading;
  const isError = externalError ?? queryError;

  const filteredData = useMemo(() => {
    if (!tableData) return [];
    return tableData.filter((item: any) => {
      const matchesSearch = debouncedSearchText === '' || 
        smartMatch(JSON.stringify(item), debouncedSearchText);
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
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  const handleFilterChange = (key: string, value: string) => {
    setColumnFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1); 
  };

  const handlePageSizeChange = (value: string) => {
    setPageSize(Number(value));
    setCurrentPage(1);
  };

  return (
    <div className="card shadow-lg border-0 mb-4 overflow-hidden" 
         style={{ background: colors.surface, borderRadius: effects.borderRadius.lg, border: `1px solid ${colors.border}` }}>
      
      <div className="card-header bg-transparent py-4 px-4" style={{ borderBottom: `1px solid ${colors.border}` }}>
        <div className="d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-2">
            <div className="p-2 rounded-3" style={{ backgroundColor: colors.primaryGlow, color: colors.primary }}>
              <ListFilter size={20} />
            </div>
            <h5 className="mb-0 fw-bold text-white" style={{ letterSpacing: '-0.02em' }}>{title}</h5>
          </div>
          <div className="d-flex align-items-center gap-3">
            {titleActions}
            {isFetching && !isLoading && (
              <div className="d-flex align-items-center gap-2 text-info small animate-pulse">
                <Loader2 size={14} className="spin" />
                <span>Đang đồng bộ...</span>
              </div>
            )}
          </div>
        </div>
      </div>

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

      <div className="card-body p-0">
        <div className="table-responsive custom-scrollbar">
          <table className="table table-hover align-middle mb-0 custom-table responsive-stack-table">
            <thead className="datatable-head">
              <tr style={{ background: 'rgba(30, 41, 59, 0.3)' }}>
                {columns.map((col, idx) => (
                  <th key={idx} 
                      style={{ width: col.width, color: colors.textMuted }} 
                      className="py-3 px-4 small text-uppercase fw-bold border-0">
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
                          className="px-4 py-3 border-0 text-gray-300 small"
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

        <div className="card-footer bg-transparent py-4 px-4 border-top border-gray-800 d-flex flex-wrap justify-content-between align-items-center gap-3">

          <div className="d-flex align-items-center gap-4">

            <span className="text-gray-500 small">

              Hiển thị <span className="text-white fw-bold">{((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, filteredData.length)}</span> trên <span className="text-white fw-bold">{filteredData.length}</span>

            </span>

            <div className="d-flex align-items-center gap-2">

              <select

                className="form-select form-select-sm bg-dark border-gray-700 text-gray-400 rounded-pill px-3"

                style={{ width: 95, fontSize: '11px', height: '28px' }}

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

      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .datatable-head {
          display: table-header-group;
        }
        
        .table-row-dark:hover {
          background: rgba(251, 244, 236, 0.03) !important;
        }
        
        .custom-table {
            background-color: transparent !important;
            color: ${colors.textPrimary} !important;
            border-color: ${colors.border} !important;
        }
        .custom-table :not(caption) > * > * {
            background-color: transparent !important; /* Xóa nền trắng mặc định của Bootstrap */
            color: ${colors.textPrimary} !important;
            border-bottom-width: 1px;
            border-color: ${colors.border} !important;
            box-shadow: none !important; /* Xóa shadow nếu có */
        }
        .table-row-dark:hover td {
            background-color: rgba(56, 189, 248, 0.04) !important; /* Màu xanh mờ khi di chuột */
        }
        .td-content input, 
        .td-content select,
        .td-content textarea {
            background-color: ${colors.background} !important; /* Màu nền tối sâu */
            border: 1px solid ${colors.borderLight} !important;
            color: ${colors.textPrimary} !important;
            border-radius: 6px;
        }
        .td-content input::placeholder,
        .td-content textarea::placeholder {
            color: ${colors.textMuted} !important; /* Dùng màu xám mờ từ theme */
            opacity: 0.6; /* Chỉnh độ mờ cho vừa mắt */
            font-size: 0.8rem;
        }
        .td-content input::-webkit-input-placeholder,
        .td-content textarea::-webkit-input-placeholder {
            color: ${colors.textMuted} !important;
        }
        .td-content input:focus::placeholder {
            opacity: 0.3;
        }
        .td-content input, 
        .td-content textarea {
            color: ${colors.textPrimary} !important; /* Màu chữ trắng sáng để dễ đọc */
        }

        @media (max-width: 1150px) {
          .datatable-head {
            display: none;
          }

          .responsive-stack-table, .responsive-stack-table tbody, .responsive-stack-table tr, .responsive-stack-table td {
            display: block;
            width: 100%;
          }
          .responsive-stack-table tr {
            margin-bottom: 1.5rem;
            padding: 1rem;
            background: rgba(255, 255, 255, 0.015);
            border-radius: 12px;
            border: 1px solid ${colors.border} !important;
          }
          .responsive-stack-table td {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 10px !important;
            border-bottom: 1px solid ${colors.border} !important;
          }
          .responsive-stack-table td:last-child { border-bottom: 0 !important; }
          .responsive-stack-table td::before {
            content: attr(data-label);
            font-weight: bold;
            color: ${colors.textMuted};
            text-transform: uppercase;
            font-size: 10px;
            flex: 0 0 35%;
            text-align: left;
          }
          .td-content {
            flex: 1;
            max-width: 65%;
            display: flex;
            justify-content: flex-end;
            text-align: right;
          }
          .td-content input, .td-content select, .td-content .form-control, .td-content .form-select {
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
          }
        }

        .spinner-glow {
          width: 30px; height: 30px;
          border: 2px solid ${colors.primaryGlow};
          border-top-color: ${colors.primary};
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        .custom-scrollbar::-webkit-scrollbar { height: 6px; width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: ${colors.border}; border-radius: 10px; }
      `}</style>
    </div>
  );
}

export default DataTable;