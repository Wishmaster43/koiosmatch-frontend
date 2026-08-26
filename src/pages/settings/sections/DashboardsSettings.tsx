/**
 * DashboardsSettings — Settings → Dashboards. F6 REBUILD (Danny 25-08: "dit is
 * nog steeds onoverzichtelijk" on the old two-matrix + separate order-tab
 * layout): one role at a time via `RolePicker`, grouped into KPI's (order +
 * on/off combined, `KpiOrderList`) and Werkfeeds/Grafieken/Lijsten
 * (`BlockGroupList`), searchable + filterable by on/off. The persistence
 * logic below (settings blob, kpi-catalog, per-role kpis endpoint) is
 * UNCHANGED from the pre-rebuild screen — only the render shape changed,
 * so every pinned §13 request-body test still exercises the same code path.
 *
 * K3-REFIT-1 (K-173 phase 4, LIVE): the KPI list reads/writes the dedicated
 * catalog endpoints instead of the generic settings blob —
 *   - GET /dashboard/kpi-catalog → { available: [{key,label,counts,scope,drills_to}], defaults }
 *     is the ONE source for the per-KPI uitleg line.
 *   - GET/PUT /dashboard/kpis/{role} carries ONE ordered list per role: presence = on,
 *     position = order, omission = hidden. This is now the write path for KPI
 *     visibility/order; the old `dashboard_hidden`/`dashboard_kpi_order` settings keys
 *     stay as a READ-ONLY fallback per role only while that role's new GET comes back
 *     empty (migration window — remove the fallback once CMBE backfills every role).
 * The BLOCKS list has no equivalent catalog yet, so it keeps the original
 * settings-blob path untouched.
 *
 * ROLE MAPPING: the new endpoints only know six roles — 'default', 'recruitment',
 * 'recruitment_manager', 'accountmanager', 'sales_manager', 'backoffice' — while this
 * screen has ten DASHBOARD_TYPES role tabs. Five DashboardType ids are exact
 * string matches for a specific API role; every other type (admin, management, sales,
 * planning, readonly) has no dedicated role in the contract, so it shares the literal
 * 'default' row (brief: "de default-rol heet letterlijk 'default'"). Concretely: those
 * five types' KPI on/off + order all point at the SAME server-side list — toggling one
 * of them changes it for the others too. That is an intrinsic property of the six-role
 * contract, not a bug introduced here.
 */
import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAllSettings, useSettingsLoaded, getJsonSetting, saveSettingsKeys } from '@/lib/settings/useAllSettings'
import { useAuth } from '@/context/AuthContext'
import HeaderSearch from '@/components/ui/HeaderSearch'
import SegmentedControl from '@/components/ui/SegmentedControl'
import { Caption } from '@/components/ui/typography'
import {
  fetchDashboardKpiCatalog, fetchDashboardKpisRole, putDashboardKpisRole,
  type DashboardKpiCatalogEntry,
} from './dashboardsKpiApi'
import { DASHBOARD_TYPES, type DashboardType } from '@/pages/dashboard/shared'
import { resolveReportKpiOrder } from '@/pages/reports/shared'
import RolePicker from './dashboards/RolePicker'
import KpiOrderList from './dashboards/KpiOrderList'
import BlockGroupList from './dashboards/BlockGroupList'
import type { OnOffFilter } from './dashboards/catalog'

// The eight roles the KPI-catalog endpoints know (config/dashboard_kpis.php keys):
// seven match a DashboardType string exactly, anything else (admin, management,
// sales) reads the literal 'default' row. planning/readonly have their OWN rows
// (Opus F6: folding them into default silently wrote the wrong row).
const SPECIFIC_API_ROLES = ['recruitment', 'recruitment_manager', 'accountmanager', 'sales_manager', 'backoffice', 'planning', 'readonly'] as const
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

// Settings screen for per-role KPI visibility/order; reads/writes the new per-role API, with the legacy settings-blob overrides as a migration-window fallback.
export default function DashboardsSettings() {
  const { t } = useTranslation('settings')
  const { t: td } = useTranslation('dashboard')

  // Local mirror of the saved overrides; re-syncs when the settings blob changes.
  // Still the source for BLOCKS (no catalog yet) and the KPI read-fallback (see header).
  const settings = useAllSettings()
  // Has the tenant blob resolved at least once? Without this, `saved` reads as `{}`
  // (nothing hidden) before the fetch lands — every toggle would flash ON, then some
  // could jump OFF once the real overrides arrive.
  const settingsLoaded = useSettingsLoaded()
  const saved = getJsonSetting<HiddenMap>(settings, KEY, {})
  const [hidden, setHidden] = useState<HiddenMap>(saved)
  const savedKey = JSON.stringify(saved)
  const [prevKey, setPrevKey] = useState(savedKey)
  if (savedKey !== prevKey) { setPrevKey(savedKey); setHidden(saved) }

  // DASH-VOLGORDE-1 — same re-sync pattern as `hidden` above, for the per-role order
  // (KPI read-fallback only now).
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
  // Optimistically writes one role's KPI order/visibility, then rolls back and flags saveError if the server rejects the PUT.
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

  // Resolve a blob-backed role's visible order — thin wrapper so KpiOrderList
  // stays a pure renderer and never imports the reports-domain resolver itself.
  const resolveOrder = (savedIds: string[] | undefined, visibleIds: string[]) =>
    resolveReportKpiOrder(savedIds, visibleIds, visibleIds).order

  // K3-REFIT-1 point 3: a `?preview_role=` deep link is only honoured for a viewer
  // who holds settings.update — anyone else keeps the plain default-role preview.
  const auth = useAuth()
  const canPreviewOtherRole = Boolean(auth?.hasPermission?.('settings.update'))
  const previewParam = typeof window === 'undefined'
    ? null
    : new URLSearchParams(window.location.search).get('preview_role')
  const initialRole = (canPreviewOtherRole && previewParam && (DASHBOARD_TYPES as readonly string[]).includes(previewParam))
    ? (previewParam as DashboardType)
    : DASHBOARD_TYPES[0]

  // F6 REBUILD — one role at a time (Danny 25-08). Defaults to the first
  // dashboard type, or the ?preview_role= deep link when permitted (above).
  const [role, setRole] = useState<DashboardType>(initialRole)
  const [search, setSearch] = useState('')
  const [onOffFilter, setOnOffFilter] = useState<OnOffFilter>('all')
  const apiRole = toApiRole(role)
  const migrated = isRoleMigrated(apiRole)

  // Loading state (§3) — all hooks above have already run, so this early return keeps
  // hook order stable across renders while still avoiding the on-then-off toggle flash.
  if (!settingsLoaded) {
    return <div style={{ padding: 24 }}><Caption>{t('common.loading')}</Caption></div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1000 }}>
      <RolePicker value={role} onChange={setRole} td={td} ariaLabel={t('dashboardsOrderRoleLabel')} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <HeaderSearch onSearch={setSearch} />
        </div>
        <SegmentedControl
          size="compact"
          ariaLabel={t('dashboardsOnOffFilter')}
          value={onOffFilter}
          onChange={val => setOnOffFilter(val as OnOffFilter)}
          options={[
            { value: 'all', label: t('dashboardsFilterAll') },
            { value: 'on', label: t('dashboardsFilterOn') },
            { value: 'off', label: t('dashboardsFilterOff') },
          ]}
        />
      </div>

      {saveError && (
        <div role="alert">
          <Caption as="p" style={{ margin: 0, color: 'var(--color-danger-text)' }}>{t('dashboardsSaveError')}</Caption>
        </div>
      )}

      <KpiOrderList
        role={role} apiRole={apiRole} migrated={migrated}
        isHidden={isHidden} onToggle={toggle} onSaveOrder={saveOrder}
        roleKpis={roleKpis} order={order} resolveOrder={resolveOrder}
        catalogByKey={catalogByKey} search={search} onOffFilter={onOffFilter}
        t={t} td={td}
      />

      <BlockGroupList
        role={role} isHidden={isHidden} onToggle={toggle}
        search={search} onOffFilter={onOffFilter} t={t} td={td}
      />
    </div>
  )
}
