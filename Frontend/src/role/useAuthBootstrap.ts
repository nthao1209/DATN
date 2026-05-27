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

      console.debug('[useAuthBootstrap] auth state changed', {
        syncSeq,
        hasFirebaseUser: Boolean(firebaseUser),
        uid: firebaseUser?.uid,
        email: firebaseUser?.email,
        emailVerified: firebaseUser?.emailVerified,
      });

      try {
        if (!firebaseUser) {
          console.debug('[useAuthBootstrap] no firebase user; clearing session if needed');
          if (hadAuthenticatedSessionRef.current) {
            clearSessionState();
          }
          hadAuthenticatedSessionRef.current = false;
          return;
        }

        if (!firebaseUser.emailVerified) {
          console.warn('[useAuthBootstrap] firebase user not verified; signing out', {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
          });
          hadAuthenticatedSessionRef.current = false;
          await signOutAndClear();
          return;
        }

        const token = await firebaseUser.getIdToken(true);

        console.debug('[useAuthBootstrap] firebase token acquired', {
          syncSeq,
          uid: firebaseUser.uid,
          tokenProvided: Boolean(token),
          tokenLength: token?.length || 0,
        });

        if (syncSeq !== authSyncSeqRef.current || fbAuth.currentUser?.uid !== firebaseUser.uid) {
          console.debug('[useAuthBootstrap] stale auth callback skipped', {
            syncSeq,
            currentSeq: authSyncSeqRef.current,
            currentUid: fbAuth.currentUser?.uid,
            callbackUid: firebaseUser.uid,
          });
          return;
        }

        console.debug('[useAuthBootstrap] calling auth status endpoint');
        const response = await api.getMyStatus(token, { silentOn401: true });

        console.debug('[useAuthBootstrap] auth status response', {
          syncSeq,
          hasResponse: Boolean(response),
        });

        if (syncSeq !== authSyncSeqRef.current || fbAuth.currentUser?.uid !== firebaseUser.uid) {
          console.debug('[useAuthBootstrap] stale auth status response skipped', {
            syncSeq,
            currentSeq: authSyncSeqRef.current,
            currentUid: fbAuth.currentUser?.uid,
            callbackUid: firebaseUser.uid,
          });
          return;
        }

        if (!response) {
          console.warn('[useAuthBootstrap] auth status returned null/401; signing out');
          hadAuthenticatedSessionRef.current = false;
          await signOutAndClear();
          return;
        }

        const status = (response as any)?.data ?? response;

        if (status?.user?.isDisabled) {
          console.warn('[useAuthBootstrap] account disabled');
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

        console.error('[useAuthBootstrap] bootstrap failed', error);

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
