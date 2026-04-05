import React, {useEffect} from 'react';
import {useForm} from 'react-hook-form';
import CommonModal from './CommonModal';

const RoundModal: React.FC<any> = ({ isOpen, onClose, onSubmit, initialData }) => {
  const {register, handleSubmit, reset} = useForm();

  useEffect(() =>{
    reset(initialData || {name: '', time:'', status:'DOING'});
  },[initialData, reset, isOpen]); 

  return (
    <CommonModal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Sửa chặng' : 'Thêm chặng mới'}
      onSubmit={handleSubmit(onSubmit)}
    >

      <div className="mb-3">
        <label className="form-label fw-bold">Tên chặng</label>
        <input {...register('name')} className="form-control" required placeholder="VD: Chặng 1" />
      </div>
      <div className="mb-3">
        <label className="form-label fw-bold">Thời gian</label>
        <input {...register('time')} type="text" className="form-control" required />
      </div>
      <div className="mb-3">
        <label className="form-label fw-bold">Trạng thái</label>
        <select {...register('status')} className="form-control" required>
          <option value="DOING">Đang thực hiện</option>
          <option value="DONE">Hoàn thành</option>
        </select>
      </div>

    </CommonModal>
  );
};

export default RoundModal;
