// Small pure helpers shared by DocumentsTab and its extracted row/queue pieces.
// Extracted mechanically from DocumentsTab (§3 split trigger, 28-08) — no behavior change.
import type { EntityDoc } from '@/hooks/useEntityDocuments'

// Split a filename into base + extension so rename never touches the extension.
export const splitExt = (fn: string) => { const m = fn.match(/\.[^./\\]+$/); return { base: m ? fn.slice(0, -m[0].length) : fn, ext: m ? m[0] : '' } }

// Stable per-row selection key: the real id, or the row index for not-yet-persisted rows.
export const docKey = (d: EntityDoc, i: number): string => String(d.id ?? 'idx-' + i)
// A row can be downloaded once the server (or a local blob) has given it a url.
export const docUrl = (d: EntityDoc): string | undefined => d.download_url ?? d.objectUrl
// Grid used by both the header row and every data row — one source so they never drift.
export const DOC_GRID_COLUMNS = '18px 1fr 80px 100px'
