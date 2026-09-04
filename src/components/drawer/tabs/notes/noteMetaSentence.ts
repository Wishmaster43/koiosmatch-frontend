/**
 * noteMetaSentence — K-225 NOTE-META-1: render a status-change note's sentence in the
 * READER's language from its `meta`, never from the stored Dutch body. A note written
 * by an automation (status change, phase change, archive/restore, marked-for-deletion)
 * stores structured `meta` instead of prose, so every reader sees the event in their
 * OWN locale — the stored `body` (if any) stays a Dutch fallback for tenants on an
 * older backend. K-225 H2 adds phase_change/archived/restored/marked_for_deletion
 * alongside the original status_change — each kind is one template string + one
 * switch case. An unknown/missing kind returns null so the caller falls back to the
 * note's stored `body`.
 */
// i18n-scan: candidates
import type { TFunction } from 'i18next'

// One note's structured meta payload. `from_value`/`to_value` serve both status_change
// and phase_change; `reason_value` also serves archived; `erase_at` serves
// marked_for_deletion; `restored` carries none of these (kind alone is enough).
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
// tenant status-value → label resolver and a tenant phase-value → label resolver
// (both fall back to the raw slug when unresolved), and the house DD-MM-YYYY date
// formatter (DATUM-1 — never a raw ISO string).
export interface NoteMetaContext {
  t: TFunction
  statusLabel: (value: string) => string
  phaseLabel: (value: string) => string
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

// Builds the phase_change sentence: "Phase changed from X to Y", or "Phase set to Y"
// when there was no previous value — mirrors statusChangeSentence, but phase_change
// carries only from_value/to_value per the H2 contract (no reason/effective-date suffixes).
function phaseChangeSentence(meta: NoteMeta, ctx: NoteMetaContext): string {
  const to = meta.to_value ? ctx.phaseLabel(meta.to_value) : ''
  return meta.from_value
    ? ctx.t('notes.meta.phaseChange', { from: ctx.phaseLabel(meta.from_value), to })
    : ctx.t('notes.meta.phaseSet', { to })
}

// Builds the archived sentence: "Archived", plus the shared reason suffix when the
// automation recorded one (an archive can carry a tenant-configured reason value).
function archivedSentence(meta: NoteMeta, ctx: NoteMetaContext): string {
  return appendSuffixes(ctx.t('notes.meta.archived'), meta, ctx)
}

// Builds the restored sentence: "Restored from archive" — the kind carries no optional fields.
function restoredSentence(ctx: NoteMetaContext): string {
  return ctx.t('notes.meta.restored')
}

// Builds the marked_for_deletion sentence: "Deletion scheduled", plus an erase-at
// suffix when the automation set one. Its own suffix key (not the shared
// effectiveFrom one): this date means "will be erased on", not "in effect since".
function markedForDeletionSentence(meta: NoteMeta, ctx: NoteMetaContext): string {
  let sentence = ctx.t('notes.meta.markedForDeletion')
  if (meta.erase_at) sentence += ctx.t('notes.meta.eraseAt', { date: ctx.formatDate(meta.erase_at) })
  return sentence
}

// Renders one note's meta as a translated sentence, or null when the kind is unknown,
// unset or meta itself is missing — the caller then falls back to the stored `body`
// (a plain user-written note has no meta and always falls through here).
export function noteMetaSentence(meta: NoteMeta | null | undefined, ctx: NoteMetaContext): string | null {
  if (!meta || !meta.kind) return null
  switch (meta.kind) {
    case 'status_change':
      return statusChangeSentence(meta, ctx)
    case 'phase_change':
      return phaseChangeSentence(meta, ctx)
    case 'archived':
      return archivedSentence(meta, ctx)
    case 'restored':
      return restoredSentence(ctx)
    case 'marked_for_deletion':
      return markedForDeletionSentence(meta, ctx)
    default:
      return null
  }
}
