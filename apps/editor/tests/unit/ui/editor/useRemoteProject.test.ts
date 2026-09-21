import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRemoteProject } from '../../../../src/ui/editor/hooks/useRemoteProject';
import type { ProjectDocument } from '../../../../src/domain/documents/model';

describe('useRemoteProject', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns non-loading empty state when src is null', () => {
    const { result } = renderHook(() => useRemoteProject(null));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.project).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('fetches remote project when payload has project wrapper', async () => {
    const mockProject = {
      id: 'proj-1',
      name: 'Loaded Remote Project',
      pages: [],
      elements: {},
      assets: {},
    } as unknown as ProjectDocument;

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ project: mockProject }),
    });

    const { result } = renderHook(() => useRemoteProject('https://example.com/deck.json'));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.project).toEqual(mockProject);
    expect(result.current.error).toBeNull();
  });

  it('fetches remote project when payload is direct ProjectDocument', async () => {
    const mockProject = {
      id: 'proj-2',
      name: 'Direct Project',
      pages: [],
      elements: {},
      assets: {},
    } as unknown as ProjectDocument;

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockProject),
    });

    const { result } = renderHook(() => useRemoteProject('/decks/my-deck.json'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.project).toEqual(mockProject);
  });

  it('handles HTTP errors gracefully and sets error state', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    const { result } = renderHook(() => useRemoteProject('/decks/not-found.json'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.project).toBeNull();
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toContain('HTTP 404');
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('aborts fetch on cleanup and avoids updating state after abort', () => {
    let abortSignal: AbortSignal | null | undefined;

    globalThis.fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      abortSignal = init?.signal;
      return new Promise(() => {
        // never resolves to simulate pending network request
      });
    });

    const { unmount } = renderHook(() => useRemoteProject('/decks/pending.json'));

    expect(abortSignal).toBeDefined();
    expect(abortSignal?.aborted).toBe(false);

    unmount();

    expect(abortSignal?.aborted).toBe(true);
  });
});
