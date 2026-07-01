import React, { useEffect, useMemo, useState, useRef } from 'react';
import { UserPlus } from 'lucide-react';
import DataTable from '../../components/DataTable';
import api from '../../services/api';
import { buildTransactionColumns } from './transaction/columns';
import type {
  DraftCell,
  PassengerRow,
  TransactionTableRow,
} from './transaction/types';
import { keyOf } from './transaction/types';
import TransactionFilters from './transaction/TransactionFilters';
import { useTransactionSync } from './transaction/useTransactionSync';
import { useTransactionData } from './transaction/useTransactionData';
import { useTransactionDraftStorage } from './transaction/useTransactionDraftStorage';
import { useTransactionMap } from './transaction/useTransactionMap';
import { useTransactionRealtime } from './transaction/useTransactionRealtime';
import { areNumberArraysEqual, buildLockedAttendanceMessage, isSameCell, normalizeNote } from './transaction/helpers';
import { useTheme } from '../../theme/ThemeContext';
import { useRegisterUnsavedChanges } from '../../components/common/UnsavedChangesContext';
import { useSnackbar } from 'notistack';
import ExtraPassengerPanel from './transaction/ExtraPassengerPanel';  
import ExportExcelButton from './transaction/ExportExcelButton';
import TransactionHeader from './transaction/TransactionHeader';
import ConfirmRoundPanel from './transaction/ConfirmRoundPanel';
import { useRoundLocks } from '../../hooks/useRoundLocks';
import CompleteRoundPanel from './transaction/CompleteRoundPanel';
import './TransactionPage.css';

type AttendanceDisplayMode = 'all' | 'checkIn' | 'checkOut';


const TransactionPage: React.FC = () => {
  const { colors, effects, isDarkMode } = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [selectedBusIds, setSelectedBusIds] = useState<number[]>([]);
  const [selectedRoundIds, setSelectedRoundIds] = useState<number[]>([]);
  const [draftMap, setDraftMap] = useState<Record<string, DraftCell>>({});
  const [tripDropdownOpen, setTripDropdownOpen] = useState(false);
  const [busDropdownOpen, setBusDropdownOpen] = useState(false);
  const [roundDropdownOpen, setRoundDropdownOpen] = useState(false);
  const [departureRoundFilter, setDepartureRoundFilter] = useState<number | null>(null);
  const [returnRoundFilter, setReturnRoundFilter] = useState<number | null>(null);
  const [attendanceDisplayMode, setAttendanceDisplayMode] = useState<AttendanceDisplayMode>('all');
  const [showAddPassengerPanel, setShowAddPassengerPanel] = useState(false);
  const [extraPassengers, setExtraPassengers] = useState<PassengerRow[]>([]);
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  // Gom màu theme thành CSS variables để phần CSS của trang dùng lại thống nhất.
  const pageThemeVars = {
      '--page-primary': colors.primary,
      '--page-primary-11': `${colors.primary}11`,
      '--page-primary-22': `${colors.primary}22`,
      '--page-surface-light': colors.surfaceLight,
      '--page-background': colors.background,
      '--page-border': colors.border,
      '--page-border-light': colors.borderLight,
      '--page-table-header-bg': isDarkMode ? colors.surfaceLight : '#f8fafc',
      '--page-table-header-text': isDarkMode ? colors.textSecondary : '#475569',
    };

  // Đóng các dropdown filter khi click ra ngoài vùng toolbar.
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
          setBusDropdownOpen(false);
          setRoundDropdownOpen(false);
          setTripDropdownOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setBusDropdownOpen, setRoundDropdownOpen, setTripDropdownOpen]);

  // Hook này gom toàn bộ API query cần cho trang transaction.
  const {
    trips,
    tripsLoading,
    buses,
    busesLoading,
    rounds,
    roundsLoading,
    passengers,
    passengersLoading,
    transactions,
    transactionsLoading,
    refetchPassengers,
    refetchTransactions,
    busRoundStatuses,
    refetchBusRoundStatuses,
  } = useTransactionData(selectedTripId);

    // Tìm xe thực tế của hành khách ở một chặng: ưu tiên transaction đã có, fallback về xe được phân công.
    const getActualBusId = (
      passengerId: number,
      roundId: number,
      assignedBusId?: number | null
    ) => {
      const key = keyOf(passengerId, roundId);

      const txCell = txMap[key];

      if (txCell?.busId) {
        return Number(txCell.busId);
      }
      if (assignedBusId) {
        return Number(assignedBusId);
      }

      return null;
    };
    
  // Hook khóa lượt dùng actual bus id để biết ô check-in/check-out nào không được sửa.
  const { isLocked, lockStatuses, refetchLocks } = useRoundLocks(
    selectedTripId,
    getActualBusId
  );

  // Khi mới vào trang, tự chọn chuyến đầu tiên để người dùng có dữ liệu ngay.
  useEffect(() => {
    if (!selectedTripId && trips.length > 0) {
      setSelectedTripId(Number(trips[0].id));
    }
  }, [selectedTripId, trips]);

  // Đổi chuyến thì reset panel/khách ngoài biên chế để không lẫn dữ liệu giữa các chuyến.
  useEffect(() => {
    setExtraPassengers([]);
    setShowAddPassengerPanel(false);
  }, [selectedTripId]);

  // Lắng nghe MQTT để bảng tự cập nhật khi tài xế/admin khác thay đổi điểm danh hoặc khóa lượt.
  useTransactionRealtime({
    selectedTripId,
    refetchBusRoundStatuses,
    refetchLocks,
    refetchPassengers,
    refetchTransactions,
  });

  // Nếu chưa chọn xe nào thì chọn toàn bộ xe của chuyến; nếu danh sách xe đổi thì loại xe không còn hợp lệ.
  useEffect(() => {
    if (!buses.length) {
      setSelectedBusIds((prev) => (prev.length ? [] : prev));
      return;
    }

    setSelectedBusIds((prev) => {
      if (!prev.length) {
        const next = buses.map((b) => Number(b.id));
        return areNumberArraysEqual(prev, next) ? prev : next;
      }
      const valid = prev.filter((id) => buses.some((b) => Number(b.id) === id));
      const next = valid.length ? valid : buses.map((b) => Number(b.id));
      return areNumberArraysEqual(prev, next) ? prev : next;
    });
  }, [buses]);


  // Tương tự xe: mặc định chọn toàn bộ chặng và tự dọn id chặng không còn tồn tại.
  useEffect(() => {
    if (!rounds.length) {
      setSelectedRoundIds((prev) => (prev.length ? [] : prev));
      return;
    }

    setSelectedRoundIds((prev) => {
      if (!prev.length) {
        const next = rounds.map((r) => Number(r.id));
        return areNumberArraysEqual(prev, next) ? prev : next;
      }
      const valid = prev.filter((id) => rounds.some((r) => Number(r.id) === id));
      const next = valid.length ? valid : rounds.map((r) => Number(r.id));
      return areNumberArraysEqual(prev, next) ? prev : next;
    });
  }, [rounds]);

  // Nếu filter lượt đi/lượt về trỏ tới chặng đã bỏ chọn thì reset filter đó.
  useEffect(() => {
    if (departureRoundFilter && !selectedRoundIds.includes(departureRoundFilter)) {
      setDepartureRoundFilter(null);
    }

    if (returnRoundFilter && !selectedRoundIds.includes(returnRoundFilter)) {
      setReturnRoundFilter(null);
    }
  }, [departureRoundFilter, returnRoundFilter, selectedRoundIds]);

  // Quản lý draft local/offline và trả về storageKey để useTransactionSync biết queue nào cần xử lý.
  const storageKey = useTransactionDraftStorage({
    selectedTripId,
    draftMap,
    setDraftMap,
    refetchTransactions,
    refetchPassengers,
  });

  // Map dữ liệu transaction theo key passengerId_roundId để đọc trạng thái từng ô nhanh hơn.
  const txMap = useTransactionMap(transactions);

  // Sau khi server trả dữ liệu mới, xóa các draft đã trùng với DB để không còn báo "chưa lưu".
  useEffect(() => {
    setDraftMap((prev) => {
      let changed = false;
      const next = { ...prev };

      Object.entries(prev).forEach(([key, draft]) => {
        if (isSameCell(draft, txMap[key])) {
          delete next[key];
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [txMap]);


  // Danh sách hành khách chính thức thuộc các xe đang được chọn.
  const busFilteredPassengers = useMemo<PassengerRow[]>(() => {
    return passengers
      .map((p: any) => ({
        id: Number(p.id),
        name: p.name || '',
        tel: p.tel || '',
        note: p.note || '',
        busId: p.bus?.id ? Number(p.bus.id) : null,
        assignedBusId: p.bus?.id ? Number(p.bus.id) : null,
        busName: p.bus?.busCode || p.bus?.registrationNumber || '',
        assignedBusName: p.bus?.busCode || p.bus?.registrationNumber || '',
      }))
      .filter((p: PassengerRow) => p.busId && selectedBusIds.includes(Number(p.busId)));
  }, [passengers, selectedBusIds]);

  // Bổ sung hành khách đã có transaction dù không còn nằm trong xe đang lọc, tránh mất dòng đã điểm danh.
   const transactionBackedPassengers = useMemo<PassengerRow[]>(() => {
    const passengersById = new Map<number, PassengerRow>();
    const passengerDict = new Map(passengers.map((p: any) =>[Number(p.id), p]));

    transactions.forEach((tx) => {
      const passengerId = Number(tx.passengerId ?? tx.passenger?.id ?? 0);
      const actualBusId = Number(tx.busId ?? tx.bus?.id ?? 0);
      const assignedBusId = Number(tx.passenger?.busId ?? tx.passenger?.bus?.id ?? 0);
      if (!passengerId || !actualBusId) return;
      const eventBusIds = (tx.events || [])
        .map((event) => Number(event.busId || 0))
        .filter(Boolean);
      const selectedEventBusId = eventBusIds.find((eventBusId) => selectedBusIds.includes(eventBusId));

      const isInActualBusFilter = selectedBusIds.includes(actualBusId);
      const isInAssignedBusFilter = assignedBusId ? selectedBusIds.includes(assignedBusId) : false;
      const isInEventBusFilter = Boolean(selectedEventBusId);
      if (!isInActualBusFilter && !isInAssignedBusFilter && !isInEventBusFilter) return;

      if (passengersById.has(passengerId)) return;

      const assignedFromPassengerList = passengerDict.get(passengerId);
      const displayBusId = isInActualBusFilter || isInAssignedBusFilter
        ? actualBusId
        : selectedEventBusId || actualBusId;
      const displayBus = buses.find((bus) => Number(bus.id) === Number(displayBusId));
      const assignedBusName =
        assignedFromPassengerList?.bus?.busCode ||
        assignedFromPassengerList?.bus?.registrationNumber ||
        tx.passenger?.bus?.busCode ||
        tx.passenger?.bus?.registrationNumber ||
        '';

      passengersById.set(passengerId, {
        id: passengerId,
        name: tx.passenger?.name || '',
        tel: tx.passenger?.tel || '',
        note: assignedFromPassengerList?.note || tx.passenger?.note || '',
        busId: displayBusId,
        assignedBusId: assignedFromPassengerList?.bus?.id
          ? Number(assignedFromPassengerList.bus.id)
          : assignedBusId || null,
        busName: displayBus?.busCode || displayBus?.registrationNumber || tx.bus?.busCode || tx.bus?.registrationNumber || '',
        assignedBusName,
      });
    });

    return Array.from(passengersById.values());
  }, [transactions, selectedBusIds, passengers, buses]);

  

  // Thêm khách ngoài biên chế vào danh sách tạm trên màn, chưa lưu DB ngay.
  const addExtraPassenger = (passenger: PassengerRow) => {
    setExtraPassengers((prev) => {
      if(prev.some(p => p.id === passenger.id)) return prev;
      return [...prev, passenger];
    });
  };

  // Chỉ cho xóa khỏi bảng nếu khách không thuộc biên chế xe hiện tại.
  const canRemovePassenger = (row: PassengerRow) => {
    const assignedBusId = assignedBusByPassengerId.get(Number(row.id));
    if (!assignedBusId) return false;
    return !selectedBusIds.includes(Number(assignedBusId));
  };

  // Xóa khách ngoài biên chế khỏi các transaction của chuyến hiện tại và dọn draft liên quan.
  const handleRemovePassengerFromTransaction = async (row: PassengerRow) => {
    if (!selectedTripId) return;

    if (!canRemovePassenger(row)) {
      enqueueSnackbar('Không được xóa khách thuộc biên chế xe bạn quản lý. Chỉ được xóa khách thuộc xe khác.', { variant: 'warning' });
      return;
    }

    const ok = window.confirm(`Xóa khách ${row.name} khỏi transaction của chuyến hiện tại?`);
    if (!ok) return;

    try {
      const txToDelete = transactions.filter((tx) => {
        const passengerId = Number(tx.passengerId ?? tx.passenger?.id ?? 0);
        const tripId = Number(tx.round?.tripId ?? 0);
        return passengerId === Number(row.id) && tripId === Number(selectedTripId);
      });

      if (txToDelete.length > 0) {
        await Promise.all(txToDelete.map((tx) => api.deleteTransaction(String(tx.id))));
      }

      setDraftMap((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((key) => {
          if (key.startsWith(`${row.id}_`)) {
            delete next[key];
          }
        });
        return next;
      });

      setExtraPassengers((prev) => prev.filter((p) => p.id !== row.id));

      await Promise.all([refetchTransactions(), refetchPassengers()]);
      enqueueSnackbar('Đã xóa khách khỏi bảng điểm danh', { variant: 'success' });
    } catch (error: any) {
      const message =
        error?.status === 409
          ? 'Không thể xóa khách đang có trạng thái điểm danh. Hãy bỏ tick điểm danh trước khi xóa khỏi bảng.'
          : error?.message || 'Không thể xóa khách khỏi bảng điểm danh';

      enqueueSnackbar(message, { variant: 'error' });
    }
  };

  // Gỡ khách ngoài biên chế khỏi danh sách tạm khi chưa xác nhận lưu.
  const removeExtraPassenger = (passengerId: number) => {
    setExtraPassengers((prev) => prev.filter((p) => p.id !== passengerId));
  };

 

  // Gộp khách chính thức và khách có transaction thành danh sách hiển thị, tránh trùng theo passenger id.
  const displayedPassengers = useMemo<PassengerRow[]>(() => {
    const map = new Map<number, PassengerRow>();
    busFilteredPassengers.forEach((p) => map.set(p.id, p));
    transactionBackedPassengers.forEach((p) => map.set(p.id, p));
    return Array.from(map.values());
  }, [busFilteredPassengers, transactionBackedPassengers]);

  const existingPassengerIds = useMemo(() => displayedPassengers.map((p) => p.id), [displayedPassengers]);

  // Tạo map passenger -> bus được phân công để kiểm tra quyền xóa/hiển thị.
  const assignedBusByPassengerId = useMemo(() => {
    const map = new Map<number, number | null>();

    displayedPassengers.forEach((p) => {
      map.set(Number(p.id), p.assignedBusId ?? null);
    });

    return map;
  }, [displayedPassengers]);

  
  // Chỉ lấy các chặng đang được chọn để dựng cột bảng và tính tổng.
  const selectedRounds = useMemo(
    () => rounds.filter((r) => selectedRoundIds.includes(Number(r.id))),
    [rounds, selectedRoundIds]
  );

  const extraPassengerTargetBusId = selectedBusIds.length === 1 ? Number(selectedBusIds[0]) : selectedBusIds[0] ?? null;

  // Không cho thêm khách ngoài biên chế nếu chặng của xe đã được tài xế xác nhận hoàn tất.
  const extraPassengerRoundConfirmed = useMemo(() => {
    if (!extraPassengerTargetBusId || !selectedRounds.length) {
      return false;
    }

    return selectedRounds.some((round) => {
      const status = busRoundStatuses.find(
        (item) =>
          Number(item.busId) === Number(extraPassengerTargetBusId) &&
          Number(item.roundId) === Number(round.id)
      );

      return Boolean(status?.driverConfirmedBy);
    });
  }, [busRoundStatuses, extraPassengerTargetBusId, selectedRounds]);

  // Lấy trạng thái ô: draft đang sửa sẽ đè lên dữ liệu DB, nhưng ghi chú chưa touched vẫn lấy từ DB.
  const getCell = (passengerId: number, roundId: number): DraftCell | null => {
    const key = keyOf(passengerId, roundId);
    const draft = draftMap[key];
    const base = txMap[key];
    if (!draft) return base || null;

    return {
      ...draft,
      checkInBusId: draft.checkInBusId ?? base?.checkInBusId ?? draft.busId,
      checkOutBusId: draft.checkOutBusId ?? base?.checkOutBusId ?? draft.busId,
      checkInNote: draft.checkInNoteTouched ? draft.checkInNote : base?.checkInNote ?? draft.checkInNote,
      checkOutNote: draft.checkOutNoteTouched ? draft.checkOutNote : base?.checkOutNote ?? draft.checkOutNote,
    };
  };

  // Cập nhật một ô điểm danh/ghi chú trên màn, đồng thời chặn sửa nếu lượt đã bị khóa.
  const setCell = (payload: Partial<DraftCell>) => {
    
  if (payload.passengerId === undefined || payload.roundId === undefined || payload.busId === undefined) {
    return;
  }

  const key = keyOf(payload.passengerId, payload.roundId);

  const baseCell = txMap[key];

     
        const lockedIn = isLocked(
          payload.passengerId,
          payload.busId,
          Number(payload.roundId),
          'checkIn'
        );

        const lockedOut = isLocked(
          payload.passengerId,
          payload.busId,
          Number(payload.roundId),
          'checkOut'
        );

        const changingCheckIn =
          payload.checkIn !== undefined
            ? baseCell
              ? payload.checkIn !== baseCell.checkIn
              : payload.checkIn === true
            : false;

        const changingCheckInNote =
          payload.checkInNote !== undefined
            ? baseCell
              ? payload.checkInNote !== baseCell.checkInNote
              : (payload.checkInNote ?? '').trim() !== ''
            : false;

        const changingCheckOut =
          payload.checkOut !== undefined
            ? baseCell
              ? payload.checkOut !== baseCell.checkOut
              : payload.checkOut === true
            : false;

        const changingCheckOutNote =
          payload.checkOutNote !== undefined
            ? baseCell
              ? payload.checkOutNote !== baseCell.checkOutNote
              : (payload.checkOutNote ?? '').trim() !== ''
            : false;

        if (
          (lockedIn && (changingCheckIn || changingCheckInNote)) ||
          (lockedOut && (changingCheckOut || changingCheckOutNote))
        ) {
          enqueueSnackbar(
            buildLockedAttendanceMessage({
              lockedIn,
              lockedOut,
              changingCheckIn,
              changingCheckInNote,
              changingCheckOut,
              changingCheckOutNote,
            }),
            { variant: 'warning' }
          );
          return;               
        } 

    const defaultCell: DraftCell = {
    passengerId: payload.passengerId,
    roundId: payload.roundId,
    busId: payload.busId,
    checkIn: false,
    checkOut: false,
    checkInNote: '',
    checkOutNote: '',
    checkInBusId: payload.busId,
    checkOutBusId: payload.busId,
  };

  const cleanPayload = Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined)
  ) as Partial<DraftCell>;

  const merged: DraftCell = {
    ...defaultCell,
    ...baseCell,
    ...draftMap[key],
    ...cleanPayload,
  };

  const isDirty = !isSameCell(merged, baseCell);

  setDraftMap((prev) => ({
    ...prev,
    [key]: {
      ...merged,
      dirty: isDirty,
    },
  }));
};

  // Kiểm tra hành khách có mặt ở một chặng theo hướng lượt đi hoặc lượt về.
  const isPresentAtRound = (passengerId: number, roundId: number, direction: 'checkIn' | 'checkOut') => {
    const cell = getCell(passengerId, roundId);
    return Boolean(cell?.[direction]);
  };

  // Lọc danh sách hiển thị theo dropdown "Lượt đi" và "Lượt về".
  const visiblePassengers = useMemo(() => {
    return displayedPassengers.filter((p) => {
      if (departureRoundFilter && !isPresentAtRound(p.id, departureRoundFilter, 'checkIn')) {
        return false;
      }

      if (returnRoundFilter && !isPresentAtRound(p.id, returnRoundFilter, 'checkOut')) {
        return false;
      }

      return true;
    });
  }, [displayedPassengers, departureRoundFilter, returnRoundFilter, txMap, draftMap]);

  // Những ô khác DB sẽ được coi là dirty và đưa vào queue lưu/sync.
  const dirtyEntries = useMemo(
    () => Object.values(draftMap).filter((entry) => !isSameCell(entry, txMap[keyOf(entry.passengerId, entry.roundId)])),
    [draftMap, txMap]
  );

  // Tạo mô tả ngắn về các thay đổi chưa lưu để debug và hiển thị trạng thái sync.
  const dirtyEntryDetails = useMemo(() => {
    const busLabelById = new Map(
      buses.map((bus) => [
        Number(bus.id),
        bus.busCode || bus.registrationNumber || `Xe #${bus.id}`,
      ])
    );
    const passengerLabelById = new Map(displayedPassengers.map((passenger) => [Number(passenger.id), passenger.name || `Khách #${passenger.id}`]));
    const roundLabelById = new Map(rounds.map((round) => [Number(round.id), round.name || `Chặng #${round.id}`]));
    const yesNo = (value?: boolean) => (value ? 'Có' : 'Không');
    const busLabel = (busId?: number | null) => (busId ? busLabelById.get(Number(busId)) || `Xe #${busId}` : 'Trống');

    return dirtyEntries.slice(0, 5).map((entry) => {
      const base = txMap[keyOf(entry.passengerId, entry.roundId)];
      const changes: string[] = [];

      if (entry.checkIn !== Boolean(base?.checkIn)) {
        changes.push(`lượt đi DB=${yesNo(base?.checkIn)} -> màn=${yesNo(entry.checkIn)}`);
      }

      if (entry.checkOut !== Boolean(base?.checkOut)) {
        changes.push(`lượt về DB=${yesNo(base?.checkOut)} -> màn=${yesNo(entry.checkOut)}`);
      }

      if (entry.checkIn && Number(entry.checkInBusId ?? entry.busId) !== Number(base?.checkInBusId ?? base?.busId ?? entry.busId)) {
        changes.push(`xe lượt đi DB=${busLabel(base?.checkInBusId ?? base?.busId)} -> màn=${busLabel(entry.checkInBusId ?? entry.busId)}`);
      }

      if (entry.checkOut && Number(entry.checkOutBusId ?? entry.busId) !== Number(base?.checkOutBusId ?? base?.busId ?? entry.busId)) {
        changes.push(`xe lượt về DB=${busLabel(base?.checkOutBusId ?? base?.busId)} -> màn=${busLabel(entry.checkOutBusId ?? entry.busId)}`);
      }

      if (entry.checkInNoteTouched && normalizeNote(entry.checkInNote) !== normalizeNote(base?.checkInNote)) {
        changes.push(`ghi chú lượt đi DB="${normalizeNote(base?.checkInNote)}" -> màn="${normalizeNote(entry.checkInNote)}"`);
      }

      if (entry.checkOutNoteTouched && normalizeNote(entry.checkOutNote) !== normalizeNote(base?.checkOutNote)) {
        changes.push(`ghi chú lượt về DB="${normalizeNote(base?.checkOutNote)}" -> màn="${normalizeNote(entry.checkOutNote)}"`);
      }

      return `${passengerLabelById.get(Number(entry.passengerId)) || `Khách #${entry.passengerId}`} - ${roundLabelById.get(Number(entry.roundId)) || `Chặng #${entry.roundId}`}: ${changes.join('; ') || 'draft khác DB'}`;
    });
  }, [buses, dirtyEntries, displayedPassengers, rounds, txMap]);

  // Hook này xử lý lưu/sync dirty entries, bao gồm cả chế độ offline.
  useTransactionSync({
    dirtyEntries,
    dirtyEntryDetails,
    enabled: !transactionsLoading,
    selectedTripId,
    storageKey,
  });

  useRegisterUnsavedChanges(false);

  const isLoading = tripsLoading || busesLoading || roundsLoading || passengersLoading || transactionsLoading;

  // Lưu toàn bộ khách ngoài biên chế vào DB cho các chặng đang chọn.
  const handleConfirmAllExtraPassengers = async () => {
    if (extraPassengers.length === 0 || !selectedTripId) return;

    if (extraPassengerRoundConfirmed) {
      enqueueSnackbar('Chặng đã xác nhận hoàn tất, không thể thêm khách ngoài biên chế.', { variant: 'warning' });
      return;
    }
    
    try {
    
      // Mỗi khách ngoài biên chế cần một transaction cho từng chặng được chọn.
      const savePromises = extraPassengers.flatMap((passenger) => 
        selectedRoundIds.map((roundId) => 
          api.createTransaction({
            passengerId: passenger.id,
            roundId: roundId,
            busId: passenger.busId!,
            checkIn: false,
            checkOut: false,
            checkInNote: null,
            checkOutNote: null,
          })
        )
      );
      await Promise.all(savePromises);
      enqueueSnackbar('Đã thêm khách ngoài biên chế vào bảng', { variant: 'success' });
      await Promise.all([refetchTransactions(), refetchPassengers()]);
      setExtraPassengers([]);
      setShowAddPassengerPanel(false);
    }catch(error: any) {
      const conflictMessage =
        error?.status === 409 && typeof error?.message === 'string'
          ? error.message.split(' - ').pop()
          : null;
      enqueueSnackbar(
        conflictMessage || error?.message || 'Có lỗi xảy ra khi thêm khách ngoài biên chế',
        { variant: 'error' }
      );
    } 
  };
  return (
    <div className="animate-fade-in p-0 p-md-3 transaction-page pb-5" style={pageThemeVars as React.CSSProperties}>
      
          <TransactionHeader>{null}</TransactionHeader>


      {/* Filters Toolbar - Đã gọn hóa */}
      <div 
        className="p-3 mb-4 shadow-sm"
        style={{ 
          background: colors.surface, 
          borderRadius: effects.borderRadius.lg,
          border: `1px solid ${colors.border}`,
        }}
      >
        <div ref={filterDropdownRef}>
        <TransactionFilters
            trips={trips} 
            buses={buses} 
            rounds={rounds}
            selectedTripId={selectedTripId} 
            selectedBusIds={selectedBusIds} 
            selectedRoundIds={selectedRoundIds}
            tripDropdownOpen={tripDropdownOpen}
            busDropdownOpen={busDropdownOpen} 
            roundDropdownOpen={roundDropdownOpen}
            setSelectedTripId={setSelectedTripId} 
            setTripDropdownOpen={setTripDropdownOpen}
            setBusDropdownOpen={setBusDropdownOpen} 
            setRoundDropdownOpen={setRoundDropdownOpen}
            toggleBus={(id) => setSelectedBusIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])}
            toggleRound={(id) => setSelectedRoundIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])}
            onTripChange={() => setDraftMap({})}
          />
        </div>
        
        <div className="mt-3 pt-3 border-top d-flex flex-column gap-3" style={{ borderColor: colors.border }}>
            <div className="d-flex flex-wrap align-items-center gap-3">
              
              <button 
                className="btn-outline-custom flex-grow-1 flex-md-grow-0" 
                onClick={() => setShowAddPassengerPanel(!showAddPassengerPanel)}
                style={{ 
                  border: `1px solid ${colors.primary}44`, 
                  color: colors.primary,
                  padding: '8px 16px',
                  minWidth: '200px' 
                }}
              >
                <UserPlus size={16} /> <span className="ms-1">Khách ngoài biên chế</span>
              </button>

              <div className="col-12 col-lg flex-grow-1">
               <div className="row g-2">
                <div className="col-12 col-sm-6 d-flex align-items-center gap-2">
                  <label className="text-nowrap small fw-bold mb-0" style={{ color: colors.textSecondary }}>
                    Lượt đi:
                  </label>
                  <select 
                    className="form-select-custom-toolbar flex-grow-1" 
                    value={departureRoundFilter ?? ''} 
                    onChange={(e) => setDepartureRoundFilter(e.target.value ? Number(e.target.value) : null)}
                    style={{ 
                      backgroundColor: isDarkMode ? colors.background : '#fff', 
                      color: colors.textPrimary, 
                      border: `1px solid ${colors.border}`,
                      padding: '4px 8px',
                      borderRadius: '6px',
                      width: '100%' 
                    }}
                  >
                    <option value="">Tất cả</option>
                    {selectedRounds.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>

                <div className="col-12 col-sm-6 d-flex align-items-center gap-2">
                  <label className="text-nowrap small fw-bold mb-0" style={{ color: colors.textSecondary }}>
                    Lượt về:
                  </label>
                  <select 
                    className="form-select-custom-toolbar flex-grow-1" 
                    value={returnRoundFilter ?? ''} 
                    onChange={(e) => setReturnRoundFilter(e.target.value ? Number(e.target.value) : null)}
                    style={{ 
                      backgroundColor: isDarkMode ? colors.background : '#fff', 
                      color: colors.textPrimary, 
                      border: `1px solid ${colors.border}`,
                      padding: '4px 8px',
                      borderRadius: '6px',
                      width: '100%'
                    }}
                  >
                    <option value="">Tất cả</option>
                    {selectedRounds.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                </div>
              </div>
            </div>
           <ExtraPassengerPanel
              show={showAddPassengerPanel}
              passengers={passengers}
              buses={buses}
              selectedBusIds={selectedBusIds}
              existingPassengerIds={existingPassengerIds}
              extraPassengers={extraPassengers}
              onAdd={addExtraPassenger}
              onRemove={removeExtraPassenger}
              onConfirmAll={handleConfirmAllExtraPassengers}
              confirmDisabled={extraPassengerRoundConfirmed}
              confirmDisabledReason="Chặng đã xác nhận hoàn tất nên không thể thêm khách ngoài biên chế."
              onClose={() => setShowAddPassengerPanel(false)}
            />
              
        </div>
      </div>

      {/* Main Table Container */}
      <div className="table-container-card shadow-sm" style={{ backgroundColor: colors.surface, borderRadius: effects.borderRadius.lg, border: `1px solid ${colors.border}`, overflow: 'hidden' }}>
        <DataTable<TransactionTableRow>
          title="Danh sách điểm danh"
          titleActions={
            <>
              <div className="attendance-display-switch d-flex flex-wrap align-items-center gap-2">
                {[
                  { value: 'all', label: 'Đầy đủ' },
                  { value: 'checkIn', label: 'Lượt đi' },
                  { value: 'checkOut', label: 'Lượt về' },
                ].map((option) => {
                  const active = attendanceDisplayMode === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`attendance-display-option ${active ? 'active' : ''}`}
                      onClick={() => setAttendanceDisplayMode(option.value as AttendanceDisplayMode)}
                      style={{
                        backgroundColor: active ? colors.primary : colors.surface,
                        color: active ? '#fff' : colors.textSecondary,
                        borderColor: active ? colors.primary : colors.border,
                      }}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <ExportExcelButton
                visiblePassengers={visiblePassengers}
                selectedRounds={selectedRounds}
                trips={trips}
                selectedTripId={selectedTripId}
                buses={buses}
                getCell={getCell}
              />
            </>
          }
          queryKey={['transaction-table', selectedTripId, selectedBusIds.join(','), selectedRoundIds.join(','), departureRoundFilter, returnRoundFilter]}
          data={visiblePassengers}
          columns={buildTransactionColumns({
            selectedRounds,
            displayMode: attendanceDisplayMode,
            getCell,
            setCell,
            isLocked,
            onRemovePassenger: handleRemovePassengerFromTransaction,
            canRemovePassenger,
          })}
          isLoading={isLoading}
          initialPageSize={50}
          onRefresh={() => { refetchTransactions(); refetchPassengers(); refetchLocks(); }}
        />
      <div className="bento-action-hub shadow-sm" 
           style={{ 
            backgroundColor: isDarkMode ? 'rgba(20, 27, 49, 0.4)' : '#f8fafc',
            border: `1px solid ${colors.border}`, 
            borderRadius: effects.borderRadius.lg }}>
        <div className="d-flex flex-column gap-2">
        <ConfirmRoundPanel 
            selectedRounds={selectedRounds} 
            selectedBusIds={selectedBusIds} 
          lockStatuses={lockStatuses} 
            onSuccess={() => { refetchTransactions(); refetchLocks(); }} 
        />
        <CompleteRoundPanel
            selectedRounds={selectedRounds}
            selectedBusIds={selectedBusIds}
            busRoundStatuses={busRoundStatuses}
            onSuccess={() => { refetchTransactions(); refetchLocks(); refetchBusRoundStatuses(); }}
          />
        </div>
      </div>
      </div>
    </div>
  );
};

export default TransactionPage;

