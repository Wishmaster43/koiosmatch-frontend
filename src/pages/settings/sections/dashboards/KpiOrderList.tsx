/**
 * KpiOrderList — the "KPI's" group on the per-role Dashboards page (F6
 * rebuild). One list, on/off AND order together: enabled KPIs are draggable/
 * arrow-reorderable (shared DragList) with the catalog explanation under the
 * label; disabled KPIs render below as plain toggle rows so a hidden tile can
 * be switched back on. Data plumbing (isHidden/onToggle/onSaveOrder/roleKpis)
 * is unchanged from the pre-rebuild screen — this component only decides what
 * to render, never how a request is shaped (§13 request-level tests keep
 * pinning that logic in the container).
 */
import Toggle from '@/components/ui/Toggle'
import { Caption, BodyText, GroupLabel } from '@/components/ui/typography'
import { DragList } from '@/pages/settings/components/SettingsControls'
import { KPI_ROWS, KPI_LABEL_KEY, type DashboardType } from '@/pages/dashboard/shared'
import { matchesSearch, matchesOnOff, type OnOffFilter } from './catalog'
import type { DashboardKpiCatalogEntry } from '../dashboardsKpiApi'
import type { TFunction } from 'i18next'

interface KpiOrderListProps {
  role: DashboardType
  apiRole: string
  migrated: boolean
  isHidden: (type: string, kind: 'kpis' | 'blocks', id: string) => boolean
  onToggle: (type: string, kind: 'kpis' | 'blocks', id: string) => void
  onSaveOrder: (type: string, nextIds: string[]) => void
  roleKpis: Partial<Record<string, string[]>>
  order: Record<string, string[]>
  resolveOrder: (savedOrder: string[] | undefined, visibleIds: string[]) => string[]
  catalogByKey: Record<string, DashboardKpiCatalogEntry> | null
  search: string
  onOffFilter: OnOffFilter
  t: TFunction
  td: TFunction
}

export default function KpiOrderList({
  role, apiRole, migrated, isHidden, onToggle, onSaveOrder, roleKpis, order, resolveOrder,
  catalogByKey, search, onOffFilter, t, td,
}: KpiOrderListProps) {
  // The role's own nine KPI ids (templates.ts) — what this page is scoped to.
  const roleIds = KPI_ROWS[role] ?? []
  // Migrated role: the server's full ordered list is authoritative (may carry
  // ids outside roleIds when several types share one server row — see the
  // shared-default caption below); un-migrated: resolve order from the blob.
  const onIds = migrated
    ? (roleKpis[apiRole] ?? [])
    : resolveOrder(order[role], roleIds.filter(id => !isHidden(role, 'kpis', id)))
  const offIds = roleIds.filter(id => !onIds.includes(id))

  const label = (id: string) => (KPI_LABEL_KEY[id] ? td(KPI_LABEL_KEY[id]) : id)
  const explanation = (id: string) => {
    const entry = catalogByKey?.[id]
    if (entry) return `${entry.counts} ${t('dashboardsGoesTo', { target: entry.drills_to })}`
    return catalogByKey === null ? t('dashboardsCatalogUnavailable') : null
  }

  const visibleOnIds = onIds.filter(id => matchesSearch(label(id), search) && matchesOnOff(true, onOffFilter))
  const visibleOffIds = offIds.filter(id => matchesSearch(label(id), search) && matchesOnOff(false, onOffFilter))

  if (visibleOnIds.length === 0 && visibleOffIds.length === 0) {
    return (
      <section aria-label={t('dashboardsKpis')}>
        <GroupLabel as="h3" style={{ marginBottom: 6 }}>{t('dashboardsKpis')}</GroupLabel>
        <Caption>{t('dashboardsEmpty')}</Caption>
      </section>
    )
  }

  // Draggable/arrow-reorderable rows — only the currently ON ids, in their
  // effective order; each row carries the KPI label + its catalog uitleg.
  const dragItems = visibleOnIds.map((id, i) => ({ id: `${id}-${i}`, kpiId: id, index: i }))

  // A search/on-off filter can hide part of onIds from view. Reordering must
  // never PUT a filtered subset as the role's full list (omission = hidden
  // server-side, dashboardsKpiApi.ts) — splice the reordered visible ids back
  // into their own slots of the full onIds list before saving.
  const handleReorder = (next: { kpiId: string; index: number }[]) => {
    const nextVisibleOrder = next.map(it => it.kpiId)
    let cursor = 0
    const merged = onIds.map(id => (visibleOnIds.includes(id) ? nextVisibleOrder[cursor++] : id))
    onSaveOrder(role, merged)
  }

  return (
    <section aria-label={t('dashboardsKpis')}>
      <GroupLabel as="h3" style={{ marginBottom: 6 }}>{t('dashboardsKpis')}</GroupLabel>
      {migrated && apiRole === 'default' && (
        <Caption style={{ display: 'block', marginBottom: 6 }}>{t('dashboardsSharedDefault')}</Caption>
      )}

      {visibleOnIds.length > 0 && (
        <DragList
          items={dragItems}
          onReorder={handleReorder}
          renderItem={(item: { kpiId: string; index: number }) => (
            <div data-kpi-row={item.kpiId} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <BodyText as="div">{label(item.kpiId)}</BodyText>
                {explanation(item.kpiId) && (
                  <Caption as="div" style={{ marginTop: 2 }}>{explanation(item.kpiId)}</Caption>
                )}
              </div>
              <Toggle checked onChange={() => onToggle(role, 'kpis', item.kpiId)}
                ariaLabel={t('dashboardsToggleOff')} />
            </div>
          )}
        />
      )}

      {visibleOffIds.length > 0 && (
        <div style={{ marginTop: visibleOnIds.length > 0 ? 8 : 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {visibleOffIds.map(id => (
            <div key={id} data-kpi-row={id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 8px', opacity: 0.7 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <BodyText as="div">{label(id)}</BodyText>
              </div>
              <Toggle checked={false} onChange={() => onToggle(role, 'kpis', id)}
                ariaLabel={t('dashboardsToggleOn')} />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
