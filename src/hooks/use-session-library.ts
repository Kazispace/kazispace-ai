'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  fetchGlobalLibraryFiles,
  fetchSessionFiles,
  searchLibrary,
  searchSessionMessages,
} from '@/lib/session-library-api';
import type {
  SessionLibraryFile,
  SessionLibrarySearchHit,
  SessionMessageSearchHit,
} from '@/types/session-library';

export function useGlobalLibraryFiles(enabled = true) {
  const [files, setFiles] = useState<SessionLibraryFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setFiles([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    const res = await fetchGlobalLibraryFiles();
    if (res.success && res.data) {
      setFiles(res.data.files);
    } else {
      setError(res.error ?? 'Failed to load files');
      setFiles([]);
    }
    setIsLoading(false);
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { files, isLoading, error, refresh };
}

export function useSessionFiles(
  sessionId: string | null,
  agentId?: string | null,
  enabled = true
) {
  const [files, setFiles] = useState<SessionLibraryFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled || !sessionId) {
      setFiles([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    const res = await fetchSessionFiles(sessionId, agentId);
    if (res.success && res.data) {
      setFiles(res.data.files);
    } else {
      setError(res.error ?? 'Failed to load session files');
      setFiles([]);
    }
    setIsLoading(false);
  }, [agentId, enabled, sessionId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { files, isLoading, error, refresh };
}

export function useGlobalLibrarySearch(query: string, enabled = true) {
  const [hits, setHits] = useState<SessionLibrarySearchHit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setHits([]);
      return;
    }

    const trimmed = query.trim();
    if (!trimmed) {
      setHits([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const timer = window.setTimeout(() => {
      void searchLibrary(trimmed).then((res) => {
        if (cancelled) return;
        if (res.success && res.data) {
          setHits(res.data.hits);
        } else {
          setHits([]);
          setError(res.error ?? 'Search failed');
        }
        setIsLoading(false);
      });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [enabled, query]);

  return { hits, isLoading, error };
}

export function useSessionMessageSearch(
  sessionId: string | null,
  query: string,
  enabled = true
) {
  const [hits, setHits] = useState<SessionMessageSearchHit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !sessionId) {
      setHits([]);
      setError(null);
      return;
    }

    const trimmed = query.trim();
    if (!trimmed) {
      setHits([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const timer = window.setTimeout(() => {
      void searchSessionMessages(sessionId, trimmed).then((result) => {
        if (cancelled) return;
        setHits(result.hits);
        setError(result.error ?? null);
        setIsLoading(false);
      });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [enabled, query, sessionId]);

  return { hits, isLoading, error };
}
