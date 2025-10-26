'use client';

let fallbackCounter = 0;

export function createFragmentId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `fragment-${crypto.randomUUID()}`;
  }
  fallbackCounter += 1;
  return `fragment-${fallbackCounter}`;
}
