/**
 * DashboardsSettings — Settings → Dashboards. Per dashboard_type you see the KPI row
 * and the charts/lists that role gets (from the dashboard config, templates.ts), and
 * you can switch any of them ON/OFF for that role. Everything is on by default; toggling
 * only hides. Persisted tenant-wide via the shared settings store (`dashboard_hidden`),
 * which the live dashboards read — no page reload needed. The live preview stays the
 * topbar switcher; the role→type coupling is managed under Roles.
 *
 * DASH-SET-UI-1 (Danny "ziet er niet uit"): the original chip-brij (two mixed chip
 * styles, no visible on/off state, the raw `openVacancies` id leaking as a label) was
 * already replaced by the DASH-MATRIX-1/DASH-SUBTABS-1 matrix rework — verified against
 * git history, kept as-is here since it's Danny's more recent, explicit direction ("een
 * tabel of iets?"). This pass finishes what was still open on THIS file: each matrix now
 * sits in the shared SectionCard (§11 reuse, was hand-rolled), the toggle explicitly
 * mirrors ChipMultiSelect's chosen/unchosen convention (§4), loading/empty/success are
 * handled explicitly (§3), and the toggle→save request body is covered by a test (§13).
 * The `openVacancies` label-key fix itself lives in templates.ts (out of scope here,
 * confirmed already fixed there — KPI_LABEL_KEY.openVacancies → 'kpi.openVacancies',
 * present in all 5 locale files).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Shield, BarChart2, Users, ClipboardList, Target, UserCog, Building2, Clock, Eye, Check } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAllSettings, useSettingsLoaded, getJsonSetting, saveSettingsKeys } from '@/lib/settings/useAllSettings'
import SubTabBar from '@/components/drawer/SubTabBar'
import SectionCard from '@/components/ui/SectionCard'
import { DASHBOARD_TYPES, KPI_ROWS, DASHBOARD_TEMPLATES, KPI_LABEL_KEY, BLOCK_LABEL_KEY, canSwitchViews, type DashboardType } from '@/pages/dashboard/shared'

// Per-type icon (calm, one accent). Labels/descriptions come from i18n, never hardcoded.
const TYPE_ICON: Record<DashboardType, LucideIcon> = {
  admin: Shield, management: BarChart2, recruitment: Users,
  // DASHBOARD-KIEZER-1 — the new team-wide manager view (own-scope `recruitment`'s counterpart).
  recruitment_manager: UserCog,
  backoffice: ClipboardList, sales: Target,
  // KD11 (DASHP36) — the two new sales-dashboard roles.
  accountmanager: UserCog, sales_manager: Building2,
  planning: Clock, readonly: Eye,
}

// Shape of the persisted override: hidden KPI/block ids per dashboard type.
type HiddenMap = Record<string, { kpis?: string[]; blocks?: string[] }>
// Exported so the test asserts the exact save-request body (§13) without a
// duplicated string literal — Dashboard.tsx (the live reader) keeps its own
// literal, this is only the settings-editor's write side.
export const DASHBOARD_HIDDEN_KEY = 'dashboard_hidden'
const KEY = DASHBOARD_HIDDEN_KEY

// The block ids a type shows: '*' (admin/management) = every known block, else the template list.
const blocksFor = (type: DashboardType): string[] => {
  const tpl = DASHBOARD_TEMPLATES[type] ?? []
  return tpl.includes('*') ? Object.keys(BLOCK_LABEL_KEY) : tpl
}

// Shared table-cell styles — static, no render-scoped dependency, so they live at
// module level alongside the (also module-level) Matrix/Cell components that use them.
const stickyCell = {
  position: 'sticky' as const, left: 0, background: 'var(--surface)', zIndex: 1,
  textAlign: 'left' as const, padding: '8px 12px', borderBottom: '1px solid var(--hover-bg)',
  fontSize: 12.5, color: 'var(--text)', whiteSpace: 'nowrap' as const,
}
const cell = { textAlign: 'center' as const, padding: '6px 8px', borderBottom: '1px solid var(--hover-bg)' }

// Props for one toggle dot — hoisted to module level (react-hooks/static-components):
// hidden/toggle state and the translation function are no longer closures, they're
// explicit props computed by the caller (Matrix) from its own props.
interface CellProps {
  applies: boolean
  on: boolean
  onToggle: () => void
  t: TFunction
}

// One toggle dot: mirrors ChipMultiSelect's chosen/unchosen convention (§4, DASH-SET-UI-1)
// — unchosen stays fully neutral (no tint, a plain `var(--border)` ring) so the state
// reads at a glance and never relies on colour alone (§6); chosen gets the §4 soft
// primary tint + a check. Circular, not a pill, since a matrix cell carries no label
// text. Dash = this KPI/block does not apply to this dashboard type at all.
function Cell({ applies, on, onToggle, t }: CellProps) {
  if (!applies) {
    return <td style={cell}><span style={{ color: 'var(--border)' }}>—</span></td>
  }
  return (
    <td style={cell}>
      {/* Icon-only control: aria-label is the accessible name (§6) — title alone
          is an unreliable fallback for assistive tech. */}
      <button type="button" onClick={onToggle}
        title={on ? t('dashboardsToggleOff') : t('dashboardsToggleOn')}
        aria-label={on ? t('dashboardsToggleOff') : t('dashboardsToggleOn')}
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

// Props for one matrix table — hoisted to module level (react-hooks/static-components):
// isHidden/onToggle carry the state that used to be closed over, t/td the two
// translation namespaces the table needs (settings labels + dashboard type names).
interface MatrixProps {
  kind: 'kpis' | 'blocks'
  rows: string[]
  title: string
  labelKey: Record<string, string>
  isHidden: (type: string, kind: 'kpis' | 'blocks', id: string) => boolean
  onToggle: (type: string, kind: 'kpis' | 'blocks', id: string) => void
  t: TFunction
  td: TFunction
}

// aria-label makes each matrix a named region (§6) — disambiguating it from the
// identically-labelled sub-tab for assistive tech and the tests.
function Matrix({ kind, rows, title, labelKey, isHidden, onToggle, t, td }: MatrixProps) {
  // Empty state (§3): defensive — `rows` comes from a static catalog (templates.ts) so
  // this is unreachable today, but a settings card must never silently render a blank
  // table if that ever changes.
  if (rows.length === 0) {
    return (
      <section aria-label={title}>
        <SectionCard title={title}>
          <p style={{ margin: 0, padding: '8px 0', fontSize: 12.5, color: 'var(--text-muted)' }}>{t('dashboardsEmpty')}</p>
        </SectionCard>
      </section>
    )
  }
  return (
    // DASH-SET-UI-1: reuse the shared SectionCard (§11) instead of a hand-rolled bordered
    // div — gives the matrix real card hierarchy (muted title outside, bordered body),
    // matching every other Settings screen. The named <section> keeps the accessible
    // region name (§6) the sub-tab switch and the tests rely on.
    <section aria-label={title}>
      <SectionCard title={title} style={{ padding: 0, overflow: 'hidden' }}>
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
                          {canSwitchViews(type) && <span title={t('dashboardsCanSwitch')} style={{ color: 'var(--color-success-text)' }}> ●</span>}
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
                  {DASHBOARD_TYPES.map(type => {
                    const applies = kind === 'kpis' ? (KPI_ROWS[type] ?? []).includes(id) : blocksFor(type).includes(id)
                    return (
                      <Cell key={type} applies={applies} on={!isHidden(type, kind, id)}
                        onToggle={() => onToggle(type, kind, id)} t={t} />
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </section>
  )
}

export default function DashboardsSettings() {
  const { t } = useTranslation('settings')
  const { t: td } = useTranslation('dashboard')

  // Local mirror of the saved overrides; re-syncs when the settings blob changes.
  const settings = useAllSettings()
  // Has the tenant blob resolved at least once? Without this, `saved` reads as `{}`
  // (nothing hidden) before the fetch lands — every toggle would flash ON, then some
  // could jump OFF once the real overrides arrive. useAllSettings tolerates a failed
  // fetch by staying on the last-known cache (documented there), so there is no
  // separate "error" state to surface here — loading/empty/success are the three
  // states this screen can genuinely report (§3).
  const settingsLoaded = useSettingsLoaded()
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

  // Loading state (§3) — all hooks above have already run, so this early return keeps
  // hook order stable across renders while still avoiding the on-then-off toggle flash.
  if (!settingsLoaded) {
    return <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>{t('common.loading')}</div>
  }

  // DASH-MATRIX-1 (Danny 24-07 "een tabel of iets?"): the 7 stacked chip-cards became
  // TWO matrix tables — rows = items, columns = dashboard types, cells = toggles.
  // Same visual language as the roles/action-rule matrices Danny already uses.
  const allKpis = [...new Set(DASHBOARD_TYPES.flatMap(type => KPI_ROWS[type] ?? []))]
  const allBlocks = [...new Set(DASHBOARD_TYPES.flatMap(blocksFor))]

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
        <Matrix kind="kpis" rows={allKpis} title={t('dashboardsKpis')} labelKey={KPI_LABEL_KEY}
          isHidden={isHidden} onToggle={toggle} t={t} td={td} />
      )}
      {activeTab === 'blocks' && (
        <Matrix kind="blocks" rows={allBlocks} title={t('dashboardsBlocks')} labelKey={BLOCK_LABEL_KEY}
          isHidden={isHidden} onToggle={toggle} t={t} td={td} />
      )}
    </div>
  )
}
