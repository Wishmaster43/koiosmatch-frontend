import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { History, AlertTriangle, ArrowRight, Download } from 'lucide-react'
import SectionCard from '@/components/ui/SectionCard'
import { useDateFormat } from '@/lib/datetime'
import { useVacancyLookups } from '@/context/VacancyLookupsContext'
import { escapeCsvCell } from '@/lib/csv'
import { useVacancyActivity, type VacancyActivityEvent } from '../hooks/useVacancyActivity'
import type { VacancyDetail } from '@/types/vacancy'

// One rendered card: HelloFlex-style — a header line (when · who · action · field)
// plus an old → new body row (or a single readable line, unused here today but kept
// for parity with the candidate shape).
interface LogCard { when?: string; who: string; action: string; field?: string; oldVal?: string | null; newVal?: string | null; line?: string }

// Backend field key → a readable label (dynamic keys aren't all translatable).
const humanizeField = (f: string) => f.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^\w/, c => c.toUpperCase())

// Bookkeeping fields carry no user meaning — never show them as diff rows (the
// AuditsChanges trait already excludes id/created_at/updated_at/deleted_at server-
// side; this is defense-in-depth for anything that slips through).
const NOISE_FIELDS = new Set(['id', 'tenant_id', 'created_at', 'updated_at', 'deleted_at'])

// Raw references / machine formats the reader can't interpret.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}([T ]|$)/

// Per-field changes from the diff bag — the resource sends `changes` (Spatie
// { attributes, old } shape, same as the candidate/opportunity/match feeds —
// LogsEntityActivity is the ONE shared contract, CHANGELOG-3).
const changesOf = (ev: VacancyActivityEvent): Array<{ field: string; old: unknown; next: unknown }> => {
  const bag = (ev.changes ?? ev.properties) as { attributes?: Record<string, unknown>; old?: Record<string, unknown> } | undefined
  const attrs = bag?.attributes
  if (!attrs || typeof attrs !== 'object') return []
  const old = (bag?.old ?? {}) as Record<string, unknown>
  return Object.keys(attrs)
    .filter(field => !NOISE_FIELDS.has(field))
    .map(field => ({ field, old: old[field], next: attrs[field] }))
}

/**
 * ChangelogTab — the vacancy's FIELD-CHANGE audit trail (icon-popover, §3A(d)),
 * rewritten onto the CHANGELOG-3 shape (V8, VACATURES-100): ONE card per field
 * change with "when · who · action · field" and an old → new row, date-range
 * filters, search and a CSV export — mirrors the candidate ChangelogTab exactly.
 * `bare` drops the SectionCard + filters so the title-row popover stays compact
 * (mirrors the candidate/opportunity/match popovers). MEASURED: GET
 * /vacancies/{id}/activity (EntityChangelogController::vacancy) shares the SAME
 * LogsEntityActivity trait as candidates — the diff bag was always there, the
 * previous version of this file just rendered the flat description instead of it.
 * Distinct from the Tijdlijn TAB (TimelineTab.tsx, real lifecycle activity) — tab =
 * activiteit, icon = veldwijzigingen.
 */
export default function ChangelogTab({ vacancy: v, bare = false }: { vacancy: VacancyDetail; bare?: boolean }) {
  const { t } = useTranslation('vacancies')
  const { formatDate } = useDateFormat()
  const { items, loading, error } = useVacancyActivity(v?.id)
  // Lookup metas so status/seniority/education diff values render tenant labels,
  // not opaque lookup ids.
  const { statusMeta, seniorityMeta, educationMeta } = useVacancyLookups()
  const [from, setFrom] = useState('')
  const [until, setUntil] = useState('')
  const [q, setQ] = useState('')

  // Field key → translated label; unknown keys degrade to a humanized form.
  const fieldLabel = (f: string) => t(`changelog.fields.${f}`, { defaultValue: humanizeField(f) })

  // Render a value in end-user terms: empty → "Leeg", booleans → Ja/Nee, known
  // lookup-id columns → tenant labels, ISO dates → DD-MM-YYYY, plain objects/arrays
  // → a compact JSON summary. Null = a raw uuid reference (unreadable) → "bijgewerkt".
  const fmtVal = (field: string, val: unknown): string | null => {
    if (val === null || val === undefined || val === '') return t('changelog.emptyValue')
    if (typeof val === 'boolean') return val ? t('common:yes') : t('common:no')
    if (field === 'vacancy_status_id')            return statusMeta(String(val)).label
    if (field === 'vacancy_seniority_level_id')    return seniorityMeta(String(val)).label
    if (field === 'vacancy_education_level_id')    return educationMeta(String(val)).label
    if (Array.isArray(val)) return val.length ? val.map(String).join(', ') : t('changelog.emptyValue')
    if (typeof val === 'object') return JSON.stringify(val)
    const s = String(val)
    if (UUID_RE.test(s)) return null
    if (DATE_RE.test(s)) return formatDate(s)
    return s
  }

  // Bare Spatie verbs become readable ("Bijgewerkt"); a human description wins.
  const actionOf = (ev: VacancyActivityEvent): string => {
    const d = ev.description
    if (d && !['updated', 'created', 'deleted', 'restored', ev.log_name].includes(d)) return d
    const verb = ev.event ?? d ?? 'updated'
    return t(`changelog.actions.${verb}`, { defaultValue: d ?? verb })
  }

  // Flatten entries → HelloFlex-style cards (one per field change), newest first,
  // then apply the date-range + search filter.
  const cards = useMemo<LogCard[]>(() => {
    const all = items.flatMap((ev): LogCard[] => {
      const base = { when: ev.created_at, who: ev.causer_name || t('changelog.system'), action: actionOf(ev) }
      const diffs = changesOf(ev)
      if (!diffs.length) return [base]
      const isCreate = (ev.event ?? ev.description) === 'created'
      return diffs
        .map(ch => ({ ...base, field: fieldLabel(ch.field), oldVal: fmtVal(ch.field, ch.old), newVal: fmtVal(ch.field, ch.next) }))
        // No "Leeg → Leeg" rows; a CREATE only lists fields that actually got a value.
        .filter(cd => cd.oldVal !== cd.newVal)
        .filter(cd => !isCreate || cd.newVal !== t('changelog.emptyValue'))
    })
    return all.filter(cd => {
      if (cd.when) {
        const d = cd.when.slice(0, 10)
        if ((from && d < from) || (until && d > until)) return false
      }
      if (q.trim()) {
        const hay = [cd.who, cd.action, cd.field, cd.oldVal, cd.newVal, cd.line].filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(q.trim().toLowerCase())) return false
      }
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t/lookup metas are stable enough per render
  }, [items, from, until, q])

  // Client-side CSV export of the filtered view (user-initiated download, §8-safe).
  // escapeCsvCell also guards against formula injection (C-14).
  const exportCsv = () => {
    const rows = [
      ['datetime', 'who', 'action', 'field', 'old', 'new'].join(';'),
      ...cards.map(cd => [cd.when ?? '', cd.who, cd.action, cd.field ?? '', cd.line ?? cd.oldVal ?? '', cd.line ? '' : cd.newVal ?? ''].map(escapeCsvCell).join(';')),
    ].join('\n')
    const url = URL.createObjectURL(new Blob([rows], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url; a.download = `changelog-${v?.title ?? 'vacancy'}.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  const inputStyle = { padding: '6px 9px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)', color: 'var(--text)', outline: 'none' } as const

  const body = (
    <>
      {/* Date-range filter + search + export (also in the wide popover modal). */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, color: 'var(--text-muted)' }}>
          {t('changelog.dateFrom')}
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, color: 'var(--text-muted)' }}>
          {t('changelog.dateUntil')}
          <input type="date" value={until} onChange={e => setUntil(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, color: 'var(--text-muted)', flex: 1, minWidth: 160 }}>
          {t('changelog.search')}
          <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={t('changelog.searchPlaceholder')} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
        </label>
        <button onClick={exportCsv} title={t('changelog.export')} aria-label={t('changelog.export')}
          style={{ width: 30, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7,
            border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer' }}>
          <Download size={14} />
        </button>
      </div>

      {loading && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('changelog.loading')}</div>}

      {!loading && error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--color-danger)' }}>
          <AlertTriangle size={14} /> {t('changelog.error')}
        </div>
      )}

      {!loading && !error && cards.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '28px 0', color: 'var(--text-muted)', textAlign: 'center' }}>
          <History size={22} style={{ opacity: 0.5 }} />
          <span style={{ fontSize: 12 }}>{t('changelog.empty')}</span>
        </div>
      )}

      {/* One card per change: "when · who · action · Field" + "old → new". */}
      {!loading && !error && cards.map((cd, i) => (
        <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)', padding: '9px 12px', marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {cd.when ? formatDate(cd.when, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
            {' · '}{cd.who}{' · '}{cd.action}
            {cd.field && <> {' · '}<span style={{ fontWeight: 600, color: 'var(--text)' }}>{cd.field}</span></>}
          </div>
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
        </div>
      ))}
    </>
  )

  // Bare = caller supplies its own chrome (the changelog popover header).
  if (bare) return body
  return <SectionCard title={t('drawer.tabs.changelog')}>{body}</SectionCard>
}
