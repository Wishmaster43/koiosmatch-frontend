import { strings } from '../strings'

const MAX_REMARKS_CHARS = 2000

// Client-side "Vragen of opmerkingen" length check (UX only — the backend
// re-validates the same 2000-char cap). Plain text, unlike motivation: the
// backend strips markup on store, so there is no HTML overhead to account for.
export function validateRemarksLength(value: string): string | null {
  if (value.length > MAX_REMARKS_CHARS) return strings.apply.validation.remarksLength
  return null
}
