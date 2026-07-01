/**
 * DashboardSwitcher — segmented control to switch the dashboard view between role
 * templates. Only shown when the user may see more than one (super-admin + the
 * management dashboard may see everything); a single-type user gets no switcher.
 */
import { useTranslation } from 'react-i18next'
import { LayoutDashboard } from 'lucide-react'
import type { DashboardType } from './templates'

export default function DashboardSwitcher({ value, options, onChange }: {
  value: DashboardType
  options: DashboardType[]
  onChange: (type: DashboardType) => void
}) {
  const { t } = useTranslation('dashboard')
  if (options.length <= 1) return null

  return (
    <div role="group" aria-label={t('switcher.label')}
      style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <LayoutDashboard size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      <div style={{ display: 'flex', gap: 2, background: 'var(--hover-bg)', borderRadius: 8, padding: 2 }}>
        {options.map(opt => {
          const active = opt === value
          return (
            <button key={opt} onClick={() => onChange(opt)} aria-pressed={active}
              style={{ padding: '5px 12px', fontSize: 12, fontWeight: active ? 600 : 400, borderRadius: 6,
                border: 'none', cursor: 'pointer',
                background: active ? 'var(--surface)' : 'transparent',
                color: active ? 'var(--text)' : 'var(--text-muted)',
                boxShadow: active ? '0 1px 2px rgba(0,0,0,0.08)' : 'none' }}>
              {t(`types.${opt}`)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
