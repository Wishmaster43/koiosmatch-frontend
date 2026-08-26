/**
 * ChangelogTab — the customer's audit trail content (icon-popover, §3A(d), Danny
 * 27-07 unification onto the shared house ChangelogPopover shell). Presentational:
 * reads GET /customers/{id}/activity — a missing/failing endpoint degrades to an
 * empty list, never a crash. Mounts only while the shared popover is open, so this
 * effect already IS the lazy-on-open fetch.
 *
 * K20 (13-08): the backend DOES send a per-field diff bag (`changes`/`properties`,
 * Spatie Activitylog { attributes, old } shape, LogsEntityActivity.php:66-86,
 * gemaskeerde gevoelige waarden) — the previous docblock claim that it didn't was
 * stale and has been corrected. This now renders one old → new row per changed
 * field, mirroring candidates/drawer/ChangelogTab.tsx's `changesOf()`. Sub-entity
 * rows (location/department/contact/document — reached via `endpoint`) label
 * themselves via `subject_type` so a mixed customer+sub-entity feed stays readable.
 *
 * LOC-DEPT-CHANGELOG-1 (extended additively): an optional `endpoint` override lets
 * the SAME content component serve the location/department/contact detail's own
 * one-level-deeper activity feed (…/locations/{id}/activity etc. — the identical
 * shared change-log shape/pagination/permission, CustomerLocationController.php).
 * The existing `customerId`-only callers (CustomerDrawer) are unchanged.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowRight } from 'lucide-react'
import api, { unwrapList } from '@/lib/api'
import { isAbortError } from '@/lib/mocks'
import { useDateFormat } from '@/lib/datetime'
import { Caption } from '@/components/ui/typography'
import type { Id } from '@/types/common'

interface ActivityEntry {
  id?: Id
  description?: string
  action?: string
  event?: string
  author?: string
  causer_name?: string
  // Koios-performed action label ("<name>-KoiosAI") — wins over causer_name when present.
  actor_label?: string
  created_at?: string
  time?: string
  subject_type?: string
  properties?: { attributes?: Record<string, unknown>; old?: Record<string, unknown> }
  changes?: { attributes?: Record<string, unknown>; old?: Record<string, unknown> }
}

// One rendered card: header line (when · who · action · subject) plus one
// old → new row per changed field — mirrors candidates/drawer/ChangelogTab.tsx.
interface LogRow { field: string; oldVal: string | null; newVal: string | null }
interface LogCard { when?: string; who: string; action: string; subject?: string; rows: LogRow[]; fallbackLine: string }

// Bookkeeping fields carry no user meaning — never show them as diff rows.
const NOISE_FIELDS = new Set(['id', 'tenant_id', 'external_id', 'updated_at', 'created_at', 'remember_token', 'password', 'uuid'])
const DATE_RE = /^\d{4}-\d{2}-\d{2}([T ]|$)/

// Backend field key → a readable label (dynamic keys aren't all translatable).
const humanizeField = (f: string) => f.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^\w/, c => c.toUpperCase())

// Recognised sub-entity `subject_type` class names → the i18n key naming them.
const SUBJECT_LABEL_KEYS: Record<string, string> = {
  CustomerLocation: 'location', CustomerDepartment: 'department', CustomerContact: 'contact', Document: 'document',
}

// The customer (or sub-entity, via `endpoint`) audit-trail content, rendered
// as one card per activity entry with an old → new row per changed field.
export default function ChangelogTab({ customerId, endpoint }: { customerId?: Id; endpoint?: string }) {
  const { t } = useTranslation('customers')
  const { formatDate } = useDateFormat()
  const [items, setItems] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(false)

  // Fetch once per mount — the shared ChangelogPopover shell only mounts this
  // content while its panel is open. `endpoint` wins when given (a sub-entity's
  // own activity route); otherwise falls back to the customer's own route.
  const url = endpoint ?? (customerId ? `/customers/${customerId}/activity` : undefined)
  // Fetch this mount's activity feed once; abort on unmount/url change so a
  // stale response from a previous endpoint can never overwrite the current one.
  useEffect(() => {
    if (!url) return
    const ctrl = new AbortController()
    setLoading(true)
    api.get(url, { signal: ctrl.signal })
      .then(r => setItems((unwrapList(r).rows) as ActivityEntry[]))
      .catch(e => { if (!isAbortError(e)) setItems([]) })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [url])

  // Render a value in end-user terms: empty → "Leeg", booleans → Ja/Nee, ISO
  // dates → the house date format. A raw uuid reference stays unresolved (no
  // lookup metadata is fetched here — the candidate tab has that, this one
  // deliberately stays lighter since customer diffs carry few lookup fields).
  const fmtVal = (v: unknown): string => {
    if (v === null || v === undefined || v === '') return t('changelog.emptyValue')
    if (typeof v === 'boolean') return v ? t('common:yes') : t('common:no')
    if (Array.isArray(v)) return v.map(String).join(', ') || t('changelog.emptyValue')
    const s = String(v)
    return DATE_RE.test(s) ? formatDate(s) : s
  }

  // Field label: translated when known, humanized fallback otherwise.
  const fieldLabel = (f: string) => t(`changelog.fields.${f}`, { defaultValue: humanizeField(f) })

  // Bare Spatie verbs become readable ("Bijgewerkt"); a human description wins.
  const actionOf = (ev: ActivityEntry): string => {
    const d = ev.description
    if (d && !['updated', 'created', 'deleted', 'restored'].includes(d)) return d
    const verb = ev.event ?? d ?? 'updated'
    return t(`changelog.actions.${verb}`, { defaultValue: d ?? verb })
  }

  // The sub-entity label for a mixed feed (customer's own entries carry no
  // `subject_type`, or one that isn't in the known map — both render nothing).
  const subjectOf = (ev: ActivityEntry): string | undefined => {
    const key = ev.subject_type ? SUBJECT_LABEL_KEYS[ev.subject_type] : undefined
    return key ? t(`changelog.subjectTypes.${key}`) : undefined
  }

  // Per-field changes from the diff bag — the current resource sends `changes`,
  // older payloads sent `properties` (both Spatie { attributes, old } shape).
  const changesOf = (ev: ActivityEntry): LogRow[] => {
    const bag = ev.changes ?? ev.properties
    const attrs = bag?.attributes
    if (!attrs || typeof attrs !== 'object') return []
    const old = bag?.old ?? {}
    return Object.keys(attrs)
      .filter(field => !NOISE_FIELDS.has(field))
      .map(field => ({ field: fieldLabel(field), oldVal: fmtVal(old[field]), newVal: fmtVal(attrs[field]) }))
      // No "Leeg → Leeg" rows — a field that didn't actually change carries no signal.
      .filter(row => row.oldVal !== row.newVal)
  }

  const cards: LogCard[] = items.map(ev => ({
    when: ev.created_at ?? ev.time,
    who: ev.actor_label ?? ev.causer_name ?? ev.author ?? t('changelog.system'),
    action: actionOf(ev),
    subject: subjectOf(ev),
    rows: changesOf(ev),
    fallbackLine: ev.description ?? ev.action ?? '—',
  }))

  if (loading) return <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('page.loading')}</div>
  if (cards.length === 0) return <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('changelog.empty')}</div>

  return (
    <>
      {cards.map((cd, i) => (
        <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)', padding: '9px 12px', marginBottom: 8 }}>
          <Caption as="div">
            {cd.when ? formatDate(cd.when, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
            {' · '}{cd.who}{' · '}{cd.action}
            {cd.subject && <> {' · '}<span style={{ fontWeight: 600, color: 'var(--text)' }}>{cd.subject}</span></>}
          </Caption>
          {/* One row per changed field — falls back to the plain description line
              when the backend sent no diff bag for this entry (e.g. a delete). */}
          {cd.rows.length > 0 ? (
            cd.rows.map((row, j) => (
              <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 5, fontSize: 12 }}>
                <span style={{ width: 120, flexShrink: 0, color: 'var(--text)', fontWeight: 600 }}>{row.field}</span>
                <span style={{ flex: 1, color: 'var(--text-muted)' }}>{row.oldVal}</span>
                <ArrowRight size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <span style={{ flex: 1, color: 'var(--text)' }}>{row.newVal}</span>
              </div>
            ))
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text)', marginTop: 5 }}>{cd.fallbackLine}</div>
          )}
        </div>
      ))}
    </>
  )
}
