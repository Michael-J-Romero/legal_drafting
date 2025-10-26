'use client';

import { useCallback, useReducer, useRef } from 'react';

const DEFAULT_OPTIONS = {
  maxSize: 200,
  equality: Object.is,
};

const ActionTypes = {
  SET: 'SET',
  UNDO: 'UNDO',
  REDO: 'REDO',
  RESET: 'RESET',
};

function clampHistory(past, maxSize) {
  if (typeof maxSize !== 'number' || maxSize <= 0) return past;
  if (past.length <= maxSize) return past;
  return past.slice(past.length - maxSize);
}

function historyReducer(state, action, options) {
  switch (action.type) {
    case ActionTypes.SET: {
      const updater = action.updater;
      const newPresent = typeof updater === 'function' ? updater(state.present) : updater;
      if (action.record === false) {
        return {
          past: state.past,
          present: newPresent,
          future: action.keepFuture ? state.future : [],
        };
      }
      if (options.equality(state.present, newPresent)) {
        return state;
      }
      const nextPast = clampHistory([...state.past, state.present], options.maxSize);
      return {
        past: nextPast,
        present: newPresent,
        future: [],
      };
    }
    case ActionTypes.UNDO: {
      if (!state.past.length) return state;
      const previous = state.past[state.past.length - 1];
      const rest = state.past.slice(0, -1);
      return {
        past: rest,
        present: previous,
        future: [state.present, ...state.future],
      };
    }
    case ActionTypes.REDO: {
      if (!state.future.length) return state;
      const [next, ...rest] = state.future;
      return {
        past: [...state.past, state.present],
        present: next,
        future: rest,
      };
    }
    case ActionTypes.RESET: {
      return {
        past: [],
        present: action.value,
        future: [],
      };
    }
    default:
      return state;
  }
}

export function useUndo(initialPresent, incomingOptions = {}) {
  const optionsRef = useRef({ ...DEFAULT_OPTIONS, ...incomingOptions });
  optionsRef.current = { ...DEFAULT_OPTIONS, ...incomingOptions };

  const [state, dispatch] = useReducer(
    (currentState, action) => historyReducer(currentState, action, optionsRef.current),
    undefined,
    () => ({
      past: [],
      present: typeof initialPresent === 'function' ? initialPresent() : initialPresent,
      future: [],
    }),
  );

  const set = useCallback(
    (updater, opts = {}) => {
      dispatch({
        type: ActionTypes.SET,
        updater,
        record: opts.record !== false,
        keepFuture: opts.keepFuture === true,
      });
    },
    [],
  );

  const undo = useCallback(() => {
    dispatch({ type: ActionTypes.UNDO });
  }, []);

  const redo = useCallback(() => {
    dispatch({ type: ActionTypes.REDO });
  }, []);

  const reset = useCallback((value) => {
    dispatch({ type: ActionTypes.RESET, value });
  }, []);

  return [
    state,
    {
      set,
      undo,
      redo,
      reset,
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
    },
  ];
}

export default useUndo;
