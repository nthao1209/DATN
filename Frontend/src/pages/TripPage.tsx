import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../components/DataTable'; // Component đã viết ở câu trước
import TripModal from '../components/modals/TripModal';
import { useTrips } from '../hooks/useTrips';
import { Edit, Trash2, MapPin } from 'lucide-react';

const TripPage: React.FC = () => {
  const { getTripsFn, createTrip, updateTrip, deleteTrip } = useTrips();
  const navigate = useNavigate();
  
  const [modal, setModal] = useState({ open: false, data: null as any });
  
  const tripFilters = [
    { label: 'Tên', key: 'name' },
    { 
      label: 'Tình trạng', 
      key: 'status', 
      type: 'select' as const, 
      options: [
        { label: 'Hoàn thành', value: 'DONE' },
        { label: 'Đang diễn ra', value: 'DOING' }
      ] 
    },
    { label: 'Số Xe', key: 'busCount' }, 
    { label: 'Số Vòng', key: 'roundCount' },
  ];

  const columns = [
    { header: 'STT', key: 'stt', width: '70px', render: (_:any, index: number)=> index +1 },
    { header: 'Tên Chuyến đi', key: 'name' },
    {
      header: 'Trạng thái',
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
                updateTrip.mutate({
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
    { header: 'Số Xe', key: 'buses', render: (item: any) => item._count.buses },
    { 
      header: 'SỐ Round', 
      key: 'rounds', 
      render: (item: any) => (
        <button 
          className="btn btn-sm btn-link fw-bold text-decoration-none"
          onClick={() => navigate(`/trips/${item.id}/rounds`)}
        >
          {item._count?.rounds || 0}
        </button>
      )
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
            if(window.confirm("Xóa chuyến này sẽ mất hết Rounds/Buses?")) deleteTrip.mutate(item.id);
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
        <h3 className="m-0 fw-bold">Quản lý Chuyến đi (Trips)</h3>
      </div>

      <DataTable
        title="Danh sách các chuyến đi của công ty"
        columns={columns}
        queryKey={['trips']}
        fetchFn={getTripsFn} 
        onAdd={() => setModal({ open: true, data: null })}
        filters={tripFilters}
      />

      <TripModal 
        isOpen={modal.open}
        initialData={modal.data}
        onClose={() => setModal({ open: false, data: null })}
        onSubmit={(data: any) => {
          if (modal.data) updateTrip.mutate({ ...data, id: modal.data.id });
          else createTrip.mutate(data);
          setModal({ open: false, data: null });
        }}
      />
    </div>
  );
};
export default TripPage;