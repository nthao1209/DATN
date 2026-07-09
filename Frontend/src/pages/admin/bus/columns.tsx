import { AlertTriangle, Trash2 } from 'lucide-react';
import type { Column } from '../../../components/DataTable';
import type { BusManager, BusRow } from './types';
import { AutoResizeTextarea } from '../../../hooks/useAutoResize';

export type WrongBusPassenger = {
  transactionId: number;
  passengerId: number;
  passengerName: string;
  // Xe gốc là xe được phân bổ ban đầu cho hành khách.
  assignedBusId: number;
  assignedBusLabel: string;
  // Xe thực tế là xe nơi phát sinh event điểm danh sai xe gần nhất.
  actualBusId: number;
  actualBusLabel: string;
  // Tách riêng check-in/check-out để trưởng đoàn biết sai ở chiều nào.
  checkInWrongBusId?: number | null;
  checkInWrongBusLabel?: string;
  checkOutWrongBusId?: number | null;
  checkOutWrongBusLabel?: string;
  roundName?: string;
};

type BusAttendanceSummary = {
  busId: number;
  checkInCount: number;
  checkOutCount: number;
  wrongBusPassengers?: WrongBusPassenger[];
};

type BuildBusColumnsParams = {
  managers: BusManager[];
  attendanceSummary?: BusAttendanceSummary[];
  handleCellChange: <K extends keyof BusRow>(
    localId: string,
    key: K,
    value: BusRow[K]
  ) => void;
  handleDeleteRow: (row: BusRow) => void;
  handleShowWrongBusPassengers?: (
    bus: BusRow,
    passengers: WrongBusPassenger[]
  ) => void;
};

export const buildBusColumns = ({
  managers,
  attendanceSummary = [],
  handleCellChange,
  handleDeleteRow,
  handleShowWrongBusPassengers,
}: BuildBusColumnsParams): Column<BusRow>[] => [
  { header: 'STT', key: 'stt', width: '44px', render: (_row, idx) => idx + 1 },
  {
    header: 'Mã xe *',
    key: 'busCode',
    width: '90px',
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
    width: '112px',
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
    width: '118px',
    render: (row) => (
      <input
        className="form-control form-control-sm"
        value={row.driverName}
        onChange={(e) => handleCellChange(row.localId, 'driverName', e.target.value)}
      />
    ),
  },
  {
    header: 'SĐT tài xế',
    key: 'driverTel',
    width: '104px',
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
    width: '116px',
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
    width: '104px',
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
    width: '128px',
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
    width: '126px',
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
    header: 'Check-in',
    key: 'checkInCount',
    width: '84px',
    render: (row) => {
      const summary = attendanceSummary.find((item) => item.busId === Number(row.id));
      return <span className="fw-bold text-success">{summary?.checkInCount ?? 0}</span>;
    },
  },
  {
    header: 'Check-out',
    key: 'checkOutCount',
    width: '88px',
    render: (row) => {
      const summary = attendanceSummary.find((item) => item.busId === Number(row.id));
      return <span className="fw-bold text-warning">{summary?.checkOutCount ?? 0}</span>;
    },
  },
  {
    header: 'Sai xe',
    key: 'wrongBusCount',
    width: '76px',
    render: (row) => {
      // Mỗi dòng xe chỉ nhận danh sách khách sai xe thuộc xe gốc của chính dòng đó.
      const summary = attendanceSummary.find((item) => item.busId === Number(row.id));
      const wrongBusPassengers = summary?.wrongBusPassengers || [];
      const count = wrongBusPassengers.length;

      if (!count) {
        return <span className="bus-wrong-count-empty">0</span>;
      }

      return (
        <button
          type="button"
          className="bus-wrong-count-button"
          onClick={() => handleShowWrongBusPassengers?.(row, wrongBusPassengers)}
          title="Xem danh sách khách sai xe"
        >
          <AlertTriangle size={14} />
          <span>{count}</span>
        </button>
      );
    },
  },
  {
    header: 'Thao tác',
    key: 'actions',
    width: '64px',
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
