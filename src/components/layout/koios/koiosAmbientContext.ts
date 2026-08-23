/**
 * koiosAmbientContext — pure derivation of the AMBIENT @-context ref from the
 * URL hash (KOIOS-SELECTIE-CONTEXT-1, Danny: "als ik een taak of kandidaat
 * selecteer moet ik dit terugzien in Koios AI"). Whichever record is currently
 * open in an entity page's drawer becomes an implicit context ref for the
 * Koios composer — derived with NO extra fetch and NO page wiring: the hash
 * already carries both the open drawer's id (getOpenIdFromHash, useDrawerUrl.ts)
 * and the active page (the segment before '/' or '?', the exact shape
 * EntityLink's buildEntityDeepLink writes and DashboardLayout itself reads on
 * boot). `PAGE_TO_REF_TYPE` is the exact inverse of koiosResultLinks.ts's
 * `RESULT_REF_PAGE` (refType → page), read from that ONE source so the two
 * mappings can never drift apart.
 */
import { getOpenIdFromHash } from '@/hooks/useDrawerUrl'
import { RESULT_REF_PAGE } from './koiosResultLinks'

// page path → context-ref type, the exact inverse of RESULT_REF_PAGE. Exported
// so useKoiosContextChips can map a SelectionContext page key ('candidates')
// to the singular ref type the backend expects ('candidate') — one inverse,
// never a second hand-built lookup.
export const PAGE_TO_REF_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries(RESULT_REF_PAGE).map(([type, page]) => [page, type]),
)

// Pure: the page-path segment of a hash string (before '/' or '?') — the same
// extraction DashboardLayout/useDrawerUrl already do inline, kept local here so
// this module needs no DOM access and stays independently unit-testable.
export function getPagePathFromHash(hash: string): string {
  return hash.replace(/^#/, '').split(/[/?]/)[0]
}

export interface AmbientContextRef {
  type: string
  id: string
  page: string
}

// Pure: the ambient ref for whatever is open right now, or null when the
// active page isn't one of the entity list pages, or nothing is open on it.
export function deriveAmbientRef(hash: string): AmbientContextRef | null {
  const page = getPagePathFromHash(hash)
  const type = PAGE_TO_REF_TYPE[page]
  if (!type) return null
  const id = getOpenIdFromHash(hash)
  if (!id) return null
  return { type, id, page }
}
