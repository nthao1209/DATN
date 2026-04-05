import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import CommonModal from './CommonModal';



const TripModal: React.FC<any> = ({ isOpen, onClose, onSubmit, initialData, isLoading }) => {
  const { register, handleSubmit, reset } = useForm();

  useEffect(() => {
    if (initialData) reset(initialData);
    else reset({ name: '', status: 'DOING' });
  }, [initialData, reset, isOpen]); 
  return (
    <CommonModal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Cập nhật Chuyến' : 'Thêm Chuyến đi mới'}
      onSubmit={handleSubmit(onSubmit)} 
      isLoading={isLoading}
    >
      <div className="mb-3">
        <label className="form-label fw-bold">Tên chuyến đi</label>
        <input {...register('name')} className="form-control" required placeholder="VD: Tour Nha Trang" />
      </div>
      <div className="mb-3">
        <label className="form-label fw-bold">Trạng thái</label>
        <select {...register('status')} className="form-select">
          <option value="DOING">Đang thực hiện (DOING)</option>
          <option value="DONE">Hoàn thành (DONE)</option>
        </select>
      </div>
    </CommonModal>
  );
};

export default TripModal;