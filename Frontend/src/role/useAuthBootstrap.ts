import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import { onAuthStateChanged } from 'firebase/auth';
import { auth as fbAuth, signOut } from '../config/firebase';
import { api } from '../services/api';
import { authSuccess, logout, resetAuthState } from '../redux/slice/authSlice';
import { SETUP_ORG_COMPLETE_KEY } from './constants';

export const useAuthBootstrap = () => {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const authSyncSeqRef = useRef(0);
  const hadAuthenticatedSessionRef = useRef(false);

  const clearSessionState = () => {
    queryClient.clear();
    sessionStorage.removeItem(SETUP_ORG_COMPLETE_KEY);
    dispatch(logout());
  };

  const signOutAndClear = async () => {
    try {
      await signOut(fbAuth);
    } finally {
      clearSessionState();
    }
  };

  const isOfflineError = (error: any) => {
    return !error?.status || error?.code === 'ECONNABORTED' || /Không thể kết nối server|Network Error|timeout/i.test(String(error?.message || ''));
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(fbAuth, async (firebaseUser) => {
      const syncSeq = ++authSyncSeqRef.current;
      setIsBootstrapping(true);

      try {
        if (!firebaseUser) {
          if (hadAuthenticatedSessionRef.current) {
            clearSessionState();
          }
          hadAuthenticatedSessionRef.current = false;
          return;
        }

        if (!firebaseUser.emailVerified) {
          hadAuthenticatedSessionRef.current = false;
          await signOutAndClear();
          return;
        }

        const token = await firebaseUser.getIdToken(true);

        if (syncSeq !== authSyncSeqRef.current || fbAuth.currentUser?.uid !== firebaseUser.uid) {
          return;
        }

        const response = await api.getMyStatus(token, { silentOn401: true });

        if (syncSeq !== authSyncSeqRef.current || fbAuth.currentUser?.uid !== firebaseUser.uid) {
          return;
        }

        if (!response) {
          hadAuthenticatedSessionRef.current = false;
          await signOutAndClear();
          return;
        }

        const status = (response as any)?.data ?? response;

        if (status?.user?.isDisabled) {
          hadAuthenticatedSessionRef.current = false;
          await signOutAndClear();
          try {
            window.location.replace('/account-disabled');
          } catch (e) {
            // ignore
          }
          return;
        }

        hadAuthenticatedSessionRef.current = true;

        dispatch(resetAuthState());
        dispatch(
          authSuccess({
            user: status.user,
            token,
            tenants: status.tenants || [],
            roleId: status.roleId,
          })
        );
      } catch (error: any) {
        if (syncSeq !== authSyncSeqRef.current) {
          return;
        }

        if (error?.status === 401 || error?.status === 403) {
          hadAuthenticatedSessionRef.current = false;
          await signOutAndClear();
          if (error?.status === 403 && error?.code === 'ACCOUNT_DISABLED') {
            try {
              window.location.replace('/account-disabled');
            } catch (e) {
              // ignore
            }
          }
          return;
        }

        if (isOfflineError(error)) {
          // Keep the current UI/cache intact when the backend is temporarily unavailable.
          return;
        }

        hadAuthenticatedSessionRef.current = false;
        await signOutAndClear();
      } finally {
        if (syncSeq === authSyncSeqRef.current) {
          setIsBootstrapping(false);
        }
      }
    });

    return () => unsubscribe();
  }, [dispatch]);

  return isBootstrapping;
};
