/**
 * Audit-log shared bits — log-type badge colours (LOG_NAME_META), the KPI keys, the
 * LogBadge chip, entity-name humanising, and the CHANGELOG-3 field-diff generaliser
 * (buildFieldDiff/isAccessEvent). Shared by the table (AuditLog) and the drill-down
 * (AuditDrawer) so both render the exact same uniform activity shape as the
 * per-entity changelog popovers (mirrors pages/candidates/drawer/ChangelogTab.tsx).
 */
import { useTranslation } from 'react-i18next'

// Log type → badge colour. Label = t('audit.logName.<key>'). Entity-table log names
// (candidates, vacancies, …) intentionally fall back to the neutral default below —
// that reads as "a record change" at a glance, distinct from these system domains.
export const LOG_NAME_META = {
  auth:      { bg: 'var(--color-secondary-bg)', color: 'var(--color-secondary)' },
  http:      { bg: 'var(--hover-bg)', color: 'var(--text-muted)' },
  sync:      { bg: 'var(--color-secondary-bg)', color: 'var(--color-secondary)' },
  // roles/modules/ai share the violet token (system/AI-ish domains).
  roles:     { bg: 'var(--color-violet-bg)', color: 'var(--color-violet)' },
  settings:  { bg: 'var(--color-success-bg)', color: 'var(--color-success)' },
  users:     { bg: 'var(--color-warning-bg)', color: 'var(--color-warning)' },
  apps:      { bg: 'var(--color-warning-bg)', color: 'var(--color-warning)' },
  modules:   { bg: 'var(--color-violet-bg)', color: 'var(--color-violet)' },
  workflows: { bg: 'var(--color-primary-bg)', color: 'var(--color-primary)' },
  webhooks:  { bg: 'var(--color-info-bg)', color: 'var(--color-info)' },
  ai:        { bg: 'var(--color-violet-bg)', color: 'var(--color-violet)' },
}

// Settings keys shown in diffs — known KPI keys get a friendly label via t('audit.kpi.*').
export const KPI_KEYS = ['new_candidates_target', 'churn_warning_threshold', 'avg_candidates_window', 'occupancy_target', 'response_rate_target']

// Bookkeeping fields carry no audit meaning — never show them as diff rows (mirrors
// ChangelogTab's NOISE_FIELDS; kept in sync manually — a shared lib is a follow-up
// if the two ever need to diverge less).
export const NOISE_FIELDS = new Set(['id', 'tenant_id', 'external_id', 'updated_at', 'created_at', 'deleted_at', 'remember_token', 'password', 'uuid'])

// Backend field key → a readable fallback label when no audit.field.<key> translation exists.
const humanizeField = (f) => f.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^\w/, c => c.toUpperCase())

// True for a read-access entry (the AVG "Dossier geopend/ingezien" compliance log,
// LogsDossierAccess) — these never carry an old→new diff and render/filter distinctly
// from write events (created/updated/deleted).
export function isAccessEvent(entry) {
  return entry?.event === 'viewed'
}

// Humanise a Spatie subject_type ("App\\Models\\Candidate") to a readable entity label.
export function entityLabel(subjectType, t) {
  if (!subjectType) return null
  const base = String(subjectType).split('\\').pop()
  const key = base.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
  return t(`audit.entity.${key}`, { defaultValue: base })
}

// The uniform CHANGELOG-3 diff (`entry.changes = {attributes, old}`) flattened to
// renderable rows — SAME rules as the per-entity changelog popover (ChangelogTab):
// noise fields dropped, unchanged values dropped, and a CREATE event only lists
// fields that actually got a value. Sensitive/encrypted values already arrive masked
// from the backend (Activity::changesForDisplay, §8/§9) — rendered verbatim here.
export function buildFieldDiff(entry, t) {
  const changes = entry?.changes
  const attrs = changes?.attributes
  if (!attrs || typeof attrs !== 'object' || Array.isArray(attrs)) return []
  const before = (changes?.old && typeof changes.old === 'object') ? changes.old : {}
  const isCreate = entry?.event === 'created'
  const empty = t('audit.emptyValue', { defaultValue: 'Empty' })
  const fmt = (v) => {
    if (v === null || v === undefined || v === '') return empty
    if (typeof v === 'boolean') return v ? t('common:yes') : t('common:no')
    if (Array.isArray(v)) return v.length ? v.join(', ') : empty
    // A nested object (e.g. a vacancy's match_weights json) has no single readable
    // form — show it as compact JSON rather than the useless "[object Object]".
    if (typeof v === 'object') return JSON.stringify(v)
    return String(v)
  }
  return Object.keys(attrs)
    .filter(field => !NOISE_FIELDS.has(field))
    .map(field => ({ field, label: t(`audit.field.${field}`, { defaultValue: humanizeField(field) }), before: fmt(before[field]), after: fmt(attrs[field]) }))
    .filter(row => row.before !== row.after)
    .filter(row => !isCreate || row.after !== empty)
}

export function LogBadge({ logName }) {
  const { t } = useTranslation('settings')
  const m = LOG_NAME_META[logName] ?? { bg: 'var(--border)', color: 'var(--text-muted)' }
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 999,
                   background: m.bg, color: m.color, whiteSpace: 'nowrap' }}>
      {t(`audit.logName.${logName}`, { defaultValue: logName })}
    </span>
  )
}

