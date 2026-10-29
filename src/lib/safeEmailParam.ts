/**
 * safeEmailParam — accepts a query-string address only when it is shaped like one,
 * so a crafted `?email=` sentence is never echoed on a genuine KoiosMatch page.
 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_EMAIL_LENGTH = 254

// Returns the trimmed address, or '' for anything that is not a plausible address.
export function safeEmailParam(raw: string | null | undefined): string {
  const value = (raw ?? '').trim()
  return value.length <= MAX_EMAIL_LENGTH && EMAIL_SHAPE.test(value) ? value : ''
}
