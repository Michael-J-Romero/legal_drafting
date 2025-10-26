'use client';

import { useCallback, useRef, useState } from 'react';

function ensureArray(value) {
  return Array.isArray(value) ? value.slice() : [];
}

function trimPast(past, maxSize) {
  if (!Number.isFinite(maxSize) || maxSize <= 0) return past;
  if (past.length <= maxSize) return past;
  return past.slice(past.length - maxSize);
}

export function useUndoStack(initialPresent, options = {}) {
  const { maxSize = Infinity } = options;
  const initialValue = typeof initialPresent === 'function' ? initialPresent() : initialPresent;
  const initialRef = useRef(initialValue);
  const [history, setHistory] = useState(() => ({
    past: [],
    present: initialValue,
    future: [],
  }));

  const set = useCallback((value, config = {}) => {
    const { record = true, clearFuture = true } = config;
    setHistory((current) => {
      const nextPresent = typeof value === 'function' ? value(current.present) : value;
      if (!record) {
        if (nextPresent === current.present && (!clearFuture || current.future.length === 0)) {
          return current;
        }
        return {
          past: current.past,
          present: nextPresent,
          future: clearFuture ? [] : current.future,
        };
      }
      const nextPast = trimPast([...current.past, current.present], maxSize);
      return {
        past: nextPast,
        present: nextPresent,
        future: clearFuture ? [] : current.future,
      };
    });
  }, [maxSize]);

  const commit = useCallback(() => {
    setHistory((current) => {
      const nextPast = trimPast([...current.past, current.present], maxSize);
      if (nextPast.length === current.past.length) {
        if (nextPast.length === 0 || nextPast[nextPast.length - 1] === current.present) {
          if (current.future.length === 0) return current;
          return { past: current.past, present: current.present, future: [] };
        }
      }
      return {
        past: nextPast,
        present: current.present,
        future: [],
      };
    });
  }, [maxSize]);

  const undo = useCallback(() => {
    setHistory((current) => {
      if (!current.past.length) return current;
      const previous = current.past[current.past.length - 1];
      const restPast = current.past.slice(0, -1);
      return {
        past: restPast,
        present: previous,
        future: [current.present, ...current.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((current) => {
      if (!current.future.length) return current;
      const [nextPresent, ...restFuture] = current.future;
      return {
        past: [...current.past, current.present],
        present: nextPresent,
        future: restFuture,
      };
    });
  }, []);

  const clear = useCallback(() => {
    setHistory((current) => {
      if (!current.past.length && !current.future.length) return current;
      return { past: [], present: current.present, future: [] };
    });
  }, []);

  const reset = useCallback((value) => {
    const resolved = value === undefined
      ? initialRef.current
      : (typeof value === 'function' ? value(initialRef.current) : value);
    initialRef.current = resolved;
    setHistory({ past: [], present: resolved, future: [] });
  }, []);

  const load = useCallback((nextHistory) => {
    if (!nextHistory || typeof nextHistory !== 'object') return;
    const nextPast = ensureArray(nextHistory.past);
    const nextFuture = ensureArray(nextHistory.future);
    const nextPresent = nextHistory.present ?? initialRef.current;
    initialRef.current = nextPresent;
    setHistory({ past: nextPast, present: nextPresent, future: nextFuture });
  }, []);

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  return [
    history,
    {
      set,
      undo,
      redo,
      clear,
      reset,
      commit,
      load,
      canUndo,
      canRedo,
    },
  ];
}
