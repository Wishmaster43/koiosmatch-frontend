// documentHelpers — shared types and pure helpers for the candidate Documents
// section: the DocItem row shape, selection keys, persisted/downloadable checks,
// grid columns, expiry classification and file-size formatting.
import type { DocVersion } from './DocumentVersionHistory'
import type { Id } from '@/types/common'

// The candidate document row shape (CandidateDocumentController / DocumentResource),
// shared by DocumentsSection (state owner) and DocumentRow (its presentational row) —
// centralised here so neither file needs to import a type from the other.
export interface DocItem {
  id?: Id
  name?: string
  file_name?: string
  size?: string | number
  type?: string
  objectUrl?: string
  url?: string
  // DOC-EXPIRY-1: the signed, short-lived download URL (DocumentResource) — the
  // preferred download source everywhere in this section (see docUrl below).
  download_url?: string
  // DOC-EXPIRY-1: nullable — only compliance uploads (VOG/BIG/diploma-style) carry one.
  expires_at?: string | null
  // DOC-VERSIE-1: superseded files from a prior /replace, newest first (index + replace responses only).
  versions?: DocVersion[]
  created_at?: string
  uploaded_at?: string
  uploaded_by?: string | { name?: string }
  created_by?: string | { name?: string }
}

// Split a filename into base + extension so rename never touches the extension.
export const splitExt = (fn: string) => { const m = fn.match(/\.[^./\\]+$/); return { base: m ? fn.slice(0, -m[0].length) : fn, ext: m ? m[0] : '' } }

// Stable per-row selection key: the real id, or the row index for not-yet-persisted rows.
export const docKey = (d: DocItem, i: number): string => String(d.id ?? 'idx-' + i)
// A doc is on the server once it has a non-temp id. BUGFIX 23-07: the old
// `typeof id === 'number' && id > 0` guard silently blocked EVERY rename/delete —
// CandidateDocument ids are UUIDs (strings), only optimistic temp ids are numbers.
export const isPersisted = (id: Id | undefined): boolean => id != null && !(typeof id === 'number' && id <= 0)
// A row can be downloaded once the server (or a local blob) has given it a url.
// DOC-EXPIRY-1 point 2: the SIGNED download_url is preferred everywhere in this
// section — the legacy authenticated `url` is only a fallback for a row that
// predates this field (and a locally queued file still uses its blob objectUrl).
export const docUrl = (d: DocItem): string | undefined => d.download_url ?? d.url ?? d.objectUrl
// Grid used by both the header row and every data row — one source so they never drift.
// Row layout: checkbox · name · type · size · actions. The actions got their own
// column (Danny 08-08: "icons moeten opschuiven, past niet meer zo" — the icons
// need to shift, it doesn't fit any more) — they used
// to share the 100px size cell, so the fifth icon (re-link) pushed the size text
// out. `auto` lets the icon strip take exactly what it needs; the name column
// (1fr) gives the space back.
export const DOC_GRID_COLUMNS = '18px 1fr 84px 64px auto'

// DOC-EXPIRY-1 point 1: pure expiry classification for a document's expires_at —
// mirrors the 30-day warning / past-due danger window pages/matches/matchExpiry.ts
// uses for match end dates, so the "expiring soon" language reads the same
// everywhere. Kept local rather than imported: §2 forbids one entity page
// reaching into another entity page's internals.
const EXPIRY_WARNING_DAYS = 30
export type DocExpiry = { kind: 'expired' | 'warning' } | null
const startOfDay = (d: Date): number => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
export const computeDocExpiry = (expiresAt: string | null | undefined, now: Date = new Date()): DocExpiry => {
  if (!expiresAt) return null
  const end = new Date(expiresAt)
  if (isNaN(end.getTime())) return null
  const days = Math.round((startOfDay(end) - startOfDay(now)) / 86_400_000)
  if (days <= 0) return { kind: 'expired' }
  if (days <= EXPIRY_WARNING_DAYS) return { kind: 'warning' }
  return null
}

/**
 * Human file size. The API sends `size` in BYTES; the candidate mapper already
 * formatted it on load, but a fresh upload/replace RESPONSE overwrote that with
 * the raw number (Danny 08-08 saw "757653" right after uploading). Both paths
 * go through this one helper now.
 */
export const formatDocSize = (b: unknown): string => {
  if (b == null || b === '') return ''
  // Already formatted upstream ("740 KB") — leave it alone.
  if (typeof b === 'string' && /[a-z]/i.test(b)) return b
  const n = Number(b)
  if (Number.isNaN(n)) return String(b)
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
