import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { type RootState } from '../../redux/store';
import { 
  TrendingUp, Users, MapPinned, Route, Bus,
  Copy, RefreshCw, LayoutDashboard, Calendar
} from 'lucide-react';
import StatCard from '../../components/StatCard';
import TenantSelector from '../../components/TenantSelector';
import { useTheme } from '../../theme/ThemeContext';
import { useSnackbar } from 'notistack';
import api from '../../services/api';
import { subscribeMqttTopics } from '../../services/mqtt';
import { canViewJoinCode } from '../../auth/rbac';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, AreaChart, Area,Cell, PieChart, Pie 
} from 'recharts';

const formatCount = (value: number) => new Intl.NumberFormat('vi-VN').format(value);

const Dashboard: React.FC = () => {
  const { colors } = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const [showTenantSelector, setShowTenantSelector] = useState(false);
  const realtimeRefreshTimerRef = useRef<number | null>(null);
  const { currentTenant, roleId } = useSelector((state: RootState) => state.auth);
  const canSeeJoinCode = canViewJoinCode(roleId);
  const tenantKey = currentTenant?.id ? String(currentTenant.id) : 'no-tenant';
  const tenantDashboardTopic = currentTenant?.id ? `dashboard/tenant/${currentTenant.id}` : null;

  const { data: trips = [], isLoading: tripsLoading, refetch: refetchTrips } = useQuery<any[]>({
    queryKey: ['dashboard-trips', tenantKey],
    queryFn: api.getTrips,
  });

  const tripIds = useMemo(
    () => trips.map((trip: any) => Number(trip.id)).filter((id: number) => Number.isFinite(id) && id > 0),
    [trips]
  );

  const { data: buses = [], isLoading: busesLoading, refetch: refetchBuses } = useQuery<any[]>({
    queryKey: ['dashboard-buses', tenantKey, tripIds.join(',')],
    enabled: tripIds.length > 0,
    queryFn: async () => {
      const busesByTrip = await Promise.all(tripIds.map((tripId) => api.getBuses(String(tripId))));
      return busesByTrip.flat();
    },
  });

  const { data: rounds = [], isLoading: roundsLoading, refetch: refetchRounds } = useQuery<any[]>({
    queryKey: ['dashboard-rounds', tenantKey, tripIds.join(',')],
    enabled: tripIds.length > 0,
    queryFn: async () => {
      const roundsByTrip = await Promise.all(tripIds.map((tripId) => api.getRounds(String(tripId))));
      return roundsByTrip.flat();
    },
  });

  const { data: passengers = [], isLoading: passengersLoading, refetch: refetchPassengers } = useQuery<any[]>({
    queryKey: ['dashboard-passengers', tenantKey, tripIds.join(',')],
    enabled: tripIds.length > 0,
    queryFn: async () => {
      const passengersByTrip = await Promise.all(tripIds.map((tripId) => api.getPassengers(String(tripId))));
      return passengersByTrip.flat();
    },
  });

  const { data: transactions = [], isLoading: transactionsLoading, refetch: refetchTransactions } = useQuery<any[]>({
    queryKey: ['dashboard-transactions', tenantKey],
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
  void doneTrips; 
  const totalBuses = buses.length;
  const totalRounds = rounds.length;
  const totalPassengers = passengers.length;
  const completedRounds = rounds.filter((round: any) => String(round.status || '').toUpperCase() === 'DONE').length;
  
  const refetchDashboardData = async () => {
    await Promise.all([
      refetchTrips(),
      refetchBuses(),
      refetchRounds(),
      refetchPassengers(),
      refetchTransactions(),
    ]);
  };

  const handleRefresh = async () => {
    await refetchDashboardData();
    enqueueSnackbar('Đã tải lại dữ liệu thật', { variant: 'success' });
  };

  useEffect(() => {
    if (!tenantDashboardTopic) return;

    const subscription = subscribeMqttTopics([tenantDashboardTopic], () => {
      // Debounce nhẹ để gộp nhiều event realtime đến gần nhau.
      if (realtimeRefreshTimerRef.current !== null) return;

      realtimeRefreshTimerRef.current = window.setTimeout(async () => {
        realtimeRefreshTimerRef.current = null;
        await refetchDashboardData();
      }, 500);
    });

    return () => {
      if (realtimeRefreshTimerRef.current !== null) {
        window.clearTimeout(realtimeRefreshTimerRef.current);
        realtimeRefreshTimerRef.current = null;
      }

      subscription.end(true);
    };
  }, [
    tenantDashboardTopic,
    refetchTrips,
    refetchBuses,
    refetchRounds,
    refetchPassengers,
    refetchTransactions,
  ]);

  const isLoading = tripsLoading || busesLoading || roundsLoading || passengersLoading || transactionsLoading;

  const copyJoinCode = () => {
    if (currentTenant?.joinCode) {
      navigator.clipboard.writeText(currentTenant.joinCode);
      enqueueSnackbar('Đã sao chép mã mời!', { variant: 'success' });
    }
  };
  const attendanceTrendData = useMemo(() => {
    const last7Days = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    }).reverse();

    const getTxTimestamp = (tx: any) => {
      const events = tx.events as any[] | undefined;
      if (events && events.length > 0) {
        const last = events[events.length - 1];
        if (last?.createdAt) return new Date(last.createdAt);
      }
      if (tx.lastActionAt) return new Date(tx.lastActionAt);
      if (tx.updatedAt) return new Date(tx.updatedAt);
      if (tx.createdAt) return new Date(tx.createdAt);
      return null;
    };

    return last7Days.map(date => {
      const count = transactions.filter(tx => {
        const ts = getTxTimestamp(tx);
        if (!ts) return false;
        return ts.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) === date;
      }).length;
      return { name: date, lượt: count };
    });
  }, [transactions]);

  // 3. Dữ liệu cho biểu đồ tròn (Trạng thái chuyến đi)
  const tripStatusData = [
    { name: 'Đang chạy', value: activeTrips, color: 'var(--bs-primary)' },
    { name: 'Hoàn thành', value: doneTrips, color: 'var(--bs-success)' },
  ];

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
      {canSeeJoinCode && currentTenant?.joinCode && (
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

      <div className="row g-4 mb-4">
        {/* BIỂU ĐỒ ĐƯỜNG - XU HƯỚNG ĐIỂM DANH */}
        <div className="col-lg-8">
          <div className="card-glass p-4" style={{ minHeight: '400px' }}>
            <h5 className="fw-bold mb-4">Xu hướng điểm danh (7 ngày qua)</h5>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <AreaChart data={attendanceTrendData}>
                  <defs>
                    <linearGradient id="colorLượt" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--bs-primary)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--bs-primary)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={colors.border} vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: colors.textMuted, fontSize: 12}}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: colors.textMuted, fontSize: 12}}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: colors.surface, 
                      borderRadius: '12px', 
                      border: `1px solid ${colors.border}`,
                      color: colors.textPrimary 
                    }} 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="lượt" 
                    stroke="var(--bs-primary)" 
                    fillOpacity={1} 
                    fill="url(#colorLượt)" 
                    strokeWidth={3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* BIỂU ĐỒ TRÒN - TÌNH TRẠNG CHUYẾN ĐI */}
        <div className="col-lg-4">
          <div className="card-glass p-4 h-100">
            <h5 className="fw-bold mb-4">Trạng thái chuyến đi</h5>
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={tripStatusData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {tripStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3">
              {tripStatusData.map((item, idx) => (
                <div key={idx} className="d-flex align-items-center justify-content-between mb-2">
                  <div className="d-flex align-items-center gap-2">
                    <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: item.color }}></div>
                    <span className="small text-gray-500">{item.name}</span>
                  </div>
                  <span className="fw-bold">{item.value}</span>
                </div>
              ))}
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