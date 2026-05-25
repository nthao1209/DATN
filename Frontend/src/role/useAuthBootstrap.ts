import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { onAuthStateChanged } from 'firebase/auth';
import { auth as fbAuth } from '../config/firebase';
import { api } from '../services/api';
import { authSuccess, logout, resetAuthState } from '../redux/slice/authSlice';
import { SETUP_ORG_COMPLETE_KEY } from './constants';

export const useAuthBootstrap = () => {
  const dispatch = useDispatch();
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const authSyncSeqRef = useRef(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(fbAuth, async (firebaseUser) => {
      const syncSeq = ++authSyncSeqRef.current;
      setIsBootstrapping(true);

      try {
        if (!firebaseUser) {
          sessionStorage.removeItem(SETUP_ORG_COMPLETE_KEY);
          dispatch(logout());
          return;
        }

        if (!firebaseUser.emailVerified) {
          sessionStorage.removeItem(SETUP_ORG_COMPLETE_KEY);
          dispatch(logout());
          return;
        }

        dispatch(resetAuthState());

        const token = await firebaseUser.getIdToken(true);

        if (syncSeq !== authSyncSeqRef.current || fbAuth.currentUser?.uid !== firebaseUser.uid) {
          return;
        }

        const response = await api.getMyStatus(token, { silentOn401: true });

        if (syncSeq !== authSyncSeqRef.current || fbAuth.currentUser?.uid !== firebaseUser.uid) {
          return;
        }

        if (!response) {
          sessionStorage.removeItem(SETUP_ORG_COMPLETE_KEY);
          dispatch(logout());
          return;
        }

        const status = (response as any)?.data ?? response;

        dispatch(
          authSuccess({
            user: status.user,
            token,
            tenants: status.tenants || [],
            roleId: status.roleId,
          })
        );
      } catch (error) {
        sessionStorage.removeItem(SETUP_ORG_COMPLETE_KEY);
        dispatch(logout());
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
