let fragmentCounter = 0;

export function createFragmentId() {
  fragmentCounter += 1;
  return `fragment-${fragmentCounter}`;
}

export function syncFragmentCounterFromList(fragments) {
  let maxSeen = fragmentCounter;
  for (const fragment of fragments || []) {
    if (!fragment || typeof fragment.id !== 'string') continue;
    const match = fragment.id.match(/fragment-(\d+)/);
    if (match) {
      const value = parseInt(match[1], 10);
      if (Number.isFinite(value)) {
        maxSeen = Math.max(maxSeen, value);
      }
    }
  }
  fragmentCounter = maxSeen;
}

export function createEmptyMarkdownFragment({ title = 'Untitled', content = '' } = {}) {
  return {
    id: createFragmentId(),
    type: 'markdown',
    title,
    content,
  };
}

export function createExhibitsFragment(id = createFragmentId()) {
  return {
    id,
    type: 'exhibits',
    exhibits: [],
  };
}
