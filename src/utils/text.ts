const STRIP_MARKDOWN_REGEX = /(!?\[[^\]]*\]\([^)]*\))|(```[\s\S]*?```)|(`+[^`]+`+)|(\*\*|__|\*|_|~~|>|#+|-\s)/g;

export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(STRIP_MARKDOWN_REGEX, ' ')
    .replace(/\r?\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
