import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useBeforeUnload, useBlocker } from 'react-router-dom';
import { enqueueSnackbar } from 'notistack';

type UnsavedChangesState = {
  isDirty: boolean;
  message: string;
};

type UnsavedChangesContextValue = {
  state: UnsavedChangesState;
  setUnsavedChanges: (state: UnsavedChangesState) => void;
  clearUnsavedChanges: () => void;
};

const UnsavedChangesContext = createContext<UnsavedChangesContextValue | undefined>(undefined);

export const UnsavedChangesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<UnsavedChangesState>({ isDirty: false, message: '' });

  const setUnsavedChanges = useCallback((nextState: UnsavedChangesState) => {
    setState((previousState) => {
      if (
        previousState.isDirty === nextState.isDirty &&
        previousState.message === nextState.message
      ) {
        return previousState;
      }

      return nextState;
    });
  }, []);

  const clearUnsavedChanges = useCallback(() => {
    setState((previousState) => {
      if (!previousState.isDirty && previousState.message === '') {
        return previousState;
      }

      return { isDirty: false, message: '' };
    });
  }, []);

  const value = useMemo<UnsavedChangesContextValue>(
    () => ({
      state,
      setUnsavedChanges,
      clearUnsavedChanges,
    }),
    [clearUnsavedChanges, setUnsavedChanges, state]
  );

  return <UnsavedChangesContext.Provider value={value}>{children}</UnsavedChangesContext.Provider>;
};

export const useUnsavedChanges = () => {
  const context = useContext(UnsavedChangesContext);

  if (!context) {
    throw new Error('useUnsavedChanges must be used within UnsavedChangesProvider');
  }

  return context;
};

export const useRegisterUnsavedChanges = (
  isDirty: boolean,
  message = 'Bạn có thay đổi chưa lưu. Hãy lưu trước khi rời trang.'
) => {
  const { setUnsavedChanges, clearUnsavedChanges } = useUnsavedChanges();

  useEffect(() => {
    if (isDirty) {
      setUnsavedChanges({ isDirty: true, message });
      return;
    }

    clearUnsavedChanges();
  }, [clearUnsavedChanges, isDirty, message, setUnsavedChanges]);
};

export const UnsavedChangesGuard: React.FC = () => {
  const { state, clearUnsavedChanges } = useUnsavedChanges();

  useBeforeUnload(
    useCallback((event) => {
      if (!state.isDirty) {
        return;
      }

      event.preventDefault();
      event.returnValue = '';
    }, [state.isDirty]),
    { capture: true }
  );

  const blocker = useBlocker(state.isDirty);

  useEffect(() => {
    if (blocker.state !== 'blocked') {
      return;
    }

    enqueueSnackbar(state.message || 'Bạn có thay đổi chưa lưu. Hãy lưu trước khi rời trang.', { variant: 'warning' });
    blocker.reset();
  }, [blocker, state.message]);

  useEffect(() => () => clearUnsavedChanges(), [clearUnsavedChanges]);

  return null;
};