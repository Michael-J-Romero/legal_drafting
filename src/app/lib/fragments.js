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

export function createInitialDocState(defaults) {
  const {
    leftHeadingFields = [],
    rightHeadingFields = [],
    plaintiffName = '',
    defendantName = '',
    courtTitle = '',
    welcomeContent = '',
    welcomeTitle = 'Untitled',
  } = defaults || {};

  return {
    docTitle: '',
    docDate: (() => {
      try {
        return new Date().toISOString().slice(0, 10);
      } catch (error) {
        return '';
      }
    })(),
    leftHeadingFields: [...leftHeadingFields],
    rightHeadingFields: [...rightHeadingFields],
    plaintiffName,
    defendantName,
    courtTitle,
    showPageNumbers: true,
    fragments: [
      {
        id: createFragmentId(),
        type: 'markdown',
        content: welcomeContent,
        title: welcomeTitle,
      },
    ],
  };
}
