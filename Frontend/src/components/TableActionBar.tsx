import React from 'react';
import { Search, Plus, RotateCw, FileSpreadsheet, FileText } from 'lucide-react';

export interface FilterConfig {
  label: string;
  key: string;
  placeholder?: string;
  type?: 'text' | 'select';
  options?: { label: string; value: any }[];
}

interface TableActionBarProps {
  onSearch: (val: string) => void;
  onAdd?: () => void;
  onRefresh?: () => void;
  isFetching?: boolean;
  filters?: FilterConfig[];
  onFilterChange?: (key: string, value: string) => void;
}

const TableActionBar: React.FC<TableActionBarProps> = ({
  onSearch, onAdd, onRefresh, isFetching, filters, onFilterChange
}) => {
  return (
    <div className="bg-light border-bottom p-3">
      {/* Hàng 1: Search & Main Actions */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="d-flex align-items-center flex-grow-1 me-3">
          <div className="input-group input-group-sm" style={{ maxWidth: '300px' }}>
            <span className="input-group-text bg-white border-end-0">
              <Search size={16} className="text-muted" />
            </span>
            <input
              type="text"
              className="form-control border-start-0 ps-0 shadow-none"
              placeholder="search..."
              onChange={(e) => onSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="d-flex align-items-center gap-2">
          {onAdd && (
            <button className="btn btn-sm btn-primary d-flex align-items-center gap-1" onClick={onAdd}>
              <Plus size={16} /> New Item
            </button>
          )}
          
          <div className="d-flex gap-1 ms-2">
            <button className="btn btn-sm btn-white border bg-white" onClick={onRefresh} title="Tải lại">
              <RotateCw size={14} className={`text-primary ${isFetching ? 'spin' : ''}`} />
            </button>
            <button className="btn btn-sm btn-white border bg-white" title="Xuất Excel">
              <FileSpreadsheet size={14} className="text-success" />
            </button>
            <button className="btn btn-sm btn-white border bg-white" title="Xuất PDF">
              <FileText size={14} className="text-danger" />
            </button>
          </div>
        </div>
      </div>

      {/* Hàng 2: Granular Filters (Các ô nhập liệu chi tiết) */}
      {filters && filters.length > 0 && (
        <div className="row g-2">
          {filters.map((f, idx) => (
            <div key={idx} className="col-md-2">
              <label className="small fw-bold text-secondary d-block mb-1" style={{ fontSize: '0.75rem' }}>
                {f.label}
              </label>
              {f.type === 'select' ? (
                <select 
                  className="form-select form-select-sm"
                  onChange={(e) => onFilterChange?.(f.key, e.target.value)}
                >
                  <option value="">Tất cả</option>
                  {f.options?.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              ) : (
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder={f.placeholder || 'text'}
                  onChange={(e) => onFilterChange?.(f.key, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TableActionBar;