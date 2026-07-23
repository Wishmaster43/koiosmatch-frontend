import { strings } from '../strings'

const MAX_MOTIVATION_CHARS = 5000

// Extracts the plain-text length of a rich-text HTML string via a DETACHED element —
// never appended to the live document, so the browser never executes any embedded
// script even if the HTML were untrusted (it isn't: this is the applicant's own typed
// content read back from their own contentEditable, CLAUDE.md §7).
export function getPlainTextLength(html: string): number {
  const container = document.createElement('div')
  container.innerHTML = html
  return (container.textContent ?? '').length
}

// Client-side motivation length check (UX only — the backend re-validates the same
// 5000-char limit, CLAUDE.md §7). Measures the TEXT the applicant actually wrote, not
// the HTML markup, so bold/italic/list tags never eat into the limit unfairly.
export function validateMotivationLength(html: string): string | null {
  if (getPlainTextLength(html) > MAX_MOTIVATION_CHARS) return strings.apply.validation.motivationLength
  return null
}
