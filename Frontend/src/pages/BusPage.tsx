import React, { useState } from 'react';
import DataTable from '../components/DataTable'; // Component đã viết ở câu trước
import { useBuses } from '../hooks/useBuses';
import { Edit, Trash2, MapPin } from 'lucide-react';
import {type Bus} from '../types/bus';
import BusModal from '../components/modals/BusModal';
import { useParams } from 'react-router-dom';
const BusPage: React.FC = () => {

  const { id: tripId } = useParams<{ id: string }>();

  const { getBusesFn, createBus, updateBus, deleteBus } = useBuses(tripId);
  
  const [modal, setModal] = useState({ open: false, data: null as any });

  const roundFilters = [
    { label: 'Tên', key: 'name' },
  ];

  const columns = [
    { header: 'STT', key: 'stt', width: '70px', render: (_:any, index: number)=> index +1 },
    { header: 'Mã xe', key: 'busCode' },
    { header: 'Biển số xe', key: 'registrationNumber' },
    { header: 'Đặc điểm nhận dạng', key: 'description' },
    { header: 'Tên tài xế', key: 'driverName' },
    { header: 'SĐT tài xế', key: 'driverTel' },
    { header: 'Tên HDV', key: 'tourGuideName' },
    { header: 'SĐT HDV', key: 'tourGuideTel' },
    { header: 'Trưởng xe', key: 'manager', render: (item: any) => item.manager?.name || '-' },
    {
      header: 'Thao tác', 
      key: 'id', 
      render: (item: any) => (
        <div className="d-flex gap-2">
          <button className="btn btn-sm btn-outline-primary" onClick={() => setModal({ open: true, data: item })}>
            <Edit size={14} />
          </button>
          <button className="btn btn-sm btn-outline-danger" onClick={() => {
            if(window.confirm("Xóa chặng?")) deleteBus.mutate(item.id);
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
        <h3 className="m-0 fw-bold">Quản lý xe (Buses)</h3>
      </div>

      <DataTable
        title="Danh sách các xe"
        columns={columns}
        queryKey={['buses', tripId]}
        fetchFn={getBusesFn} 
        onAdd={() => setModal({ open: true, data: null })}
        filters={roundFilters}
      />

      <BusModal 
        isOpen={modal.open}
        initialData={modal.data}
        onClose={() => setModal({ open: false, data: null })}
        onSubmit={(data: Bus) => {
          if (modal.data) updateBus.mutate({ ...data, id: modal.data.id });
          else createBus.mutate(data);
          setModal({ open: false, data: null });
        }}
      />
    </div>
  );
};
export default BusPage;