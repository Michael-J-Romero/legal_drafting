export type MarkdownFragmentDefinition = {
  id: string;
  type: 'markdown';
  content: string;
};

export type PdfFragmentDefinition = {
  id: string;
  type: 'pdf';
  src?: string;
  data?: ArrayBuffer | Uint8Array;
  withCredentials?: boolean;
};

export type DocumentFragment = MarkdownFragmentDefinition | PdfFragmentDefinition;
