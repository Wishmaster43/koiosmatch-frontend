/**
 * OppsStalledTable — sales_manager tile: opportunities that have not moved in
 * a while, from dash.opps_stalled_list. A full-width DataTable (span 2).
 * OpportunitiesPage now resolves an { open: id } record intent
 * (useOpenFromIntent), so a row click opens the opportunity's drawer.
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import { Block } from '@/pages/dashboard/DashboardPrimitives'
import { Mono } from '@/components/ui/typography'
import { eur } from '@/pages/dashboard/dashboardFormat'
import type { OppStalledRow } from '@/types/dashboard'
import type { FeedTileContext } from '../feedTileKit'

export default function OppsStalledTable({ rows, onNavigate }: {
  rows: OppStalledRow[]
  onNavigate?: FeedTileContext['onNavigate']
}) {
  const { t } = useTranslation('dashboard')

  // Column set: opportunity, customer, owner, stage, days stalled, value.
  const columns: Column<OppStalledRow>[] = useMemo(() => [
    { key: 'title', header: t('feed.col.opportunity'), render: r => r.title },
    { key: 'customer', header: t('feed.col.customer'), render: r => r.customer || '—' },
    { key: 'owner', header: t('feed.col.owner'), render: r => r.owner },
    { key: 'stage_label', header: t('feed.col.stage'), render: r => r.stage_label || '—' },
    { key: 'days_still', header: t('feed.col.daysStill'), align: 'right', render: r => <Mono>{r.days_still}</Mono> },
    { key: 'value', header: t('feed.col.value'), align: 'right', render: r => r.value == null ? '—' : eur(r.value) },
  ], [t])

  if (!rows.length) return null

  return (
    <Block title={t('block.oppsStalledList')}>
      <DataTable<OppStalledRow>
        columns={columns}
        rows={rows}
        getRowId={r => r.id}
        onRowClick={onNavigate ? (r) => onNavigate('opportunities', { open: r.id }) : undefined}
      />
    </Block>
  )
}
