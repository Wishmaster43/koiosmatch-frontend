/**
 * noteMetaSentence — K-225 NOTE-META-1: render a status-change note's sentence in the
 * READER's language from its `meta`, never from the stored Dutch body. A note written
 * by an automation (status change, later phase change/archive/restore/marked-for-
 * deletion) stores structured `meta` instead of prose, so every reader sees the event
 * in their OWN locale — the stored `body` (if any) stays a Dutch fallback for tenants
 * on an older backend. Today only `meta.kind === 'status_change'` is populated by the
 * backend; H2 adds phase_change/archived/restored/marked_for_deletion — each new kind
 * is one template string + one switch case. An unknown/missing kind returns null so
 * the caller falls back to the note's stored `body`.
 */
// i18n-scan: candidates
import type { TFunction } from 'i18next'

// One note's structured meta payload. Only `status_change` fields are populated today;
// the optional fields below are shared/reserved for the H2 kinds listed in the docblock.
export interface NoteMeta {
  kind?: string | null
  from_value?: string | null
  to_value?: string | null
  reason_value?: string | null
  blacklist_reason_value?: string | null
  effective_from?: string | null
  erase_at?: string | null
}

// What the sentence builder needs from its caller: the candidates-namespace t(), a
// tenant status-value → label resolver (falls back to the raw slug when unresolved),
// and the house DD-MM-YYYY date formatter (DATUM-1 — never a raw ISO string).
export interface NoteMetaContext {
  t: TFunction
  statusLabel: (value: string) => string
  formatDate: (iso: string) => string
}

// Appends the optional reason / blacklist-reason / effective-date suffixes shared by
// every meta kind that carries them (today only status_change; future kinds reuse this
// instead of re-implementing the same three optional clauses).
function appendSuffixes(base: string, meta: NoteMeta, ctx: NoteMetaContext): string {
  let sentence = base
  if (meta.reason_value) sentence += ctx.t('notes.meta.reason', { reason: meta.reason_value })
  if (meta.blacklist_reason_value) sentence += ctx.t('notes.meta.blacklistReason', { reason: meta.blacklist_reason_value })
  if (meta.effective_from) sentence += ctx.t('notes.meta.effectiveFrom', { date: ctx.formatDate(meta.effective_from) })
  return sentence
}

// Builds the status_change sentence: "Status changed from X to Y", or "Status set to Y"
// when there was no previous value (first status ever recorded), then the shared
// reason/blacklist-reason/effective-date suffixes.
function statusChangeSentence(meta: NoteMeta, ctx: NoteMetaContext): string {
  const to = meta.to_value ? ctx.statusLabel(meta.to_value) : ''
  const base = meta.from_value
    ? ctx.t('notes.meta.statusChange', { from: ctx.statusLabel(meta.from_value), to })
    : ctx.t('notes.meta.statusSet', { to })
  return appendSuffixes(base, meta, ctx)
}

// Renders one note's meta as a translated sentence, or null when the kind is unknown,
// unset or meta itself is missing — the caller then falls back to the stored `body`
// (a plain user-written note has no meta and always falls through here).
export function noteMetaSentence(meta: NoteMeta | null | undefined, ctx: NoteMetaContext): string | null {
  if (!meta || !meta.kind) return null
  switch (meta.kind) {
    case 'status_change':
      return statusChangeSentence(meta, ctx)
    default:
      return null
  }
}
