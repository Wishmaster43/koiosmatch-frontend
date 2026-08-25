/**
 * BlockGroupList — the Werkfeeds / Grafieken / Lijsten groups on the per-role
 * Dashboards page (F6 rebuild). Blocks have no order editor (unchanged from
 * the pre-rebuild screen — the settings-blob path only ever carried on/off),
 * so each row is a label + Toggle, grouped by id-prefix category via
 * `catalog.ts`. A category with nothing to show (after search/on-off
 * filtering) renders no heading at all.
 */
import Toggle from '@/components/ui/Toggle'
import { Caption, BodyText, GroupLabel } from '@/components/ui/typography'
import { BLOCK_LABEL_KEY, type DashboardType } from '@/pages/dashboard/shared'
import { blocksForRole, groupBlocksByCategory, matchesSearch, matchesOnOff, BLOCK_CATEGORY_ORDER, type OnOffFilter, type BlockCategory } from './catalog'
import type { TFunction } from 'i18next'

// One category → its GroupLabel translation key (settings namespace).
const CATEGORY_TITLE_KEY: Record<BlockCategory, string> = {
  block: 'dashboardsGroups.block', chart: 'dashboardsGroups.chart', list: 'dashboardsGroups.list',
}

interface BlockGroupListProps {
  role: DashboardType
  isHidden: (type: string, kind: 'kpis' | 'blocks', id: string) => boolean
  onToggle: (type: string, kind: 'kpis' | 'blocks', id: string) => void
  search: string
  onOffFilter: OnOffFilter
  t: TFunction
  td: TFunction
}

export default function BlockGroupList({ role, isHidden, onToggle, search, onOffFilter, t, td }: BlockGroupListProps) {
  const ids = blocksForRole(role)
  const groups = groupBlocksByCategory(ids)
  const label = (id: string) => (BLOCK_LABEL_KEY[id] ? td(BLOCK_LABEL_KEY[id]) : id)

  // A category's rows after search + on/off filtering — computed once per
  // category so the "nothing left" empty state and the render pass agree.
  const visibleRows = (category: BlockCategory) =>
    (groups[category] ?? []).filter(id => matchesSearch(label(id), search) && matchesOnOff(!isHidden(role, 'blocks', id), onOffFilter))

  const anyVisible = BLOCK_CATEGORY_ORDER.some(cat => visibleRows(cat).length > 0)
  if (!anyVisible) {
    return (
      <section aria-label={t('dashboardsBlocks')}>
        <GroupLabel as="h3" style={{ marginBottom: 6 }}>{t('dashboardsBlocks')}</GroupLabel>
        <Caption>{t('dashboardsEmpty')}</Caption>
      </section>
    )
  }

  return (
    <section aria-label={t('dashboardsBlocks')}>
      <GroupLabel as="h3" style={{ marginBottom: 6 }}>{t('dashboardsBlocks')}</GroupLabel>
      {BLOCK_CATEGORY_ORDER.map(category => {
        const rows = visibleRows(category)
        if (rows.length === 0) return null
        return (
          <div key={category} style={{ marginBottom: 12 }}>
            <GroupLabel as="h3" style={{ marginBottom: 6 }}>{t(CATEGORY_TITLE_KEY[category])}</GroupLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {rows.map(id => {
                const on = !isHidden(role, 'blocks', id)
                return (
                  <div key={id} data-block-row={id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 8px', opacity: on ? 1 : 0.7 }}>
                    <BodyText as="div" style={{ flex: 1, minWidth: 0 }}>{label(id)}</BodyText>
                    <Toggle checked={on} onChange={() => onToggle(role, 'blocks', id)}
                      ariaLabel={on ? t('dashboardsToggleOff') : t('dashboardsToggleOn')} />
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </section>
  )
}
