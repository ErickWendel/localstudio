import { useEffect, useRef, useState } from 'react';

const OPERATION_NOTICE_CLEAR_MS = 3000;

export type OperationNoticeTone = 'error' | 'info' | 'success' | 'warning';

export interface OperationNoticeState {
  detail?: string | undefined;
  message: string;
  progress?: { current: number; total: number } | undefined;
  tone: OperationNoticeTone;
}

export function useOperationNotice() {
  const [operationNotice, setOperationNotice] = useState<OperationNoticeState | undefined>();
  const operationNoticeTimeoutRef = useRef<number | undefined>(undefined);

  function clearOperationNoticeTimer() {
    if (operationNoticeTimeoutRef.current === undefined) return;
    window.clearTimeout(operationNoticeTimeoutRef.current);
    operationNoticeTimeoutRef.current = undefined;
  }

  function showOperationNotice(
    notice: OperationNoticeState | undefined,
    options?: { persistent?: boolean },
  ) {
    clearOperationNoticeTimer();
    setOperationNotice(notice);
    if (!notice || options?.persistent) return;
    operationNoticeTimeoutRef.current = window.setTimeout(() => {
      setOperationNotice(undefined);
      operationNoticeTimeoutRef.current = undefined;
    }, OPERATION_NOTICE_CLEAR_MS);
  }

  useEffect(() => {
    return () => {
      clearOperationNoticeTimer();
    };
  }, []);

  return {
    operationNotice,
    showOperationNotice,
  };
}
