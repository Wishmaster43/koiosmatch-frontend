/**
 * DashboardsSettings — Settings → Dashboards. A read-only, self-documenting overview
 * of every role dashboard (B-27): per dashboard_type it lists the KPI row and the
 * charts/lists that role sees, straight from the dashboard config (templates.ts) so
 * it can never drift from the real dashboard. The live preview is the topbar switcher
 * (admin/management); the role→type coupling is managed under Roles — both linked here.
 */
import { useTranslation } from 'react-i18next'
import { Shield, BarChart2, Users, ClipboardList, Target, Clock, Eye } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  DASHBOARD_TYPES, KPI_ROWS, DASHBOARD_TEMPLATES, KPI_LABEL_KEY, BLOCK_LABEL_KEY, canSwitchViews,
  type DashboardType,
} from '@/pages/dashboard/templates'

// Per-type icon (calm, one accent). Labels/descriptions come from i18n, never hardcoded.
const TYPE_ICON: Record<DashboardType, LucideIcon> = {
  admin: Shield, management: BarChart2, recruitment: Users,
  backoffice: ClipboardList, sales: Target, planning: Clock, readonly: Eye,
}

// A soft chip (tinted, never a solid fill) — matches the entity soft-chip convention.
function Chip({ label, tone }: { label: string; tone: 'kpi' | 'block' }) {
  const c = tone === 'kpi' ? 'var(--color-primary)' : 'var(--text-muted)'
  return (
    <span style={{
      fontSize: 12, padding: '3px 10px', borderRadius: 999,
      background: `color-mix(in srgb, ${c} 12%, transparent)`,
      border: `1px solid color-mix(in srgb, ${c} 32%, transparent)`,
      color: c, whiteSpace: 'nowrap',
    }}>{label}</span>
  )
}

export default function DashboardsSettings() {
  const { t } = useTranslation('settings')
  // Dashboard-namespace translator for the KPI/block labels (single source: templates.ts maps).
  const { t: td } = useTranslation('dashboard')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 860 }}>
      {/* Intro — where to preview + where the role coupling lives. */}
      <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        <p style={{ margin: 0 }}>{t('dashboardsIntro')}</p>
        <p style={{ margin: '6px 0 0' }}>· {t('dashboardsPreviewHint')}</p>
        <p style={{ margin: '2px 0 0' }}>· {t('dashboardsRoleHint')}</p>
      </div>

      {/* One card per dashboard type. */}
      {DASHBOARD_TYPES.map(type => {
        const Icon = TYPE_ICON[type]
        const kpis = KPI_ROWS[type] ?? []
        const tpl = DASHBOARD_TEMPLATES[type] ?? []
        const showsAll = tpl.includes('*')
        return (
          <section key={type} style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', padding: 16 }}>
            {/* Header: icon + type label + a "can switch" badge for the super views. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={16} color="var(--color-primary)" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{td(`types.${type}`)}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t(`dashboardsDesc.${type}`)}</div>
              </div>
              {canSwitchViews(type) && (
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, color: 'var(--color-success)', background: 'color-mix(in srgb, var(--color-success) 14%, transparent)' }}>
                  {t('dashboardsCanSwitch')}
                </span>
              )}
            </div>

            {/* KPI row. */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>{t('dashboardsKpis')}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {kpis.map(id => <Chip key={id} tone="kpi" label={KPI_LABEL_KEY[id] ? td(KPI_LABEL_KEY[id]) : id} />)}
              </div>
            </div>

            {/* Charts & lists. */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>{t('dashboardsBlocks')}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {showsAll
                  ? <Chip tone="block" label={t('dashboardsAll')} />
                  : tpl.map(id => <Chip key={id} tone="block" label={BLOCK_LABEL_KEY[id] ? td(BLOCK_LABEL_KEY[id]) : id} />)}
              </div>
            </div>
          </section>
        )
      })}
    </div>
  )
}
