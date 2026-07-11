import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useOperationNotice } from '../../../../src/ui/editor/state/use-operation-notice';

describe('useOperationNotice', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('clears transient notices after the standard timeout', () => {
    const { result } = renderHook(() => useOperationNotice());

    act(() => {
      result.current.showOperationNotice({ message: 'Saved', tone: 'success' });
    });

    expect(result.current.operationNotice).toMatchObject({ message: 'Saved' });

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.operationNotice).toBeUndefined();
  });

  it('keeps persistent notices until replaced or cleared', () => {
    const { result } = renderHook(() => useOperationNotice());

    act(() => {
      result.current.showOperationNotice(
        { message: 'Exporting', tone: 'info' },
        { persistent: true },
      );
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.operationNotice).toMatchObject({ message: 'Exporting' });

    act(() => {
      result.current.showOperationNotice(undefined);
    });

    expect(result.current.operationNotice).toBeUndefined();
  });

  it('resets the timeout when a newer transient notice replaces an older one', () => {
    const { result } = renderHook(() => useOperationNotice());

    act(() => {
      result.current.showOperationNotice({ message: 'First', tone: 'info' });
      vi.advanceTimersByTime(1500);
      result.current.showOperationNotice({ message: 'Second', tone: 'warning' });
      vi.advanceTimersByTime(1500);
    });

    expect(result.current.operationNotice).toMatchObject({ message: 'Second' });

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(result.current.operationNotice).toBeUndefined();
  });

  it('clears pending timers on unmount', () => {
    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
    const { result, unmount } = renderHook(() => useOperationNotice());

    act(() => {
      result.current.showOperationNotice({ message: 'Pending', tone: 'info' });
    });
    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});
