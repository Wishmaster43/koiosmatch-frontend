/**
 * ChangelogTab — the bellijst's FIELD-CHANGE audit trail, rendered inside the shared
 * house ChangelogPopover (§3A(d): record history is an ICON-popover in the title row,
 * never a tab). Bellijsten were the LAST entity without one.
 *
 * Shape: the CHANGELOG-3 diff card the candidate/vacancy tabs use — "when · who ·
 * action · field" plus an old → new row — because OutreachCampaign carries the
 * AuditsChanges trait (measured), so the shared feed really does send a `changes`
 * bag. The flat description-only variant (opportunities/matches) would print the bare
 * Spatie verb "updated" here and nothing else, since this feed holds only
 * created/updated/deleted entries. No date/search/CSV toolbar (unlike vacancies): a
 * campaign has six audited columns and the feed is capped at 100 entries, so filters
 * would be chrome without a job — add them the day the feed grows.
 *
 * Presentational: the fetch lives in useOutreachActivity (§3). All four UI states are
 * handled; an empty history is NORMAL for a fresh campaign, so it renders the calm
 * empty state, never an error.
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { History, AlertTriangle, ArrowRight } from 'lucide-react'
import { useDateFormat } from '@/lib/datetime'
import { isUuid } from '@/lib/uuid'
import { useOutreachActivity, type OutreachActivityEvent } from '../hooks/useOutreachActivity'
import type { Id } from '@/types/common'
import { Caption } from '@/components/ui/typography'

// One rendered card: a header line (when · who · action · field) plus an old → new row.
interface LogCard { when?: string; who: string; action: string; field?: string; oldVal?: string | null; newVal?: string | null }

// Backend field key → a readable label for keys with no translation of their own.
const humanizeField = (f: string) => f.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^\w/, c => c.toUpperCase())

// Bookkeeping columns carry no user meaning — never show them as diff rows (the
// AuditsChanges trait already excludes them server-side; defense in depth).
const NOISE_FIELDS = new Set(['id', 'tenant_id', 'created_at', 'updated_at', 'deleted_at'])

// Machine date format the reader can't interpret raw.
const DATE_RE = /^\d{4}-\d{2}-\d{2}([T ]|$)/

// Per-field changes from the diff bag (Spatie { attributes, old } shape — the ONE
// shared LogsEntityActivity contract, CHANGELOG-3).
const changesOf = (ev: OutreachActivityEvent): Array<{ field: string; old: unknown; next: unknown }> => {
  const bag = ev.changes ?? ev.properties
  const attrs = bag?.attributes
  if (!attrs || typeof attrs !== 'object') return []
  const old = (bag?.old ?? {}) as Record<string, unknown>
  return Object.keys(attrs)
    .filter(field => !NOISE_FIELDS.has(field))
    .map(field => ({ field, old: old[field], next: attrs[field] }))
}

// The call-list's field-change audit trail, rendered inside the shared changelog
// popover — one card per changed field, an empty history reads as normal, not an error.
export default function ChangelogTab({ campaignId }: { campaignId?: Id | null }) {
  const { t } = useTranslation('outreach')
  const { formatDate } = useDateFormat()
  const { items, loading, error } = useOutreachActivity(campaignId)

  // Field key → translated label; unknown keys degrade to a humanized form.
  const fieldLabel = (f: string) => t(`changelog.fields.${f}`, { defaultValue: humanizeField(f) })

  // Render a value in end-user terms: empty → "Leeg", booleans → Ja/Nee, the two enum
  // columns → their existing tenant-facing labels, ISO dates → DD-MM-YYYY. A raw uuid
  // reference (owner/pool/creator) is unreadable → null, which prints "bijgewerkt".
  const fmtVal = (field: string, val: unknown): string | null => {
    if (val === null || val === undefined || val === '') return t('changelog.emptyValue')
    if (typeof val === 'boolean') return val ? t('common:yes') : t('common:no')
    if (field === 'status')  return t(`status.${String(val)}`,  { defaultValue: String(val) })
    if (field === 'channel') return t(`channel.${String(val)}`, { defaultValue: String(val) })
    if (Array.isArray(val)) return val.length ? val.map(String).join(', ') : t('changelog.emptyValue')
    if (typeof val === 'object') return JSON.stringify(val)
    const s = String(val)
    if (isUuid(s)) return null
    if (DATE_RE.test(s)) return formatDate(s)
    return s
  }

  // Bare Spatie verbs become readable ("Bijgewerkt"); a human description wins.
  const actionOf = (ev: OutreachActivityEvent): string => {
    const d = ev.description
    if (d && !['updated', 'created', 'deleted', 'restored', ev.log_name].includes(d)) return d
    const verb = ev.event ?? d ?? 'updated'
    return t(`changelog.actions.${verb}`, { defaultValue: d ?? verb })
  }

  // Flatten entries → one card per changed field (newest first, as the API returns them).
  const cards = useMemo<LogCard[]>(() => items.flatMap((ev): LogCard[] => {
    const base = { when: ev.created_at, who: ev.actor_label ?? ev.causer_name ?? t('changelog.system'), action: actionOf(ev) }
    const diffs = changesOf(ev)
    if (!diffs.length) return [base]
    const isCreate = (ev.event ?? ev.description) === 'created'
    return diffs
      .map(ch => ({ ...base, field: fieldLabel(ch.field), oldVal: fmtVal(ch.field, ch.old), newVal: fmtVal(ch.field, ch.next) }))
      // No "Leeg → Leeg" rows. The null guard matters: fmtVal returns null for a raw
      // uuid reference, so a plain `oldVal !== newVal` filter (as copied in the
      // vacancy/candidate tabs) silently DROPS every owner/pool change — the card
      // must survive and render the neutral "bijgewerkt" line instead.
      .filter(cd => cd.oldVal !== cd.newVal || cd.oldVal === null)
      // A CREATE only lists fields that actually got a value.
      .filter(cd => !isCreate || cd.newVal !== t('changelog.emptyValue'))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t is stable enough per render
  }), [items])

  if (loading) return <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('changelog.loading')}</div>

  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--color-danger-text)' }}>
      <AlertTriangle size={14} /> {t('changelog.error')}
    </div>
  )

  // Empty is the normal state for a freshly created campaign — calm, not a failure.
  if (cards.length === 0) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '28px 0', color: 'var(--text-muted)', textAlign: 'center' }}>
      <History size={22} style={{ opacity: 0.5 }} />
      <span style={{ fontSize: 12 }}>{t('changelog.empty')}</span>
    </div>
  )

  return (
    <>
      {/* One card per change: "when · who · action · Field" + "old → new". */}
      {cards.map((cd, i) => (
        <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)', padding: '9px 12px', marginBottom: 8 }}>
          <Caption>
            {cd.when ? formatDate(cd.when, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
            {' · '}{cd.who}{' · '}{cd.action}
            {cd.field && <> {' · '}<span style={{ fontWeight: 600, color: 'var(--text)' }}>{cd.field}</span></>}
          </Caption>
          {cd.field && (
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
        </div>
      ))}
    </>
  )
}
