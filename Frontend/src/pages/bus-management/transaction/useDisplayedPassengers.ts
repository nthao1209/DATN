import { useMemo } from 'react';
import type { BusOption, PassengerRow, TransactionRecord } from './types';

export const useDisplayedPassengers = ({
  passengers,
  transactions,
  selectedBusIds,
  buses,
}: {
  passengers: any[];
  transactions: TransactionRecord[];
  selectedBusIds: number[];
  buses: BusOption[];
}) => {
  const busFilteredPassengers = useMemo<PassengerRow[]>(() => {
    // Danh sách gốc: hành khách được phân bổ ban đầu vào các xe đang chọn.
    return passengers
      .map((passenger: any) => ({
        id: Number(passenger.id),
        name: passenger.name || '',
        tel: passenger.tel || '',
        note: passenger.note || '',
        busId: passenger.bus?.id ? Number(passenger.bus.id) : null,
        assignedBusId: passenger.bus?.id ? Number(passenger.bus.id) : null,
        busName: passenger.bus?.busCode || passenger.bus?.registrationNumber || '',
        assignedBusName: passenger.bus?.busCode || passenger.bus?.registrationNumber || '',
      }))
      .filter((passenger: PassengerRow) => passenger.busId && selectedBusIds.includes(Number(passenger.busId)));
  }, [passengers, selectedBusIds]);

  const transactionBackedPassengers = useMemo<PassengerRow[]>(() => {
    // Danh sách bổ sung từ transaction/event để vẫn thấy khách phát sinh điểm danh trên xe khác.
    // Đây là phần giúp màn trưởng xe/trưởng đoàn không bị mất khách sai xe khi lọc theo xe thực tế.
    const passengersById = new Map<number, PassengerRow>();
    const passengerDict = new Map(passengers.map((passenger: any) => [Number(passenger.id), passenger]));

    transactions.forEach((transaction) => {
      const passengerId = Number(transaction.passengerId ?? transaction.passenger?.id ?? 0);
      const actualBusId = Number(transaction.busId ?? transaction.bus?.id ?? 0);
      const assignedBusId = Number(transaction.passenger?.busId ?? transaction.passenger?.bus?.id ?? 0);
      if (!passengerId || !actualBusId) return;

      const eventBusIds = (transaction.events || [])
        .map((event) => Number(event.busId || 0))
        .filter(Boolean);
      const selectedEventBusId = eventBusIds.find((eventBusId) => selectedBusIds.includes(eventBusId));

      // Một khách được hiển thị nếu thuộc xe gốc đang lọc, xe transaction đang lọc,
      // hoặc từng có event điểm danh phát sinh trên xe đang lọc.
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
        transaction.passenger?.bus?.busCode ||
        transaction.passenger?.bus?.registrationNumber ||
        '';

      passengersById.set(passengerId, {
        id: passengerId,
        name: transaction.passenger?.name || '',
        tel: transaction.passenger?.tel || '',
        note: assignedFromPassengerList?.note || transaction.passenger?.note || '',
        busId: displayBusId,
        assignedBusId: assignedFromPassengerList?.bus?.id
          ? Number(assignedFromPassengerList.bus.id)
          : assignedBusId || null,
        busName: displayBus?.busCode || displayBus?.registrationNumber || transaction.bus?.busCode || transaction.bus?.registrationNumber || '',
        assignedBusName,
      });
    });

    return Array.from(passengersById.values());
  }, [transactions, selectedBusIds, passengers, buses]);

  const displayedPassengers = useMemo<PassengerRow[]>(() => {
    // Gộp hai nguồn theo passengerId để mỗi khách chỉ xuất hiện một dòng trên bảng.
    const map = new Map<number, PassengerRow>();
    busFilteredPassengers.forEach((passenger) => map.set(passenger.id, passenger));
    transactionBackedPassengers.forEach((passenger) => map.set(passenger.id, passenger));
    return Array.from(map.values());
  }, [busFilteredPassengers, transactionBackedPassengers]);

  const existingPassengerIds = useMemo(
    () => displayedPassengers.map((passenger) => passenger.id),
    [displayedPassengers]
  );

  const assignedBusByPassengerId = useMemo(() => {
    // Map này dùng khi tạo draft điểm danh để biết xe gốc của khách, phục vụ cảnh báo sai xe.
    const map = new Map<number, number | null>();

    displayedPassengers.forEach((passenger) => {
      map.set(Number(passenger.id), passenger.assignedBusId ?? null);
    });

    return map;
  }, [displayedPassengers]);

  return {
    displayedPassengers,
    existingPassengerIds,
    assignedBusByPassengerId,
  };
};
