/**
 * DashboardsSettings — Settings → Dashboards. Per dashboard_type you see the KPI row
 * and the charts/lists that role gets (from the dashboard config, templates.ts), and
 * you can switch any of them ON/OFF for that role. Everything is on by default; toggling
 * only hides. The role→type coupling is managed under Roles.
 *
 * K3-REFIT-1 (K-173 phase 4, LIVE): the KPI matrix + Volgorde tab now read/write the
 * dedicated catalog endpoints instead of the generic settings blob —
 *   - GET /dashboard/kpi-catalog → { available: [{key,label,counts,scope,drills_to}], defaults }
 *     is the ONE source for the per-KPI uitleg line (the five local `dashboardsExplain`
 *     copies are gone).
 *   - GET/PUT /dashboard/kpis/{role} carries ONE ordered list per role: presence = on,
 *     position = order, omission = hidden. This is now the write path for KPI
 *     visibility/order; the old `dashboard_hidden`/`dashboard_kpi_order` settings keys
 *     stay as a READ-ONLY fallback per role only while that role's new GET comes back
 *     empty (migration window — remove the fallback once CMBE backfills every role).
 * The BLOCKS matrix (charts/lists) has no equivalent catalog yet, so it keeps the
 * original settings-blob path untouched.
 *
 * ROLE MAPPING: the new endpoints only know six roles — 'default', 'recruitment',
 * 'recruitment_manager', 'accountmanager', 'sales_manager', 'backoffice' — while this
 * screen's matrix has ten DASHBOARD_TYPES columns. Five DashboardType ids are exact
 * string matches for a specific API role; every other type (admin, management, sales,
 * planning, readonly) has no dedicated role in the contract, so it shares the literal
 * 'default' row (brief: "de default-rol heet letterlijk 'default'"). Concretely: those
 * five types' KPI on/off + order all point at the SAME server-side list — toggling one
 * of them changes it for the others too. That is an intrinsic property of the six-role
 * contract, not a bug introduced here; flag it to CMBE if that turns out unwanted.
 */
import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Shield, BarChart2, Users, ClipboardList, Target, UserCog, Building2, Clock, Eye, Check } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAllSettings, useSettingsLoaded, getJsonSetting, saveSettingsKeys } from '@/lib/settings/useAllSettings'
import { useAuth } from '@/context/AuthContext'
import SubTabBar from '@/components/drawer/SubTabBar'
import SectionCard from '@/components/ui/SectionCard'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { DragList } from '../components/SettingsControls'
import { Caption, BodyText, GroupLabel, groupLabelStyle } from '@/components/ui/typography'
import { tintBg, tintBorder, chipInk } from '@/lib/tint'
import {
  fetchDashboardKpiCatalog, fetchDashboardKpisRole, putDashboardKpisRole,
  type DashboardKpiCatalogEntry,
} from './dashboardsKpiApi'

// The chosen-cell tint source — indirected like ChipMultiSelect's `tint` so the
// accent token never appears as a raw background value in a component (§4).
const cellTint = 'var(--color-primary)'
import { DASHBOARD_TYPES, KPI_ROWS, DASHBOARD_TEMPLATES, KPI_LABEL_KEY, BLOCK_LABEL_KEY, canSwitchViews, type DashboardType } from '@/pages/dashboard/shared'
// DASH-VOLGORDE-1: reuse the reports domain's pure order-resolver (§2 public
// surface) instead of a second copy of its unknown-id-drop/backfill logic.
import { resolveReportKpiOrder } from '@/pages/reports/shared'

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

// The six roles the new KPI-catalog endpoints know (K3-REFIT-1 header). Five match a
// DashboardType string exactly; anything else falls back to the literal 'default' row.
const SPECIFIC_API_ROLES = ['recruitment', 'recruitment_manager', 'accountmanager', 'sales_manager', 'backoffice'] as const
const API_ROLES = ['default', ...SPECIFIC_API_ROLES] as const
type ApiRole = typeof API_ROLES[number]
const toApiRole = (type: DashboardType): ApiRole =>
  (SPECIFIC_API_ROLES as readonly string[]).includes(type) ? (type as ApiRole) : 'default'

// Shape of the persisted override: hidden KPI/block ids per dashboard type. Only
// still used for BLOCKS (no catalog yet) and as the per-role KPI read fallback.
type HiddenMap = Record<string, { kpis?: string[]; blocks?: string[] }>
// Exported so the test asserts the exact save-request body (§13) without a
// duplicated string literal — Dashboard.tsx (the live reader) keeps its own
// literal, this is only the settings-editor's write side.
export const DASHBOARD_HIDDEN_KEY = 'dashboard_hidden'
const KEY = DASHBOARD_HIDDEN_KEY

// DASH-VOLGORDE-1 — per-role KPI tile order, { [dashboardType]: string[] of kpi
// ids }. Exported for the same reason as DASHBOARD_HIDDEN_KEY: kept as the
// migration-window read fallback (see file header); Dashboard.tsx keeps its
// own literal (documented there).
export const DASHBOARD_KPI_ORDER_KEY = 'dashboard_kpi_order'
type OrderMap = Record<string, string[]>

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
      {/* CHIP-TINT-1: a chosen matrix cell is a choice marker — the active tint
          pair (mirrors ChipMultiSelect's chosen convention), never a solid accent. */}
      <button type="button" onClick={onToggle}
        title={on ? t('dashboardsToggleOff') : t('dashboardsToggleOn')}
        aria-label={on ? t('dashboardsToggleOff') : t('dashboardsToggleOn')}
        aria-pressed={on}
        // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- NECESSITY: round matrix-cell toggle (ChipMultiSelect chosen/unchosen convention in a table grid), not an action button — Button has no circular cell face
        style={{ width: 24, height: 24, borderRadius: '50%', cursor: 'pointer', display: 'inline-flex',
          alignItems: 'center', justifyContent: 'center',
          border: `1.5px solid ${on ? tintBorder(cellTint, true) : 'var(--border)'}`,
          background: on ? tintBg(cellTint, true) : 'transparent' }}>
        {on && <Check size={13} color={chipInk(cellTint)} />}
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
  // K3-REFIT-1: catalog uitleg per KPI key (undefined while loading/unavailable).
  catalogByKey: Record<string, DashboardKpiCatalogEntry> | null
}

// aria-label makes each matrix a named region (§6) — disambiguating it from the
// identically-labelled sub-tab for assistive tech and the tests.
function Matrix({ kind, rows, title, labelKey, isHidden, onToggle, t, td, catalogByKey }: MatrixProps) {
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
                <th style={{ ...stickyCell, ...groupLabelStyle, borderBottom: '1px solid var(--border)' }}>
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
                        {/* Five types share the server's ONE 'default' KPI row —
                            say so instead of letting a toggle surprise four
                            sibling columns (Opus B6). */}
                        {kind === 'kpis' && toApiRole(type) === 'default' && (
                          <Caption style={{ fontSize: 10 }}>{t('dashboardsSharedDefault')}</Caption>
                        )}
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map(id => {
                // K3-REFIT-1: the uitleg line now comes from the kpi-catalog (counts +
                // drills_to), replacing the five local `dashboardsExplain.*` copies.
                const catalogEntry = kind === 'kpis' ? catalogByKey?.[id] : undefined
                return (
                <tr key={id}>
                  <td style={stickyCell}>
                    {labelKey[id] ? td(labelKey[id]) : id}
                    {kind === 'kpis' && (
                      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 400, whiteSpace: 'normal', marginTop: 2, maxWidth: 220 }}>
                        {catalogEntry
                          ? `${catalogEntry.counts} ${t('dashboardsGoesTo', { target: catalogEntry.drills_to })}`
                          : (catalogByKey === null ? t('dashboardsCatalogUnavailable') : null)}
                      </div>
                    )}
                  </td>
                  {DASHBOARD_TYPES.map(type => {
                    const applies = kind === 'kpis' ? (KPI_ROWS[type] ?? []).includes(id) : blocksFor(type).includes(id)
                    return (
                      <Cell key={type} applies={applies} on={!isHidden(type, kind, id)}
                        onToggle={() => onToggle(type, kind, id)} t={t} />
                    )
                  })}
                </tr>
                )
              })}
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
  const auth = useAuth()

  // Local mirror of the saved overrides; re-syncs when the settings blob changes.
  // Still the source for BLOCKS (no catalog yet) and the KPI read-fallback (see header).
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

  // DASH-VOLGORDE-1 — same re-sync pattern as `hidden` above, for the per-role order
  // (KPI read-fallback only now; BLOCKS have no order editor).
  const savedOrder = getJsonSetting<OrderMap>(settings, DASHBOARD_KPI_ORDER_KEY, {})
  const [order, setOrder] = useState<OrderMap>(savedOrder)
  const savedOrderKey = JSON.stringify(savedOrder)
  const [prevOrderKey, setPrevOrderKey] = useState(savedOrderKey)
  if (savedOrderKey !== prevOrderKey) { setPrevOrderKey(savedOrderKey); setOrder(savedOrder) }

  // K3-REFIT-1 — the kpi-catalog (uitleg per key) and the six per-role ordered+visible
  // lists from GET /dashboard/kpis/{role}. `null` = not loaded/unavailable yet; an
  // empty array for a role (after a resolved fetch) is the migration-window signal to
  // keep reading that role from the old settings blob (file header).
  const [catalogByKey, setCatalogByKey] = useState<Record<string, DashboardKpiCatalogEntry> | null>(null)
  const [roleKpis, setRoleKpis] = useState<Partial<Record<ApiRole, string[]>>>({})
  const [roleKpisStatus, setRoleKpisStatus] = useState<Partial<Record<ApiRole, 'ok' | 'error'>>>({})
  const mountedRef = useRef(true)
  useEffect(() => {
    // StrictMode re-arms this in setup, not cleanup-only (§9 mount-ref lesson).
    mountedRef.current = true
    const controller = new AbortController()
    fetchDashboardKpiCatalog(controller.signal)
      .then(catalog => {
        if (!mountedRef.current) return
        const byKey: Record<string, DashboardKpiCatalogEntry> = {}
        catalog.available.forEach(entry => { byKey[entry.key] = entry })
        setCatalogByKey(byKey)
      })
      .catch(() => { if (mountedRef.current) setCatalogByKey(null) })
    API_ROLES.forEach(role => {
      fetchDashboardKpisRole(role, controller.signal)
        .then(kpis => {
          if (!mountedRef.current) return
          setRoleKpis(prev => ({ ...prev, [role]: kpis }))
          setRoleKpisStatus(prev => ({ ...prev, [role]: 'ok' }))
        })
        .catch(() => {
          if (!mountedRef.current) return
          setRoleKpisStatus(prev => ({ ...prev, [role]: 'error' }))
        })
    })
    return () => { mountedRef.current = false; controller.abort() }
  }, [])

  // A role is "migrated" the moment its GET resolved — an EMPTY list is a real
  // configuration ("every tile off"), not a signal to fall back to the blob
  // (Opus B4: the length check made the last toggle-off snap everything back on).
  const isRoleMigrated = (role: ApiRole) => roleKpisStatus[role] === 'ok'

  // A failed per-role PUT must be SEEN and undone — an optimistic list that
  // silently survives a 403/422 shows a configuration the server never accepted
  // (Opus B2). One error lane for both write paths below.
  const [saveError, setSaveError] = useState(false)
  const putRoleList = (apiRole: ApiRole, nextIds: string[]) => {
    const previous = roleKpis[apiRole] ?? []
    setSaveError(false)
    setRoleKpis(prev => ({ ...prev, [apiRole]: nextIds }))
    putDashboardKpisRole(apiRole, nextIds).catch(() => {
      setRoleKpis(prev => ({ ...prev, [apiRole]: previous }))
      setSaveError(true)
    })
  }

  // Persist a role's full KPI order (optimistic; the live dashboard reads the same key).
  // KPIs on a migrated role now write straight to the new endpoint (K3-REFIT-1);
  // everything else keeps the old settings-blob path (migration-window fallback).
  const saveOrder = (type: string, nextIds: string[]) => {
    const apiRole = toApiRole(type as DashboardType)
    if (isRoleMigrated(apiRole)) {
      putRoleList(apiRole, nextIds)
      return
    }
    setOrder(prev => {
      const next = { ...prev, [type]: nextIds }
      saveSettingsKeys({ [DASHBOARD_KPI_ORDER_KEY]: next }).catch(() => {})
      return next
    })
  }

  // Is this KPI/block switched off for the role? KPIs on a migrated role read the
  // new per-role list; blocks (and un-migrated KPI roles) read the old blob.
  const isHidden = (type: string, kind: 'kpis' | 'blocks', id: string) => {
    if (kind === 'kpis') {
      const apiRole = toApiRole(type as DashboardType)
      if (isRoleMigrated(apiRole)) return !(roleKpis[apiRole] ?? []).includes(id)
    }
    return (hidden[type]?.[kind] ?? []).includes(id)
  }

  // Toggle one item on/off for a role and persist (optimistic; dashboards update live).
  const toggle = (type: string, kind: 'kpis' | 'blocks', id: string) => {
    if (kind === 'kpis') {
      const apiRole = toApiRole(type as DashboardType)
      if (isRoleMigrated(apiRole)) {
        const list = roleKpis[apiRole] ?? []
        const next = list.includes(id) ? list.filter(x => x !== id) : [...list, id]
        putRoleList(apiRole, next)
        return
      }
    }
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
  const [activeTab, setActiveTab] = useState<'kpis' | 'blocks' | 'order'>('kpis')

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
          { id: 'order', label: t('dashboards.tabs.order') },
        ]}
        active={activeTab}
        onChange={(id) => setActiveTab(id as 'kpis' | 'blocks' | 'order')}
      />

      {saveError && (
        <p role="alert" style={{ margin: 0, fontSize: 12.5, color: 'var(--color-danger-text)' }}>{t('dashboardsSaveError')}</p>
      )}

      {activeTab === 'kpis' && (
        <Matrix kind="kpis" rows={allKpis} title={t('dashboardsKpis')} labelKey={KPI_LABEL_KEY}
          isHidden={isHidden} onToggle={toggle} t={t} td={td} catalogByKey={catalogByKey} />
      )}
      {activeTab === 'blocks' && (
        <Matrix kind="blocks" rows={allBlocks} title={t('dashboardsBlocks')} labelKey={BLOCK_LABEL_KEY}
          isHidden={isHidden} onToggle={toggle} t={t} td={td} catalogByKey={catalogByKey} />
      )}
      {activeTab === 'order' && (
        <OrderPanel isHidden={isHidden} order={order} onSaveOrder={saveOrder} t={t} td={td}
          roleKpis={roleKpis} isRoleMigrated={isRoleMigrated}
          canPreviewOtherRole={Boolean(auth?.hasPermission?.('settings.update'))} />
      )}
    </div>
  )
}

// Props for the per-role KPI order editor — hoisted to module level (same
// react-hooks/static-components reason as Cell/Matrix above).
interface OrderPanelProps {
  isHidden: (type: string, kind: 'kpis' | 'blocks', id: string) => boolean
  order: OrderMap
  onSaveOrder: (type: string, nextIds: string[]) => void
  t: TFunction
  td: TFunction
  roleKpis: Partial<Record<ApiRole, string[]>>
  isRoleMigrated: (role: ApiRole) => boolean
  // K3-REFIT-1 point 3: a `?preview_role=` deep link is only honoured for a viewer
  // who holds settings.update — anyone else keeps the plain default-role preview.
  canPreviewOtherRole: boolean
}

// Read an optional `?preview_role=` from the current URL — used only to preselect
// the role tab below, gated on settings.update by the caller.
const readPreviewRoleParam = (): string | null => {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('preview_role')
}

// DASH-VOLGORDE-1 — one role at a time: pick a role (searchable, §3A no native
// <select>), see a HONEST preview strip (labels + order, never real numbers,
// §0 no fake affordances) and reorder via the shared DragList (arrows are the
// required path, §6 keyboard; drag comes along for free from the same component).
function OrderPanel({ isHidden, order, onSaveOrder, t, td, roleKpis, isRoleMigrated, canPreviewOtherRole }: OrderPanelProps) {
  // K3-REFIT-1 point 3: preselect the role from ?preview_role= when the viewer may
  // preview another role's settings and the param names a real DashboardType;
  // otherwise fall back to the original default-first-type behaviour.
  const previewParam = readPreviewRoleParam()
  const initialRole = (canPreviewOtherRole && previewParam && (DASHBOARD_TYPES as readonly string[]).includes(previewParam))
    ? (previewParam as DashboardType)
    : DASHBOARD_TYPES[0]
  const [role, setRole] = useState<DashboardType>(initialRole)

  // Visible+ordered KPI ids for this role today: a migrated apiRole reads its new
  // ordered list directly (already visible-only); otherwise the old blob path
  // (hidden filter + resolveReportKpiOrder) exactly as before.
  const apiRole = toApiRole(role)
  const migrated = isRoleMigrated(apiRole)
  const visibleIds = (KPI_ROWS[role] ?? []).filter(id => !isHidden(role, 'kpis', id))
  // Migrated role: the FULL server list, unfiltered — omission means hidden, so
  // PUTting a type-template subset would silently hide everything outside it
  // (Opus B3: one arrow click on 'sales' hid four sibling types' tiles).
  const resolvedIds = migrated
    ? (roleKpis[apiRole] ?? [])
    : resolveReportKpiOrder(order[role], visibleIds, visibleIds).order
  const items = resolvedIds.map((id, i) => ({ id: `${id}-${i}`, kpiId: id, index: i }))

  return (
    <section aria-label={t('dashboards.tabs.order')}>
      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 10px' }}>{t('dashboardsOrderHint')}</p>

      <div style={{ maxWidth: 320, marginBottom: 14 }}>
        <GroupLabel as="label" style={{ display: 'block', marginBottom: 4 }}>
          {t('dashboardsOrderRoleLabel')}
        </GroupLabel>
        <CreatableSelect
          value={role}
          allowCreate={false}
          options={DASHBOARD_TYPES.map(id => ({ value: id, label: td(`types.${id}`) }))}
          onChange={val => setRole(val as DashboardType)}
        />
      </div>

      {/* Honest preview strip — labels + order only, never fabricated numbers. */}
      <SectionCard title={t('dashboardsPreviewTitle')} style={{ marginBottom: 14 }}>
        <Caption as="p" style={{ margin: '0 0 8px' }}>{t('dashboardsPreviewHint')}</Caption>
        {resolvedIds.length === 0 ? (
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: 0 }}>{t('dashboardsOrderEmpty')}</p>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {resolvedIds.map(id => (
              <div key={id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', minWidth: 96 }}>
                <Caption as="div">{KPI_LABEL_KEY[id] ? td(KPI_LABEL_KEY[id]) : id}</Caption>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>—</div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {resolvedIds.length > 0 && (
        <SectionCard title={t('dashboardsOrderRoleLabel') + ': ' + td(`types.${role}`)}>
          <DragList
            items={items}
            onReorder={(next: { kpiId: string; index: number }[]) => onSaveOrder(role, next.map(it => it.kpiId))}
            renderItem={(item: { kpiId: string; index: number }) => (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                <Caption style={{ width: 20, textAlign: 'right' }}>{item.index + 1}</Caption>
                <BodyText as="span">
                  {KPI_LABEL_KEY[item.kpiId] ? td(KPI_LABEL_KEY[item.kpiId]) : item.kpiId}
                </BodyText>
              </div>
            )}
          />
        </SectionCard>
      )}
    </section>
  )
}
