import React, { useState} from 'react';
import { useParams } from 'react-router-dom';
import DataTable from '../components/DataTable'; // Component đã viết ở câu trước
import RoundModal from '../components/modals/RoundModal';
import { useRounds } from '../hooks/useRounds';
import { Edit, Trash2, MapPin } from 'lucide-react';

const RoundPage: React.FC = () => {
  const { id: tripId } = useParams<{ id: string }>();
  
  const { getRoundsFn, createRound, updateRound, deleteRound } = useRounds(tripId);
  
  const [modal, setModal] = useState({ open: false, data: null as any });
  
  const roundFilters = [
    { label: 'Tên', key: 'name' },
    {label: 'Thời gian', key: 'time', type: 'text' as const},
    { 
      label: 'Tình trạng', 
      key: 'status', 
      type: 'select' as const, 
      options: [
        { label: 'Hoàn thành', value: 'DONE' },
        { label: 'Đang diễn ra', value: 'DOING' }
      ] 
    },
  ];

  const columns = [
    { header: 'STT', key: 'stt', width: '70px', render: (_:any, index: number)=> index +1 },
    { header: 'Tên Chuyến đi', key: 'name' },
    { header: 'Thời gian', key: 'time' },
    { header: 'Số cái check-in', key: 'transactionCount', render: (item: any) => item?._count?.transactions || 0 },
    {
      header: 'Tình trạng',
      key: 'status',
      render: (item: any) => {
        const isDone = item.status === 'DONE';

        return (
          <div className="form-check form-switch">
            <input
              className="form-check-input"
              type="checkbox"
              checked={isDone}
              onChange={() => {
                updateRound.mutate({
                  ...item,
                  status: isDone ? 'DOING' : 'DONE',
                });
              }}
            />
            <label className="form-check-label ms-2">
              {isDone ? 'Hoàn thành' : 'Đang diễn ra'}
            </label>
          </div>
        );
      }
    },
    { 
      header: 'Thao tác', 
      key: 'id', 
      render: (item: any) => (
        <div className="d-flex gap-2">
          <button className="btn btn-sm btn-outline-primary" onClick={() => setModal({ open: true, data: item })}>
            <Edit size={14} />
          </button>
          <button className="btn btn-sm btn-outline-danger" onClick={() => {
            if(window.confirm("Xóa chặng?")) deleteRound.mutate(item.id);
          }}>
            <Trash2 size={14} />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="p-4">
      <div className="d-flex align-items-center gap-2 mb-4">
        <MapPin className="text-primary" size={28} />
        <h3 className="m-0 fw-bold">Quản lý Chặng đi (Rounds)</h3>
      </div>

      <DataTable
        title="Danh sách các chặng đi của chuyến đi"
        columns={columns}
        queryKey={['rounds', tripId]}
        fetchFn={getRoundsFn} 
        onAdd={() => setModal({ open: true, data: null })}
        filters={roundFilters}
      />

      <RoundModal 
        isOpen={modal.open}
        initialData={modal.data}
        onClose={() => setModal({ open: false, data: null })}
        onSubmit={(data: any) => {
          if (modal.data) updateRound.mutate({ ...data, id: modal.data.id });
          else createRound.mutate(data);
          setModal({ open: false, data: null });
        }}
      />
    </div>
  );
};
export default RoundPage;