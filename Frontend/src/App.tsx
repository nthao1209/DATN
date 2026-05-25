import React, { Suspense, useMemo } from 'react';
import { RouterProvider } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from './redux/store';
import { ThemeProvider } from './theme/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { AttendanceMismatchListener } from './components/AttendanceMismatchListener';
import SyncManager from './components/common/SyncManager';
import { UnsavedChangesProvider } from './components/common/UnsavedChangesContext';
import { createAppRouter } from './role/appRouter';
import { useAuthBootstrap } from './role/useAuthBootstrap';

const App: React.FC = () => {
  const { user, loading, roleId, tenants, currentTenant } = useSelector((state: RootState) => state.auth);
  const isBootstrapping = useAuthBootstrap();

  const router = useMemo(() => createAppRouter(user, roleId, tenants, currentTenant), [user, roleId, tenants, currentTenant]);

  if (isBootstrapping || (loading && !user)) {
    return (
      <div className="d-flex align-items-center justify-content-center vh-100">
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }

  return (
    <ThemeProvider>
      <NotificationProvider>
        <UnsavedChangesProvider>
          <AttendanceMismatchListener />
          <SyncManager />
          <Suspense
            fallback={
              <div className="d-flex align-items-center justify-content-center vh-100">
                <div className="spinner-border text-primary" role="status" />
              </div>
            }
          >
            <RouterProvider router={router} />
          </Suspense>
        </UnsavedChangesProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
};

export default App;
