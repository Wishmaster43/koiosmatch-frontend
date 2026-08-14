/**
 * ChangelogTab — the application's FIELD-CHANGE audit trail (icon-popover, §3A(d)).
 * Rewritten onto the same per-field diff-card shape as the vacancy ChangelogTab
 * (Danny punt 20: "ver onder de maat van HelloFlex — toont alleen 'Systeem
 * created'"): ONE card per changed field with "when · who · action · field" and
 * an old → new row, instead of the old flat description/log_name line that hid
 * every actual change behind a generic "Bijgewerkt". Distinct from the Tijdlijn
 * TAB (Timeline.tsx, fed by `application.timeline`): the tab aggregates real
 * lifecycle activity (funnel transitions, appointments, notes, AI-interviews) in
 * human terms, this icon shows the raw audit diff — tab = activiteit, icon =
 * veldwijzigingen. A pure funnel-stage transition already reads clearly on the
 * Tijdlijn tab ("Fase gewijzigd: A → B"), so it stays filtered out of THIS feed
 * to avoid showing the same transition twice with two different phrasings.
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { History, AlertTriangle, ArrowRight } from 'lucide-react'
import { useDateFormat } from '@/lib/datetime'
import { useUsers } from '@/lib/queries'
import { isUuid } from '@/lib/uuid'
import { useApplicationActivity, type ApplicationActivityEvent } from '../hooks/useApplicationActivity'
import type { ApplicationDetail } from '@/types/application'

// One rendered card: HelloFlex-style — a header line (when · who · action · field)
// plus an old → new body row, mirrors the vacancy ChangelogTab shape exactly.
interface LogCard { when?: string; who: string; action: string; field?: string; oldVal?: string | null; newVal?: string | null }

// Backend field key → a readable label when no translation key exists.
const humanizeField = (f: string) => f.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^\w/, c => c.toUpperCase())

// Bookkeeping fields carry no user meaning — never show them as diff rows.
// application_stage_id is excluded too: that transition already reads clearly on
// the Tijdlijn tab ("Fase gewijzigd: A → B"), so it never gets a second, differently
// phrased row here — not even when it changed alongside another field.
const NOISE_FIELDS = new Set(['id', 'tenant_id', 'created_at', 'updated_at', 'deleted_at', 'application_stage_id'])

const DATE_RE = /^\d{4}-\d{2}-\d{2}([T ]|$)/

// True when the ONLY field this audit entry changed is the funnel stage — that
// exact transition already has a readable row on the Tijdlijn tab, so repeating a
// bare "updated" row here would just be visual noise (dedupe, §3A(d) decision).
const isStageOnlyChange = (ev: ApplicationActivityEvent): boolean => {
  const keys = Object.keys(ev.changes?.attributes ?? {})
  return keys.length === 1 && keys[0] === 'application_stage_id'
}

// Per-field changes from the diff bag (Spatie { attributes, old } shape, same
// contract as the vacancy/candidate feeds — LogsEntityActivity, CHANGELOG-3).
const changesOf = (ev: ApplicationActivityEvent): Array<{ field: string; old: unknown; next: unknown }> => {
  const attrs = ev.changes?.attributes
  if (!attrs || typeof attrs !== 'object') return []
  const old = ev.changes?.old ?? {}
  return Object.keys(attrs)
    .filter(field => !NOISE_FIELDS.has(field))
    .map(field => ({ field, old: old[field], next: attrs[field] }))
}

export default function ChangelogTab({ application: a }: { application: ApplicationDetail }) {
  const { t } = useTranslation('applications')
  const { formatDate } = useDateFormat()
  const { items: rawItems, loading, error } = useApplicationActivity(a?.id)
  // owner_id is the one recurring raw uuid on this entity's diff bag — resolve it
  // against the tenant's users so "Recruiter — bijgewerkt" becomes the actual name
  // (Danny punt 20/30: never a raw id when a name is available elsewhere).
  const { data: users = [] } = useUsers() as { data?: { id: unknown; name: string }[] }

  const fieldLabel = (f: string) => t(`changelog.fields.${f}`, { defaultValue: humanizeField(f) })

  const fmtVal = (field: string, val: unknown): string | null => {
    if (val === null || val === undefined || val === '') return t('changelog.emptyValue')
    if (typeof val === 'boolean') return val ? t('common:yes') : t('common:no')
    if (field === 'owner_id') {
      const found = users.find(u => String(u.id) === String(val))
      return found?.name || t('changelog.updatedValue')
    }
    if (Array.isArray(val)) return val.length ? val.map(String).join(', ') : t('changelog.emptyValue')
    if (typeof val === 'object') return JSON.stringify(val)
    const s = String(val)
    if (isUuid(s)) return null
    if (DATE_RE.test(s)) return formatDate(s)
    return s
  }

  // Bare Spatie verbs become readable ("Bijgewerkt"); a human description wins.
  const actionOf = (ev: ApplicationActivityEvent): string => {
    const d = ev.description
    if (d && !['updated', 'created', 'deleted', 'restored', ev.log_name].includes(d)) return d
    const verb = d ?? 'updated'
    return t(`changelog.actions.${verb}`, { defaultValue: d ?? verb })
  }

  // Flatten entries → HelloFlex-style cards (one per field change), newest first,
  // dropping stage-only rows the Tijdlijn tab already covers.
  const cards = useMemo<LogCard[]>(() => {
    return rawItems
      .filter(ev => !isStageOnlyChange(ev))
      .flatMap((ev): LogCard[] => {
        const base = { when: ev.created_at, who: ev.causer_name || t('changelog.system'), action: actionOf(ev) }
        const diffs = changesOf(ev)
        if (!diffs.length) return [base]
        const isCreate = ev.description === 'created'
        return diffs
          .map(ch => ({ ...base, field: fieldLabel(ch.field), oldVal: fmtVal(ch.field, ch.old), newVal: fmtVal(ch.field, ch.next) }))
          // No "Leeg → Leeg" rows; a CREATE only lists fields that actually got a value.
          .filter(cd => cd.oldVal !== cd.newVal)
          .filter(cd => !isCreate || cd.newVal !== t('changelog.emptyValue'))
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t/users are stable enough per render
  }, [rawItems, users])

  return (
    <div>
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
            {' · '}<span>{cd.who}</span>{' · '}<span>{cd.action}</span>
            {cd.field && <> {' · '}<span style={{ fontWeight: 600, color: 'var(--text)' }}>{cd.field}</span></>}
          </div>
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
    </div>
  )
}
