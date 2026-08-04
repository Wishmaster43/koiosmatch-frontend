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
import { Shield, BarChart2, Users, ClipboardList, Target, Clock, Eye, Check } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAllSettings, getJsonSetting, saveSettingsKeys } from '@/lib/settings/useAllSettings'
import SubTabBar from '@/components/drawer/SubTabBar'
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

  // DASH-SUBTABS-1 (Danny 04-08 "lijst is te lang met 2 tabellen dus moet
  // Grafieken & lijsten subtabje worden"): the two stacked matrices become two
  // sub-tabs — one table on screen at a time, same shared underline SubTabBar.
  const [activeTab, setActiveTab] = useState<'kpis' | 'blocks'>('kpis')

  // DASH-MATRIX-1 (Danny 24-07 "een tabel of iets?"): the 7 stacked chip-cards became
  // TWO matrix tables — rows = items, columns = dashboard types, cells = toggles.
  // Same visual language as the roles/action-rule matrices Danny already uses.
  const allKpis = [...new Set(DASHBOARD_TYPES.flatMap(type => KPI_ROWS[type] ?? []))]
  const allBlocks = [...new Set(DASHBOARD_TYPES.flatMap(blocksFor))]

  const stickyCell = {
    position: 'sticky' as const, left: 0, background: 'var(--surface)', zIndex: 1,
    textAlign: 'left' as const, padding: '8px 12px', borderBottom: '1px solid var(--hover-bg)',
    fontSize: 12.5, color: 'var(--text)', whiteSpace: 'nowrap' as const,
  }
  const cell = { textAlign: 'center' as const, padding: '6px 8px', borderBottom: '1px solid var(--hover-bg)' }

  // One toggle dot: check (on) / empty ring (off) / dash (not applicable for this type).
  const Cell = ({ type, kind, id, applies }: { type: string; kind: 'kpis' | 'blocks'; id: string; applies: boolean }) => {
    if (!applies) {
      return <td style={cell}><span style={{ color: 'var(--border)' }}>—</span></td>
    }
    const on = !isHidden(type, kind, id)
    return (
      <td style={cell}>
        <button type="button" onClick={() => toggle(type, kind, id)}
          title={on ? t('dashboardsToggleOff') : t('dashboardsToggleOn')}
          aria-pressed={on}
          style={{ width: 24, height: 24, borderRadius: '50%', cursor: 'pointer', display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center',
            border: `1.5px solid ${on ? 'var(--color-primary)' : 'var(--border)'}`,
            background: on ? 'color-mix(in srgb, var(--color-primary) 14%, transparent)' : 'transparent' }}>
          {on && <Check size={13} color="var(--color-primary)" />}
        </button>
      </td>
    )
  }

  // aria-label makes each matrix a named region (§6) — disambiguating it from the
  // identically-labelled sub-tab for assistive tech and the tests.
  const Matrix = ({ kind, rows, title, labelKey }: {
    kind: 'kpis' | 'blocks'; rows: string[]; title: string; labelKey: Record<string, string>
  }) => (
    <section aria-label={title} style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', overflow: 'hidden' }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{title}</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...stickyCell, fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>
                {t('dashboardsItem')}
              </th>
              {DASHBOARD_TYPES.map(type => {
                const Icon = TYPE_ICON[type]
                return (
                  <th key={type} title={t(`dashboardsDesc.${type}`)}
                    style={{ ...cell, borderBottom: '1px solid var(--border)', padding: '10px 8px', minWidth: 76 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <Icon size={14} color="var(--color-primary)" />
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>
                        {td(`types.${type}`)}
                        {/* Super views (admin/management) may switch dashboards live. */}
                        {canSwitchViews(type) && <span title={t('dashboardsCanSwitch')} style={{ color: 'var(--color-success)' }}> ●</span>}
                      </span>
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map(id => (
              <tr key={id}>
                <td style={stickyCell}>{labelKey[id] ? td(labelKey[id]) : id}</td>
                {DASHBOARD_TYPES.map(type => (
                  <Cell key={type} type={type} kind={kind} id={id}
                    applies={kind === 'kpis' ? (KPI_ROWS[type] ?? []).includes(id) : blocksFor(type).includes(id)} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1000 }}>
      <SubTabBar
        tabs={[
          { id: 'kpis', label: t('dashboards.tabs.kpis') },
          { id: 'blocks', label: t('dashboards.tabs.blocks') },
        ]}
        active={activeTab}
        onChange={(id) => setActiveTab(id as 'kpis' | 'blocks')}
      />

      {activeTab === 'kpis' && (
        <Matrix kind="kpis" rows={allKpis} title={t('dashboardsKpis')} labelKey={KPI_LABEL_KEY} />
      )}
      {activeTab === 'blocks' && (
        <Matrix kind="blocks" rows={allBlocks} title={t('dashboardsBlocks')} labelKey={BLOCK_LABEL_KEY} />
      )}
    </div>
  )
}
