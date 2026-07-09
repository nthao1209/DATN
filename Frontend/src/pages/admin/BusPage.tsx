import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bus } from 'lucide-react';
import { useParams } from 'react-router-dom';
import api from '../../services/api';
import { isValidPhoneNumber, normalizePhoneNumber } from '../../utils/phone';
import { buildBusColumns, type WrongBusPassenger } from './bus/columns';
import './BusPage.css';
import type { TransactionRecord } from '../bus-management/transaction/types';
import type { BusManager, BusRow } from './bus/types';
import { useSnackbar } from 'notistack';
import { useRegisterUnsavedChanges } from '../../components/common/UnsavedChangesContext';
import EditableTableCard from '../../components/admin/EditableTableCard';
import PageTitle from '../../components/admin/PageTitle';
import SaveChangesAction from '../../components/admin/SaveChangesAction';
import { usePageThemeVars } from '../../hooks/usePageThemeVars';
import { useAttendanceRealtimeInvalidation } from '../../hooks/useAttendanceRealtimeInvalidation';
import { useEditableRows } from '../../hooks/useEditableRows';
import {
  buildBusAttendanceSummary,
  buildBusRows,
  createEmptyBusRow,
  isNewBusRowDirty,
  isSameBusRow,
} from './bus/helpers';

const EMPTY_BUSES: any[] = [];
const EMPTY_MANAGERS: BusManager[] = [];
const EMPTY_TRANSACTIONS: TransactionRecord[] = [];

const BusPage: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  const pageThemeVars = usePageThemeVars();
  const { id: tripId } = useParams<{ id: string }>();
  const [isSaving, setIsSaving] = useState(false);
  const [wrongBusModal, setWrongBusModal] = useState<{
    busLabel: string;
    passengers: WrongBusPassenger[];
  } | null>(null);

  const { data: busesData, isLoading, isError, refetch } = useQuery<any[]>({
    queryKey: ['buses', tripId],
    queryFn: () => api.getBuses(String(tripId)),
    enabled: !!tripId,
  });

  const buses = busesData ?? EMPTY_BUSES;

  const { data: managersData } = useQuery<BusManager[]>({
    queryKey: ['bus-managers'],
    queryFn: api.getBusManagers,
  });

  const managers = managersData ?? EMPTY_MANAGERS;

  const { data: transactionsData, isLoading: isTransactionsLoading } = useQuery<TransactionRecord[]>({
    queryKey: ['transactions', tripId],
    queryFn: api.getTransactions,
    enabled: !!tripId,
  });

  const transactions = transactionsData ?? EMPTY_TRANSACTIONS;

  const busRealtimeQueryKeys = useMemo(
    () => [
      ['transactions', tripId],
      ['buses', tripId],
    ],
    [tripId]
  );

  useAttendanceRealtimeInvalidation({
    tripId: tripId ? Number(tripId) : null,
    queryKeys: busRealtimeQueryKeys,
  });

  const {
    rows,
    deletedIds,
    resetDeletedIds,
    focusRowKey,
    focusRowSignal,
    isRowDirty,
    dirtyCount,
    handleCellChange,
    handleAddRow,
    handleDeleteRow,
    pruneEmptyNewRows,
  } = useEditableRows<BusRow>({
    buildRows: () => buildBusRows(buses),
    resetDeps: [buses],
    isSameRow: isSameBusRow,
    isNewRowDirty: isNewBusRowDirty,
    createRow: createEmptyBusRow,
  });

  const isRowValid = (row: BusRow) => Boolean(row.busCode.trim());

  const hasValidationErrors = useMemo(
    () => rows.some((row) => isRowDirty(row) && !isRowValid(row)),
    [rows]
  );

  const saveValidationMessage = useMemo(() => {
    if (!hasValidationErrors) return '';
    const missing = new Set<string>();
    rows.forEach((row) => {
      if (!isRowDirty(row)) return;
      if (!row.busCode.trim()) missing.add('Mã xe');
    });
    return missing.size ? `Thiếu: ${Array.from(missing).join(', ')}` : 'Vui lòng nhập đủ dữ liệu bắt buộc';
  }, [hasValidationErrors, rows]);

  const canSave = dirtyCount > 0 && !hasValidationErrors;

  const busAttendanceSummary = useMemo(() => {
    return buildBusAttendanceSummary({ rows, tripId, transactions });
  }, [rows, tripId, transactions]);

  const isPageLoading = isLoading || isTransactionsLoading;

  useRegisterUnsavedChanges(dirtyCount > 0);

  const handleSave = async () => {
    if (!tripId) return;
    if (hasValidationErrors) {
      enqueueSnackbar('Vui lòng nhập đủ thông tin bắt buộc của xe trước khi lưu', { variant: 'warning' });
      return;
    }

    const invalidPhoneRow = rows.find(
      (row) => (row.driverTel.trim() && !isValidPhoneNumber(normalizePhoneNumber(row.driverTel))) ||
               (row.tourGuideTel.trim() && !isValidPhoneNumber(normalizePhoneNumber(row.tourGuideTel)))
    );
    if (invalidPhoneRow) {
      enqueueSnackbar('Số điện thoại không hợp lệ.', { variant: 'warning' });
      return;
    }

    try {
      setIsSaving(true);
      await Promise.all([
        ...rows.filter((row) => !row.id && row.busCode.trim()).map((row) =>
          api.createBus(tripId, {
            ...row,
            managerId: row.managerId ? Number(row.managerId) : null,
            registrationNumber: row.registrationNumber.trim() || null,
            driverTel: normalizePhoneNumber(row.driverTel) || null,
            tourGuideTel: normalizePhoneNumber(row.tourGuideTel) || null,
          })
        ),
        ...rows.filter((row) => row.id && isRowDirty(row)).map((row) =>
          api.updateBus(String(row.id), {
            ...row,
            managerId: row.managerId ? Number(row.managerId) : null,
            registrationNumber: row.registrationNumber.trim() || null,
            driverTel: normalizePhoneNumber(row.driverTel) || null,
            tourGuideTel: normalizePhoneNumber(row.tourGuideTel) || null,
          })
        ),
        ...deletedIds.map((id) => api.deleteBus(String(id))),
      ]);
      resetDeletedIds();
      await refetch();
      enqueueSnackbar('Đã lưu thành công', { variant: 'success' });
    } catch (err: any) {
      enqueueSnackbar(err?.message || 'Lỗi khi lưu dữ liệu', { variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const columns = buildBusColumns({
    managers,
    attendanceSummary: busAttendanceSummary,
    handleCellChange,
    handleDeleteRow,
    handleShowWrongBusPassengers: (bus, passengers) => {
      // Khi bấm vào số "Sai xe", mở modal chi tiết cho đúng dòng xe gốc đang chọn.
      setWrongBusModal({
        busLabel: bus.busCode || bus.registrationNumber || `Xe #${bus.id}`,
        passengers,
      });
    },
  });

  return (
    <div className="animate-fade-in p-0 p-md-3 bus-page" style={pageThemeVars}>
      <PageTitle icon={<Bus size={20} />} title="Quản lý Đội xe" />

      <EditableTableCard
        title="Thông tin chi tiết đội xe"
        titleActions={
          <SaveChangesAction
            dirtyCount={dirtyCount}
            isSaving={isSaving}
            canSave={canSave}
            onSave={handleSave}
            validationMessage={saveValidationMessage}
          />
        }
        columns={columns}
        queryKey={['buses-local', tripId]}
        data={rows}
        isLoading={isPageLoading}
        isError={isError}
        onRefresh={() => {
          resetDeletedIds();
          pruneEmptyNewRows();
          refetch();
        }}
        focusRowKey={focusRowKey}
        focusRowSignal={focusRowSignal}
        showAddRow
        onAddRow={handleAddRow}
      />

      {wrongBusModal && (
        <div className="bus-wrong-modal-backdrop" role="presentation">
          <div className="bus-wrong-modal" role="dialog" aria-modal="true" aria-labelledby="wrong-bus-title">
            <div className="bus-wrong-modal-header">
              <div>
                <h3 id="wrong-bus-title">Khách sai xe</h3>
                <p>Xe gốc: {wrongBusModal.busLabel}</p>
              </div>
              <button
                type="button"
                className="bus-wrong-modal-close"
                onClick={() => setWrongBusModal(null)}
                aria-label="Đóng"
              >
                x
              </button>
            </div>

            <div className="bus-wrong-modal-body">
              {wrongBusModal.passengers.map((passenger) => (
                // Mỗi dòng hiển thị một hành khách sai xe kèm xe gốc, xe thực tế và chiều sai.
                <div
                  key={`${passenger.transactionId}_${passenger.passengerId}_${passenger.actualBusId}`}
                  className="bus-wrong-passenger-row"
                >
                  <div>
                    <strong>{passenger.passengerName}</strong>
                    {passenger.roundName && <span>{passenger.roundName}</span>}
                  </div>
                  <div className="bus-wrong-route">
                    <span>
                      <small>Xe gốc</small>
                      {passenger.assignedBusLabel}
                    </span>
                    <span className="bus-wrong-route-arrow">-&gt;</span>
                    <span>
                      <small>Xe hiện tại</small>
                      {passenger.actualBusLabel}
                    </span>
                  </div>
                  <div className="bus-wrong-phases">
                    {passenger.checkInWrongBusLabel && (
                      <span className="bus-wrong-phase check-in">
                        Check-in: {passenger.checkInWrongBusLabel}
                      </span>
                    )}
                    {passenger.checkOutWrongBusLabel && (
                      <span className="bus-wrong-phase check-out">
                        Check-out: {passenger.checkOutWrongBusLabel}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BusPage;
