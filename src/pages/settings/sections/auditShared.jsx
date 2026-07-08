/**
 * Audit-log shared bits — log-type badge colours (LOG_NAME_META), the KPI keys, and
 * the LogBadge chip. Shared by the table (AuditLog) and the drill-down (AuditDrawer).
 */
import { useTranslation } from 'react-i18next'

// Log type → badge colour. Label = t('audit.logName.<key>').
export const LOG_NAME_META = {
  auth:      { bg: 'var(--color-secondary-bg)', color: 'var(--color-secondary)' },
  http:      { bg: 'var(--hover-bg)', color: 'var(--text-muted)' },
  sync:      { bg: 'var(--color-secondary-bg)', color: 'var(--color-secondary)' },
  // roles/modules/ai keep literal violet hues — no violet design token exists yet (follow-up: add one).
  roles:     { bg: '#F5F3FF', color: '#6D28D9' },
  settings:  { bg: 'var(--color-success-bg)', color: 'var(--color-success)' },
  users:     { bg: 'var(--color-warning-bg)', color: 'var(--color-warning)' },
  apps:      { bg: 'var(--color-warning-bg)', color: 'var(--color-warning)' },
  modules:   { bg: '#F5F3FF', color: '#7C3AED' },
  workflows: { bg: 'var(--color-primary-bg)', color: 'var(--color-primary)' },
  webhooks:  { bg: 'var(--color-info-bg)', color: 'var(--color-info)' },
  ai:        { bg: '#FDF4FF', color: '#9333EA' },
}

// Settings keys shown in diffs — known KPI keys get a friendly label via t('audit.kpi.*').
export const KPI_KEYS = ['new_candidates_target', 'churn_warning_threshold', 'avg_candidates_window', 'occupancy_target', 'response_rate_target']

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

