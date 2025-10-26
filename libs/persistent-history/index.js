import { useCallback, useEffect, useRef, useState } from 'react';

function createHistory(present) {
  return { past: [], present, future: [] };
}

function sanitizeHistoryObject(history, fallbackPresent) {
  if (!history || typeof history !== 'object') {
    return createHistory(fallbackPresent);
  }
  const past = Array.isArray(history.past) ? history.past : [];
  const future = Array.isArray(history.future) ? history.future : [];
  const present = history.present ?? fallbackPresent;
  return { past, present, future };
}

export function usePersistentHistory(initialPresent, options = {}) {
  const {
    storageKey,
    throttleMs = 0,
    serialize = (value) => value,
    deserialize = (value) => (typeof value === 'string' ? JSON.parse(value) : value),
  } = options;

  const initialPresentRef = useRef(initialPresent);
  const [history, setHistory] = useState(() => createHistory(initialPresentRef.current));
  const [hydrated, setHydrated] = useState(() => (typeof window === 'undefined' || !storageKey));
  const lastMarkRef = useRef(0);

  const persist = useCallback((nextHistory) => {
    if (!storageKey || typeof window === 'undefined') return;
    try {
      const serialized = serialize(nextHistory);
      const payload = typeof serialized === 'string' ? serialized : JSON.stringify(serialized);
      window.localStorage.setItem(storageKey, payload);
    } catch (error) {
      // ignore persistence errors
    }
  }, [serialize, storageKey]);

  const replaceHistory = useCallback((nextHistory) => {
    setHistory(() => {
      const sanitized = sanitizeHistoryObject(nextHistory, initialPresentRef.current);
      persist(sanitized);
      return sanitized;
    });
  }, [persist]);

  const updatePresent = useCallback((updater, options = {}) => {
    setHistory((current) => {
      const base = current.present;
      const nextPresent = typeof updater === 'function' ? updater(base) : updater;
      if (options.skipIfSame && Object.is(base, nextPresent)) {
        return current;
      }
      const nextHistory = {
        past: current.past,
        present: nextPresent,
        future: options.preserveFuture ? current.future : [],
      };
      persist(nextHistory);
      return nextHistory;
    });
  }, [persist]);

  const mark = useCallback(() => {
    setHistory((current) => {
      const nextHistory = {
        past: [...current.past, current.present],
        present: current.present,
        future: [],
      };
      persist(nextHistory);
      return nextHistory;
    });
    lastMarkRef.current = Date.now();
  }, [persist]);

  const maybeMark = useCallback(() => {
    if (!throttleMs) {
      mark();
      return;
    }
    const now = Date.now();
    if (now - lastMarkRef.current >= throttleMs) {
      mark();
    }
  }, [mark, throttleMs]);

  const undo = useCallback(() => {
    setHistory((current) => {
      if (!current.past.length) return current;
      const previous = current.past[current.past.length - 1];
      const nextPast = current.past.slice(0, -1);
      const nextHistory = {
        past: nextPast,
        present: previous,
        future: [current.present, ...current.future],
      };
      persist(nextHistory);
      return nextHistory;
    });
  }, [persist]);

  const redo = useCallback(() => {
    setHistory((current) => {
      if (!current.future.length) return current;
      const nextPresent = current.future[0];
      const nextFuture = current.future.slice(1);
      const nextHistory = {
        past: [...current.past, current.present],
        present: nextPresent,
        future: nextFuture,
      };
      persist(nextHistory);
      return nextHistory;
    });
  }, [persist]);

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') {
      setHydrated(true);
      return;
    }
    let active = true;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = deserialize(raw);
        const sanitized = sanitizeHistoryObject(parsed, initialPresentRef.current);
        if (active) {
          setHistory(sanitized);
        }
      }
    } catch (error) {
      // ignore hydration errors
    } finally {
      if (active) {
        setHydrated(true);
      }
    }
    return () => {
      active = false;
    };
  }, [deserialize, storageKey]);

  return {
    history,
    present: history.present,
    past: history.past,
    future: history.future,
    updatePresent,
    mark,
    maybeMark,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    replaceHistory,
    hydrated,
  };
}
