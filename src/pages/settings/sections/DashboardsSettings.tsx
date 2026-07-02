/**
 * DashboardsSettings — Settings → Dashboards. Per dashboard_type you see the KPI row
 * and the charts/lists that role gets (from the dashboard config, templates.ts), and
 * you can switch any of them ON/OFF for that role. Everything is on by default; toggling
 * only hides. Persisted tenant-wide via the shared settings store (`dashboard_hidden`),
 * which the live dashboards read — no page reload needed. The live preview stays the
 * topbar switcher; the role→type coupling is managed under Roles.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Shield, BarChart2, Users, ClipboardList, Target, Clock, Eye } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAllSettings, getJsonSetting, saveSettingsKeys } from '@/lib/settings/useAllSettings'
import {
  DASHBOARD_TYPES, KPI_ROWS, DASHBOARD_TEMPLATES, KPI_LABEL_KEY, BLOCK_LABEL_KEY, canSwitchViews,
  type DashboardType,
} from '@/pages/dashboard/templates'

// Per-type icon (calm, one accent). Labels/descriptions come from i18n, never hardcoded.
const TYPE_ICON: Record<DashboardType, LucideIcon> = {
  admin: Shield, management: BarChart2, recruitment: Users,
  backoffice: ClipboardList, sales: Target, planning: Clock, readonly: Eye,
}

// Shape of the persisted override: hidden KPI/block ids per dashboard type.
type HiddenMap = Record<string, { kpis?: string[]; blocks?: string[] }>
const KEY = 'dashboard_hidden'

// The block ids a type shows: '*' (admin/management) = every known block, else the template list.
const blocksFor = (type: DashboardType): string[] => {
  const tpl = DASHBOARD_TEMPLATES[type] ?? []
  return tpl.includes('*') ? Object.keys(BLOCK_LABEL_KEY) : tpl
}

export default function DashboardsSettings() {
  const { t } = useTranslation('settings')
  const { t: td } = useTranslation('dashboard')

  // Local mirror of the saved overrides; re-syncs when the settings blob changes.
  const settings = useAllSettings()
  const saved = getJsonSetting<HiddenMap>(settings, KEY, {})
  const [hidden, setHidden] = useState<HiddenMap>(saved)
  const savedKey = JSON.stringify(saved)
  const [prevKey, setPrevKey] = useState(savedKey)
  if (savedKey !== prevKey) { setPrevKey(savedKey); setHidden(saved) }

  // Is this KPI/block switched off for the role?
  const isHidden = (type: string, kind: 'kpis' | 'blocks', id: string) => (hidden[type]?.[kind] ?? []).includes(id)

  // Toggle one item on/off for a role and persist (optimistic; dashboards update live).
  const toggle = (type: string, kind: 'kpis' | 'blocks', id: string) => {
    setHidden(prev => {
      const forType = prev[type] ?? {}
      const list = forType[kind] ?? []
      const nextList = list.includes(id) ? list.filter(x => x !== id) : [...list, id]
      const next = { ...prev, [type]: { ...forType, [kind]: nextList } }
      saveSettingsKeys({ [KEY]: next }).catch(() => {})
      return next
    })
  }

  // A toggle chip — on = tinted/bold, off = muted + strikethrough (still readable).
  const Chip = ({ type, kind, id, label }: { type: string; kind: 'kpis' | 'blocks'; id: string; label: string }) => {
    const off = isHidden(type, kind, id)
    const tone = kind === 'kpis' ? 'var(--color-primary)' : 'var(--text)'
    return (
      <button
        type="button"
        onClick={() => toggle(type, kind, id)}
        aria-pressed={!off}
        title={off ? t('dashboardsToggleOn') : t('dashboardsToggleOff')}
        style={{
          fontSize: 12, padding: '3px 10px', borderRadius: 999, cursor: 'pointer',
          background: off ? 'transparent' : `color-mix(in srgb, ${tone} 12%, transparent)`,
          border: `1px solid color-mix(in srgb, ${tone} ${off ? 20 : 34}%, transparent)`,
          color: off ? 'var(--text-muted)' : tone,
          fontWeight: off ? 400 : 600, textDecoration: off ? 'line-through' : 'none', opacity: off ? 0.7 : 1,
          whiteSpace: 'nowrap',
        }}
      >{label}</button>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 860 }}>
      {/* Intro — how toggling works + where to preview / couple roles. */}
      <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        <p style={{ margin: 0 }}>{t('dashboardsIntro')}</p>
        <p style={{ margin: '6px 0 0' }}>· {t('dashboardsToggleHint')}</p>
        <p style={{ margin: '2px 0 0' }}>· {t('dashboardsPreviewHint')}</p>
        <p style={{ margin: '2px 0 0' }}>· {t('dashboardsRoleHint')}</p>
      </div>

      {/* One card per dashboard type. */}
      {DASHBOARD_TYPES.map(type => {
        const Icon = TYPE_ICON[type]
        const kpis = KPI_ROWS[type] ?? []
        const blocks = blocksFor(type)
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

            {/* KPI row — toggle each on/off. */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>{t('dashboardsKpis')}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {kpis.map(id => <Chip key={id} type={type} kind="kpis" id={id} label={KPI_LABEL_KEY[id] ? td(KPI_LABEL_KEY[id]) : id} />)}
              </div>
            </div>

            {/* Charts & lists — toggle each on/off. */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>{t('dashboardsBlocks')}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {blocks.map(id => <Chip key={id} type={type} kind="blocks" id={id} label={BLOCK_LABEL_KEY[id] ? td(BLOCK_LABEL_KEY[id]) : id} />)}
              </div>
            </div>
          </section>
        )
      })}
    </div>
  )
}
