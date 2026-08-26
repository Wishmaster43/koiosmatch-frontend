/**
 * EntityChangelogTab — THE shared changelog-tab CONTENT for every entity drawer
 * (§11: extract-one-shared, LANE-B). Built from the outreach ChangelogTab, the most
 * correct of the seven near-identical copies it replaces (candidates, vacancies,
 * applications, customers, matches, opportunities, outreach): ONE card per changed
 * field, "when · who · action · [subject] · field" header, an old → new row, and the
 * CHANGELOG-3 null-guard that keeps a raw-uuid diff (owner/pool/agent references)
 * on screen as a neutral "updated" line instead of silently dropping the card.
 * Every entity's `GET .../activity` route shares the ONE backend AuditsChanges
 * trait, so all seven feeds carry the same `changes` { attributes, old } diff bag —
 * matches/opportunities previously ignored it and rendered a flat description-only
 * line; this fixes that staleness for them too.
 *
 * Presentational: the fetch stays in each entity's own `useXActivity` hook, passed
 * in as `items`/`loading`/`error`. Per-entity differences that survive as real
 * product behaviour (lookup-label resolution, the candidate's H2 status/phase
 * transition line, the application's stage-only dedupe, the customer's mixed
 * sub-entity feed, the candidate/vacancy date-filter+search+CSV toolbar) are
 * parameterised — never forked back into a second copy of this file.
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { History, AlertTriangle, ArrowRight, Download } from 'lucide-react'
import { useDateFormat } from '@/lib/datetime'
import { escapeCsvCell } from '@/lib/csv'
import { isUuid } from '@/lib/uuid'
import { Caption } from '@/components/ui/typography'
import Button from '@/components/ui/Button'
import type { Id } from '@/types/common'

// The Spatie {attributes, old} diff bag every entity's AuditsChanges trait sends.
export interface ChangelogDiffBag { attributes?: Record<string, unknown>; old?: Record<string, unknown> }

// One raw activity-log entry — the shared shape across every entity's activity feed.
export interface ChangelogEvent {
  id?: Id
  causer_name?: string
  // Koios-performed action label ("<name>-KoiosAI") — wins over causer_name when present.
  actor_label?: string
  created_at?: string
  description?: string
  event?: string
  log_name?: string
  subject_type?: string
  changes?: ChangelogDiffBag
  properties?: ChangelogDiffBag
  [k: string]: unknown
}

// One rendered card: a header line (when · who · action · [subject] · field) plus an
// old → new row, a single readable `line` (e.g. a status/phase transition), or —
// only when the caller opts in — a plain fallback description for a diff-less entry.
interface LogCard { when?: string; who: string; action: string; subject?: string; field?: string; oldVal?: string | null; newVal?: string | null; line?: string; fallback?: string }

// Bookkeeping columns every entity's trait already excludes server-side — this stays
// defense-in-depth for anything that slips through; entities merge their own extras in.
const BASE_NOISE_FIELDS = ['id', 'tenant_id', 'created_at', 'updated_at', 'deleted_at']

// Backend field key → a readable label for keys with no translation of their own.
const humanizeField = (f: string) => f.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^\w/, c => c.toUpperCase())

// Machine date format the reader can't interpret raw.
const DATE_RE = /^\d{4}-\d{2}-\d{2}([T ]|$)/

export interface EntityChangelogTabProps<E extends ChangelogEvent = ChangelogEvent> {
  items: E[]
  loading: boolean
  error: boolean
  /** i18n namespace carrying this entity's changelog.* keys (fields/actions/…). */
  namespace: string
  /** Bookkeeping fields to exclude from diff rows, ON TOP OF the base set above. */
  noiseFields?: readonly string[]
  /** Field-specific value rendering (lookup labels, resolved names, enums). Return
   * undefined to defer to the generic empty/boolean/array/uuid/date/string rules. */
  formatValue?: (field: string, value: unknown) => string | null | undefined
  /** Event-level keep predicate, applied before card-building (default: keep all). */
  filterEvent?: (event: E) => boolean
  /** Overrides the WHOLE card for one event (the candidate's H2 status/phase
   * transition line) — when it returns a card, the normal per-field diff is skipped. */
  extraCard?: (event: E, base: { when?: string; who: string; action: string }) => LogCard | null
  /** A short label distinguishing a mixed feed's sub-entity entries (customers). */
  subjectLabel?: (event: E) => string | undefined
  /** A diff-less entry falls back to its plain description as a body line (customers'
   * mixed feed) — off by default, since the header already carries the same text. */
  fallbackDescription?: boolean
  /** Wraps who/action in their own <span> in the header (applications) — needed so an
   * exact-text query can isolate the actor's name from the surrounding meta line. */
  wrapWhoAction?: boolean
  /** Date-range + search + CSV export toolbar (candidates/vacancies). */
  toolbar?: boolean
  /** CSV filename (without extension) when `toolbar` is on. */
  exportFileNameBase?: string
}

// Shared changelog-tab content: fetch stays with the caller, this renders the four UI
// states plus the CHANGELOG-3 per-field diff cards (see file docblock above).
export default function EntityChangelogTab<E extends ChangelogEvent = ChangelogEvent>({
  items, loading, error, namespace, noiseFields, formatValue, filterEvent, extraCard, subjectLabel,
  fallbackDescription = false, wrapWhoAction = false, toolbar = false, exportFileNameBase = 'changelog',
}: EntityChangelogTabProps<E>) {
  const { t } = useTranslation(namespace)
  const { formatDate } = useDateFormat()
  // Client-side date-range filter + free-text search (HelloFlex: "Datum van / t/m") —
  // only rendered/applied when the caller opts into the toolbar.
  const [from, setFrom] = useState('')
  const [until, setUntil] = useState('')
  const [q, setQ] = useState('')

  // Field key → translated label; unknown keys degrade to a humanized form.
  const fieldLabel = (f: string) => t(`changelog.fields.${f}`, { defaultValue: humanizeField(f) })

  // Render a value in end-user terms: empty → "Leeg", booleans → Ja/Nee, ISO dates →
  // DD-MM-YYYY, plain objects/arrays → a compact summary. A raw uuid reference is
  // unreadable → null, which the card-builder turns into the neutral "bijgewerkt" line
  // instead of dropping the change. A per-entity `formatValue` override runs first.
  const fmtVal = (field: string, val: unknown): string | null => {
    const custom = formatValue?.(field, val)
    if (custom !== undefined) return custom
    if (val === null || val === undefined || val === '') return t('changelog.emptyValue')
    if (typeof val === 'boolean') return val ? t('common:yes') : t('common:no')
    if (Array.isArray(val)) return val.length ? val.map(String).join(', ') : t('changelog.emptyValue')
    if (typeof val === 'object') return JSON.stringify(val)
    const s = String(val)
    if (isUuid(s)) return null
    if (DATE_RE.test(s)) return formatDate(s)
    return s
  }

  // Bare Spatie verbs become readable ("Bijgewerkt"); a human description wins.
  const actionOf = (ev: E): string => {
    const d = ev.description
    if (d && !['updated', 'created', 'deleted', 'restored', ev.log_name].includes(d)) return d
    const verb = ev.event ?? d ?? 'updated'
    return t(`changelog.actions.${verb}`, { defaultValue: d ?? verb })
  }

  // Per-field changes from the diff bag (Spatie { attributes, old } shape, the ONE
  // shared AuditsChanges contract every entity's feed sends, CHANGELOG-3).
  const changesOf = (ev: E): Array<{ field: string; old: unknown; next: unknown }> => {
    const bag = ev.changes ?? ev.properties
    const attrs = bag?.attributes
    if (!attrs || typeof attrs !== 'object') return []
    const old = (bag?.old ?? {}) as Record<string, unknown>
    const noise = new Set([...BASE_NOISE_FIELDS, ...(noiseFields ?? [])])
    return Object.keys(attrs)
      .filter(field => !noise.has(field))
      .map(field => ({ field, old: old[field], next: attrs[field] }))
  }

  // Flatten entries → HelloFlex-style cards (one per field change), newest first,
  // then apply the toolbar's date-range + search filter when enabled.
  const cards = useMemo<LogCard[]>(() => {
    const kept = filterEvent ? items.filter(filterEvent) : items
    const all = kept.flatMap((ev): LogCard[] => {
      const base = { when: ev.created_at, who: ev.actor_label ?? ev.causer_name ?? t('changelog.system'), action: actionOf(ev) }
      const extra = extraCard?.(ev, base)
      if (extra) return [extra]
      const subject = subjectLabel?.(ev)
      const diffs = changesOf(ev)
      if (!diffs.length) return [{ ...base, subject, fallback: fallbackDescription ? (ev.description ?? '—') : undefined }]
      const isCreate = (ev.event ?? ev.description) === 'created'
      return diffs
        .map(ch => ({ ...base, subject, field: fieldLabel(ch.field), oldVal: fmtVal(ch.field, ch.old), newVal: fmtVal(ch.field, ch.next) }))
        // No "Leeg → Leeg" rows. The null guard matters: fmtVal returns null for a raw
        // uuid reference, so a plain `oldVal !== newVal` filter would silently DROP
        // every owner/pool change — the card must survive as the neutral line instead.
        .filter(cd => cd.oldVal !== cd.newVal || cd.oldVal === null)
        // A CREATE only lists fields that actually got a value.
        .filter(cd => !isCreate || cd.newVal !== t('changelog.emptyValue'))
    })
    if (!toolbar) return all
    return all.filter(cd => {
      if (cd.when) {
        const d = cd.when.slice(0, 10)
        if ((from && d < from) || (until && d > until)) return false
      }
      // Search across who/action/field/values — mirrors HelloFlex's searchable Historie.
      if (q.trim()) {
        const hay = [cd.who, cd.action, cd.field, cd.oldVal, cd.newVal, cd.line].filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(q.trim().toLowerCase())) return false
      }
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t/formatValue/lookup callbacks are stable enough per render
  }, [items, filterEvent, extraCard, subjectLabel, toolbar, from, until, q])

  // Client-side CSV export of the filtered view (user-initiated download, §8-safe).
  // Cells go through the shared escapeCsvCell, which also guards against formula
  // injection (a leading =+-@ opened as a live formula in Excel/Sheets — C-14).
  const exportCsv = () => {
    const rows = [
      ['datetime', 'who', 'action', 'field', 'old', 'new'].join(';'),
      ...cards.map(cd => [cd.when ?? '', cd.who, cd.action, cd.field ?? '', cd.line ?? cd.oldVal ?? '', cd.line ? '' : cd.newVal ?? ''].map(escapeCsvCell).join(';')),
    ].join('\n')
    const url = URL.createObjectURL(new Blob([rows], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url; a.download = `${exportFileNameBase}.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  const inputStyle = { padding: '6px 9px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)', color: 'var(--text)', outline: 'none' } as const
  const boldSpan = { fontWeight: 600, color: 'var(--text)' } as const

  return (
    <>
      {/* Date-range filter + search + export — only the candidate/vacancy toolbar. */}
      {toolbar && (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <Caption as="label" style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {t('changelog.dateFrom')}
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={inputStyle} />
          </Caption>
          <Caption as="label" style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {t('changelog.dateUntil')}
            <input type="date" value={until} onChange={e => setUntil(e.target.value)} style={inputStyle} />
          </Caption>
          <Caption as="label" style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 160 }}>
            {t('changelog.search')}
            <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={t('changelog.searchPlaceholder')} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
          </Caption>
          <Button variant="secondary" size="sm" iconOnly onClick={exportCsv} title={t('changelog.export')} aria-label={t('changelog.export')}>
            <Download size={14} />
          </Button>
        </div>
      )}

      {loading && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('changelog.loading')}</div>}

      {!loading && error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--color-danger-text)' }}>
          <AlertTriangle size={14} /> {t('changelog.error')}
        </div>
      )}

      {!loading && !error && cards.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '28px 0', color: 'var(--text-muted)', textAlign: 'center' }}>
          <History size={22} style={{ opacity: 0.5 }} />
          <span style={{ fontSize: 12 }}>{t('changelog.empty')}</span>
        </div>
      )}

      {/* One card per change: "when · who · action · [subject] · Field" + "old → new". */}
      {!loading && !error && cards.map((cd, i) => (
        <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)', padding: '9px 12px', marginBottom: 8 }}>
          <Caption as="div">
            {cd.when ? formatDate(cd.when, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
            {wrapWhoAction ? (
              <>{' · '}<span>{cd.who}</span>{' · '}<span>{cd.action}</span></>
            ) : (
              <>{' · '}{cd.who}{' · '}{cd.action}</>
            )}
            {cd.subject && <> {' · '}<span style={boldSpan}>{cd.subject}</span></>}
            {cd.field && <> {' · '}<span style={boldSpan}>{cd.field}</span></>}
          </Caption>
          {cd.line && <div style={{ fontSize: 12, color: 'var(--text)', marginTop: 5 }}>{cd.line}</div>}
          {!cd.line && cd.field && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 5, fontSize: 12 }}>
              {(cd.oldVal === null || cd.newVal === null) ? (
                <span style={{ color: 'var(--text-muted)' }}>{t('changelog.updatedValue')}</span>
              ) : (
                <>
                  <span style={{ flex: 1, color: 'var(--text-muted)' }}>{cd.oldVal}</span>
                  <ArrowRight size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <span style={{ flex: 1, color: 'var(--text)' }}>{cd.newVal}</span>
                </>
              )}
            </div>
          )}
          {!cd.line && !cd.field && cd.fallback && <div style={{ fontSize: 12, color: 'var(--text)', marginTop: 5 }}>{cd.fallback}</div>}
        </div>
      ))}
    </>
  )
}
