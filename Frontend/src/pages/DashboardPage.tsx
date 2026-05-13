import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { type RootState } from '../redux/store';
import { 
  TrendingUp, Users, MapPinned, Route, Bus,
  Copy, RefreshCw, LayoutDashboard, Calendar
} from 'lucide-react';
import StatCard from '../components/StatCard';
import TenantSelector from '../components/TenantSelector';
import { useTheme } from '../theme/ThemeContext';
import { useSnackbar } from 'notistack';
import api from '../services/api';

const getBusLabel = (bus: any) => bus?.busCode || bus?.registrationNumber || (bus?.id ? `Xe ${bus.id}` : '-');

const formatRelativeTime = (value: string | Date) => {
  const diffMinutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (diffMinutes < 1) return 'Vừa xong';
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} ngày trước`;
};

const formatCount = (value: number) => new Intl.NumberFormat('vi-VN').format(value);

const Dashboard: React.FC = () => {
  const { colors } = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const [showTenantSelector, setShowTenantSelector] = useState(false);
  const { currentTenant, roleId } = useSelector((state: RootState) => state.auth);
  const canViewJoinCode = [1, 2].includes(roleId || 0);

  const { data: trips = [], isLoading: tripsLoading, refetch: refetchTrips } = useQuery<any[]>({
    queryKey: ['dashboard-trips'],
    queryFn: api.getTrips,
  });

  const tripIds = useMemo(
    () => trips.map((trip: any) => Number(trip.id)).filter((id: number) => Number.isFinite(id) && id > 0),
    [trips]
  );

  const { data: buses = [], isLoading: busesLoading, refetch: refetchBuses } = useQuery<any[]>({
    queryKey: ['dashboard-buses', tripIds.join(',')],
    enabled: tripIds.length > 0,
    queryFn: async () => {
      const busesByTrip = await Promise.all(tripIds.map((tripId) => api.getBuses(String(tripId))));
      return busesByTrip.flat();
    },
  });

  const { data: rounds = [], isLoading: roundsLoading, refetch: refetchRounds } = useQuery<any[]>({
    queryKey: ['dashboard-rounds', tripIds.join(',')],
    enabled: tripIds.length > 0,
    queryFn: async () => {
      const roundsByTrip = await Promise.all(tripIds.map((tripId) => api.getRounds(String(tripId))));
      return roundsByTrip.flat();
    },
  });

  const { data: passengers = [], isLoading: passengersLoading, refetch: refetchPassengers } = useQuery<any[]>({
    queryKey: ['dashboard-passengers', tripIds.join(',')],
    enabled: tripIds.length > 0,
    queryFn: async () => {
      const passengersByTrip = await Promise.all(tripIds.map((tripId) => api.getPassengers(String(tripId))));
      return passengersByTrip.flat();
    },
  });

  const { data: transactions = [], isLoading: transactionsLoading, refetch: refetchTransactions } = useQuery<any[]>({
    queryKey: ['dashboard-transactions'],
    queryFn: api.getTransactions,
  });

  const tripCards = useMemo(() => {
    return trips.map((trip: any) => {
      const tripId = Number(trip.id);
      const passengersOfTrip = passengers.filter((passenger: any) => Number(passenger.bus?.trip?.id) === tripId);
      return {
        id: tripId,
        name: trip.name || `Trip ${tripId}`,
        status: String(trip.status || '').toUpperCase(),
        busCount: Number(trip?._count?.buses || buses.filter((bus: any) => Number(bus.trip?.id) === tripId).length),
        roundCount: Number(trip?._count?.rounds || rounds.filter((round: any) => Number(round.trip?.id) === tripId).length),
        passengerCount: passengersOfTrip.length,
      };
    });
  }, [buses, passengers, rounds, trips]);

  const activeTrips = tripCards.filter((trip) => trip.status === 'DOING').length;
  const doneTrips = tripCards.filter((trip) => trip.status === 'DONE').length;
  void doneTrips; // used for future UI; silence unused-variable TS error
  const totalBuses = buses.length;
  const totalRounds = rounds.length;
  const totalPassengers = passengers.length;
  const completedRounds = rounds.filter((round: any) => String(round.status || '').toUpperCase() === 'DONE').length;

  const recentActivities = useMemo(() => {
    return [...transactions]
      .sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5)
      .map((transaction: any) => ({
        id: transaction.id,
        title: transaction.passenger?.name || `Hành khách #${transaction.passengerId}`,
        detail: `${getBusLabel(transaction.bus || transaction.passenger?.bus)} · ${transaction.round?.name || `Round #${transaction.roundId}`}`,
        time: formatRelativeTime(transaction.updatedAt),
        status: transaction.checkIn && transaction.checkOut
          ? 'Đã check-in/out'
          : transaction.checkIn
            ? 'Đã check-in'
            : transaction.checkOut
              ? 'Đã check-out'
              : 'Chưa xác nhận',
      }));
  }, [transactions]);

  const busiestTrips = useMemo(() => {
    return [...tripCards]
      .sort((a, b) => b.passengerCount - a.passengerCount)
      .slice(0, 5);
  }, [tripCards]);

  const maxPassengerCount = Math.max(1, ...busiestTrips.map((trip) => trip.passengerCount));

  const handleRefresh = async () => {
    await Promise.all([
      refetchTrips(),
      refetchBuses(),
      refetchRounds(),
      refetchPassengers(),
      refetchTransactions(),
    ]);
    enqueueSnackbar('Đã tải lại dữ liệu thật', { variant: 'success' });
  };

  const isLoading = tripsLoading || busesLoading || roundsLoading || passengersLoading || transactionsLoading;

  const copyJoinCode = () => {
    if (currentTenant?.joinCode) {
      navigator.clipboard.writeText(currentTenant.joinCode);
      enqueueSnackbar('Đã sao chép mã mời!', { variant: 'success' });
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-5">
        <div>
          <div className="d-flex align-items-center gap-2 text-primary mb-2">
            <LayoutDashboard size={20} />
            <span className="fw-bold small text-uppercase tracking-wider">Tổng quan hệ thống</span>
          </div>
          <h1 className="h2 fw-bold mb-1">Chào mừng quay lại!</h1>
          <div className="d-flex align-items-center gap-2 text-gray-500">
            <Calendar size={14} />
            <span className="small">Hôm nay, {new Date().toLocaleDateString('vi-VN')}</span>
          </div>
        </div>

        <div className="d-flex gap-2">
          <button 
            className="btn-glass d-flex align-items-center gap-2" 
            onClick={handleRefresh}
          >
            <RefreshCw size={16} className={isLoading ? 'spin' : ''} /> Làm mới dữ liệu
          </button>
          <button 
            className="btn-glass d-flex align-items-center gap-2" 
            onClick={() => setShowTenantSelector(true)}
          >
            <Copy size={16} /> Chuyển tổ chức
          </button>
        </div>
      </div>

      {/* Join Code Banner (Nếu có quyền) */}
      {canViewJoinCode && currentTenant?.joinCode && (
        <div className="join-code-banner mb-4 d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-3">
            <div className="icon-badge">
              <Users size={20} className="text-primary" />
            </div>
            <div>
              <h6 className="m-0 text-white fw-bold">Mã mời tổ chức</h6>
              <p className="m-0 text-gray-500 small">Chia sẻ mã này để thành viên khác tham gia vào {currentTenant?.name}</p>
            </div>
          </div>
          <div className="d-flex align-items-center gap-2 bg-dark p-1 ps-3 rounded-pill border border-gray-800">
            <code className="text-info fw-bold fs-5 tracking-widest">{currentTenant.joinCode}</code>
            <button onClick={copyJoinCode} className="btn btn-primary btn-sm rounded-circle p-2 ms-2 shadow-primary">
              <Copy size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="row mb-4">
        <div className="col-12">
          <StatCard 
            title="Tổng số Trip" 
            value={formatCount(trips.length)} 
            icon={<MapPinned size={24} />}
            trend={
              <span style={{ color: colors.textPrimary }}>
                {`${formatCount(activeTrips)} đang diễn ra`}
              </span>
            }
            color="var(--bs-primary)" 
          />
        </div>
      </div>

      {/* 2. HÀNG DƯỚI: 4 CHỈ SỐ CÒN LẠI (XẾP NGANG DESKTOP, DỌC MOBILE) */}
      <div className="row g-4 mb-5">
        <div className="col-12 col-md-6 col-xl-3">
          <StatCard 
            title="Tổng số chặng" 
            value={formatCount(totalRounds)} 
            icon={<Route size={24} />}
            trend={
              <span style={{ color: colors.textPrimary }}>
                 {`${formatCount(completedRounds)} hoàn thành`}
              </span>
            }
            color="var(--bs-success)" 
          />
        </div>
        <div className="col-12 col-md-6 col-xl-3">
          <StatCard 
            title="Tổng số xe" 
            value={formatCount(totalBuses)} 
            icon={<Bus size={24} />}
            color="var(--bs-success)" 
          />
        </div>
        <div className="col-12 col-md-6 col-xl-3">
          <StatCard 
            title="Hành khách" 
            value={formatCount(totalPassengers)} 
            icon={<Users size={24} />}
            trend={
              <span style={{ color: colors.textPrimary }}>
                {`${formatCount(totalRounds)} round · ${formatCount(completedRounds)} hoàn thành`}
              </span>
            }
            color="var(--bs-info)" 
          />
        </div>
        <div className="col-12 col-md-6 col-xl-3">
          <StatCard 
            title="Điểm danh" 
            value={formatCount(transactions.length)} 
            icon={<TrendingUp size={24} />}
            color="var(--bs-warning)" 
          />
        </div>
      </div>

      {/* Real summaries */}
      <div className="row g-4">
        <div className="col-lg-8">
          <div className="card-glass h-100 p-4">
            <div className="d-flex align-items-center justify-content-between mb-4">
              <h5 className=" fw-bold mb-0">Phân bổ theo chuyến đi</h5>
              <span 
                className="badge rounded-pill border border-gray-800"
                style={{
                  backgroundColor: 'var(--bs-info)',
                  color: '#ffffff',
                  fontSize: '11px',
                }}>Top 5 theo số khách</span>
            </div>
            <div className="d-grid gap-3">
              {busiestTrips.length > 0 ? busiestTrips.map((trip) => (
                <div key={trip.id} className="trip-summary-row">
                  <div className="d-flex align-items-center justify-content-between gap-3 mb-2">
                    <div>
                      <div className=" fw-semibold">{trip.name}</div>
                      <div className="text-gray-500 extra-small">{trip.status === 'DONE' ? 'Hoàn thành' : 'Đang diễn ra'}</div>
                    </div>
                    <div className="text-end text-gray-500 extra-small">
                      <div>{formatCount(trip.passengerCount)} khách</div>
                      <div>{formatCount(trip.busCount)} xe · {formatCount(trip.roundCount)} round</div>
                    </div>
                  </div>
                  <div className="progress trip-progress">
                    <div
                      className="progress-bar"
                      style={{ width: `${Math.max(8, Math.round((trip.passengerCount / maxPassengerCount) * 100))}%`, backgroundColor: 'var(--bs-primary)' }}
                    />
                  </div>
                </div>
              )) : (
                <div className="d-flex align-items-center justify-content-center border border-dashed border-gray-800 rounded-4" style={{ minHeight: '240px' }}>
                  <p className="text-gray-600 m-0">Chưa có dữ liệu chuyến đi trong tổ chức này</p>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="card-glass h-100 p-4">
            <h5 className=" fw-bold mb-4">Hoạt động gần đây</h5>
            <div className="timeline">
              {recentActivities.length > 0 ? recentActivities.map((activity) => (
                <div key={activity.id} className="d-flex gap-3 mb-4">
                  <div className="timeline-dot"></div>
                  <div>
                    <p className=" small mb-0 fw-bold">{activity.title}</p>
                    <p className="text-gray-500 extra-small mb-1">{activity.detail}</p>
                    <p className="text-gray-500 extra-small mb-0">{activity.status} · {activity.time}</p>
                  </div>
                </div>
              )) : (
                <div className="d-flex align-items-center justify-content-center border border-dashed border-gray-800 rounded-4" style={{ minHeight: '240px' }}>
                  <p className="text-gray-600 m-0">Chưa có transaction nào để hiển thị</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <TenantSelector isOpen={showTenantSelector} onClose={() => setShowTenantSelector(false)} />

      <style>{`
        .text-gray-500 { color: ${colors.textMuted}; }
        .text-gray-600 { color: ${colors.textMuted}; }
        .extra-small { font-size: 11px; }
        
        .btn-glass {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: ${colors.textPrimary};
          padding: 8px 20px;
          border-radius: 12px;
          font-weight: 600;
          transition: 0.3s;
        }
        .btn-glass:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: var(--bs-primary);
        }

        .join-code-banner {
          background: linear-gradient(90deg, rgba(59, 130, 246, 0.1) 0%, rgba(15, 23, 42, 0) 100%);
          border: 1px solid rgba(59, 130, 246, 0.2);
          padding: 20px 30px;
          border-radius: 20px;
        }

        .icon-badge {
          width: 48px;
          height: 48px;
          background: rgba(59, 130, 246, 0.1);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .card-glass {
          background: ${colors.surface};
          border: 1px solid ${colors.border};
          border-radius: 24px;
        }

        .trip-summary-row {
          padding: 14px 16px;
          border: 1px solid ${colors.border};
          border-radius: 18px;
          background: ${colors.surfaceLight};
        }

        .trip-progress {
          height: 8px;
          background: ${colors.surface};
          border-radius: 999px;
          overflow: hidden;
        }

        .timeline-dot {
          width: 8px;
          height: 8px;
          background: var(--bs-primary);
          border-radius: 50%;
          margin-top: 6px;
          box-shadow: 0 0 10px var(--bs-primary);
        }
       
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .animate-fade-in {
          animation: fadeIn 0.8s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .shadow-primary {
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        }
      `}</style>
    </div>
  );
};

export default Dashboard;