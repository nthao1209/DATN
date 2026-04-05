import  { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import CommonModal from './CommonModal';
import api from '../../services/api';
import { type Bus, type User } from '../../types/bus';

type BusModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Bus) => void;
  initialData?: Partial<Bus> | null;
};

export default function BusModal(props: BusModalProps) {
  const { isOpen, onClose, onSubmit, initialData } = props;
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, reset } = useForm<Bus>();

  // Fetch users on modal open
  useEffect(() => {
    if (isOpen) {
      const fetchUsers = async () => {
        try {
          setLoading(true);
          const res = await api.getBusManagers();
          setUsers(res);
        } catch (error) {
          console.error('Failed to fetch users:', error);
          setUsers([]);
        } finally {
          setLoading(false);
        }
      };
      
      fetchUsers();
      
      reset(
        initialData || {
          busCode: '',
          registrationNumber: '',
          driverName: '',
          driverTel: '',
          tourGuideName: '',
          tourGuideTel: '',
          description: '',
          managerId: undefined
        }
      );
    }
  }, [initialData, isOpen, reset]);

  return (
    <CommonModal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Sửa xe' : 'Thêm xe mới'}
      onSubmit={handleSubmit(onSubmit)}
    >
      <div className="mb-3">
        <label className="form-label fw-bold">Mã xe</label>
        <input {...register('busCode', { required: true })} className="form-control" />
      </div>

      <div className="mb-3">
        <label className="form-label fw-bold">Số đăng ký xe</label>
        <input {...register('registrationNumber', { required: true })} className="form-control" />
      </div>

      <div className="mb-3">
        <label className="form-label fw-bold">Tên lái xe</label>
        <input {...register('driverName', { required: true })} className="form-control" />
      </div>

      <div className="mb-3">
        <label className="form-label fw-bold">SĐT lái xe</label>
        <input type="tel" {...register('driverTel', { required: true })} className="form-control" />
      </div>

      <div className="mb-3">
        <label className="form-label fw-bold">Tên HDV</label>
        <input {...register('tourGuideName', { required: true })} className="form-control" />
      </div>

      <div className="mb-3">
        <label className="form-label fw-bold">SĐT HDV</label>
        <input type="tel" {...register('tourGuideTel', { required: true })} className="form-control" />
      </div>

      <div className="mb-3">
        <label className="form-label fw-bold">Đặc điểm xe</label>
        <input {...register('description')} className="form-control" />
      </div>

      <div className="mb-3">
        <label className="form-label fw-bold">Người quản lý (Tùy chọn)</label>
        <select 
          {...register('managerId', { setValueAs: (value) => value ? Number(value) : undefined })}
          className="form-control"
          disabled={loading}
        >
          <option value="">-- Chọn trưởng xe --</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name} {user.description ? `(${user.description})` : ''}
            </option>
          ))}
        </select>
      </div>
    </CommonModal>
  );
}