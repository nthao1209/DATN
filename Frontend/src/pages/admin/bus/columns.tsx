import { Trash2 } from 'lucide-react';
import type { Column } from '../../components/DataTable';
import type { BusManager, BusRow } from './types';
import { AutoResizeTextarea } from '../../hooks/useAutoResize';

type BuildBusColumnsParams = {
  managers: BusManager[];
  handleCellChange: <K extends keyof BusRow>(
    localId: string,
    key: K,
    value: BusRow[K]
  ) => void;
  handleDeleteRow: (row: BusRow) => void;
};

export const buildBusColumns = ({
  managers,
  handleCellChange,
  handleDeleteRow,
}: BuildBusColumnsParams): Column<BusRow>[] => [
  { header: 'STT', key: 'stt', width: '70px', render: (_row, idx) => idx + 1 },
  {
    header: 'Mã xe',
    key: 'busCode',
    render: (row) => (
      <input
        className="form-control form-control-sm"
        value={row.busCode}
        onChange={(e) => handleCellChange(row.localId, 'busCode', e.target.value)}
      />
    ),
  },
  {
    header: 'Biển số xe',
    key: 'registrationNumber',
    render: (row) => (
      <input
        className="form-control form-control-sm"
        value={row.registrationNumber}
        onChange={(e) => handleCellChange(row.localId, 'registrationNumber', e.target.value)}
      />
    ),
  },
  {
    header: 'Tên tài xế',
    key: 'driverName',
    render: (row) => (
      <input
        className="form-control form-control-sm"
        value={row.driverName}
        onChange={(e) => handleCellChange(row.localId, 'driverName', e.target.value)}
      />
    ),
  },
  {
    header: 'SDT tài xế',
    key: 'driverTel',
    render: (row) => (
      <input
        className="form-control form-control-sm"
        inputMode="numeric"
        maxLength={10}
        pattern="^[1-9][0-9]{9}$"
        value={row.driverTel}
        onChange={(e) => handleCellChange(row.localId, 'driverTel', e.target.value.replace(/\D/g, ''))}
      />
    ),
  },
  {
    header: 'Tên HDV',
    key: 'tourGuideName',
    render: (row) => (
      <input
        className="form-control form-control-sm"
        value={row.tourGuideName}
        onChange={(e) => handleCellChange(row.localId, 'tourGuideName', e.target.value)}
      />
    ),
  },
  {
    header: 'SDT HDV',
    key: 'tourGuideTel',
    render: (row) => (
      <input
        className="form-control form-control-sm"
        inputMode="numeric"
        maxLength={10}
        pattern="^[1-9][0-9]{9}$"
        value={row.tourGuideTel}
        onChange={(e) => handleCellChange(row.localId, 'tourGuideTel', e.target.value.replace(/\D/g, ''))}
      />
    ),
  },
  {
    header: 'Đặc điểm xe',
    key: 'description',
    render: (row) => (
      <AutoResizeTextarea
        className="form-control form-control-sm bus-wrap-input"
        value={row.description}
        onChange={(e) => handleCellChange(row.localId, 'description', e.target.value)}
        placeholder="Đặc điểm xe"
      />
    ),
  },
  {
    header: 'Trưởng xe',
    key: 'managerId',
    render: (row) => (
      <select
        className="form-select form-select-sm"
        value={row.managerId ?? ''}
        onChange={(e) => {
          const nextId = e.target.value ? Number(e.target.value) : null;
          const nextManager = managers.find((m) => Number(m.id) === nextId);
          handleCellChange(row.localId, 'managerId', nextId);
          handleCellChange(row.localId, 'managerName', nextManager?.name || '');
        }}
      >
        <option value="">-- Chọn --</option>
        {managers.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
            {m.description ? ` (${m.description})` : ''}
          </option>
        ))}
      </select>
    ),
  },
  {
  header: 'Thao tác',
  key: 'actions',
  width: '100px', 
  render: (row) => (
    <div className="d-flex justify-content-center align-items-center">
      <button 
        className="btn-action-delete" 
        onClick={() => handleDeleteRow(row)} 
        title="Xóa xe"
      >
        <Trash2 size={18} />
      </button>
    </div>
  ),
},
];
