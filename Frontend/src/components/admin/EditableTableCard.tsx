import type { ReactNode } from 'react';
import { Plus } from 'lucide-react';
import DataTable, { type DataTableProps } from '../DataTable';
import './adminReusable.css';

type EditableTableCardProps<T extends object> = DataTableProps<T> & {
  children?: ReactNode;
  showAddRow?: boolean;
  addRowLabel?: string;
  onAddRow?: () => void;
};

function EditableTableCard<T extends object>({
  children,
  showAddRow = false,
  addRowLabel = 'Thêm dòng mới',
  onAddRow,
  ...dataTableProps
}: EditableTableCardProps<T>) {
  return (
    <div className="table-container-card shadow-sm">
      <DataTable {...dataTableProps} />
      {children}
      {showAddRow && (
        <div className="admin-table-add-row">
          <button
            className="btn-add-row-bottom w-100 py-1"
            onClick={onAddRow}
          >
            <Plus size={18} />
            <span className="fw-bold ms-2">{addRowLabel}</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default EditableTableCard;
