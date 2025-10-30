import {
  DEFAULT_LEFT_HEADING_FIELDS,
  DEFAULT_RIGHT_HEADING_FIELDS,
  DEFAULT_PLAINTIFF_NAME,
  DEFAULT_DEFENDANT_NAME,
  DEFAULT_COURT_TITLE,
  DEFAULT_WELCOME_TITLE,
  DEFAULT_WELCOME_CONTENT,
} from '../defaults';
import { createFragmentId } from './fragments';

export function createInitialDocState() {
  return {
    docTitle: '',
    docDate: (() => {
      try {
        return new Date().toISOString().slice(0, 10);
      } catch (error) {
        return '';
      }
    })(),
    leftHeadingFields: [...DEFAULT_LEFT_HEADING_FIELDS],
    rightHeadingFields: [...DEFAULT_RIGHT_HEADING_FIELDS],
    plaintiffName: DEFAULT_PLAINTIFF_NAME,
    defendantName: DEFAULT_DEFENDANT_NAME,
    courtTitle: DEFAULT_COURT_TITLE,
    showPageNumbers: true,
    fragments: [
      {
        id: createFragmentId(),
        type: 'markdown',
        content: DEFAULT_WELCOME_CONTENT,
        title: DEFAULT_WELCOME_TITLE,
      },
    ],
  };
}
