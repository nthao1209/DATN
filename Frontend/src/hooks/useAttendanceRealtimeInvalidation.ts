import { useEffect, useRef } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import {
  subscribeAttendanceUpdates,
  subscribeMqttTopics,
  type MqttSubscriptionHandle,
} from '../services/mqtt';

type UseAttendanceRealtimeInvalidationParams = {
  tenantId?: number | null;
  tripId?: number | null;
  queryKeys: QueryKey[];
  debounceMs?: number;
};

const isAttendanceUpdate = (message: Record<string, unknown>) =>
  message.type === 'attendance.updated' || message.type === 'attendance.wrong_bus';

const isDashboardRefresh = (message: Record<string, unknown>) =>
  message.type === 'dashboard.refresh';

export const useAttendanceRealtimeInvalidation = ({
  tenantId,
  tripId,
  queryKeys,
  debounceMs = 500,
}: UseAttendanceRealtimeInvalidationParams) => {
  const queryClient = useQueryClient();
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if ((!tenantId && !tripId) || queryKeys.length === 0) return;

    const invalidateQueries = () => {
      // Debounce để nhiều event MQTT liên tiếp chỉ tạo một lượt refetch, tránh giật bảng.
      if (timerRef.current !== null) return;

      timerRef.current = window.setTimeout(async () => {
        timerRef.current = null;
        await Promise.all(
          queryKeys.map((queryKey) =>
            queryClient.invalidateQueries({ queryKey })
          )
        );
      }, debounceMs);
    };

    const subscriptions: MqttSubscriptionHandle[] = [];

    if (tenantId) {
      subscriptions.push(
        subscribeMqttTopics([`dashboard/tenant/${tenantId}`], (_topic, message) => {
          // Dashboard nghe theo tenant, còn attendance update phải khớp tenant mới refetch.
          if (
            isDashboardRefresh(message) ||
            (isAttendanceUpdate(message) && Number(message.tenantId) === Number(tenantId))
          ) {
            invalidateQueries();
          }
        })
      );
    }

    if (tripId) {
      subscriptions.push(
        subscribeAttendanceUpdates(Number(tripId), () => {
          // Các trang theo chuyến chỉ cần nhận tín hiệu rồi invalidate query, dữ liệu chuẩn vẫn lấy từ API.
          invalidateQueries();
        })
      );
    }

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      subscriptions.forEach((subscription) => subscription.end(true));
    };
  }, [debounceMs, queryClient, queryKeys, tenantId, tripId]);
};
