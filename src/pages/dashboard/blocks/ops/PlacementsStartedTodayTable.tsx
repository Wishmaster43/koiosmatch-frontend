/**
 * PlacementsStartedTodayTable — ops tile: matches that started today, with a
 * three-way completeness checklist (contract/document/coupling). Each row
 * deep-links to that match's drawer.
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, X } from 'lucide-react'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import { Block } from '@/pages/dashboard/DashboardPrimitives'
import type { PlacementStartedTodayRow } from '@/types/dashboard'
import type { FeedTileContext } from '../feedTileKit'

// One checklist cell: an icon plus sr-only text so the state is never colour-only (§6).
function CheckCell({ ok }: { ok: boolean }) {
  const { t } = useTranslation('dashboard')
  const Icon = ok ? Check : X
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      <Icon size={14} color={ok ? 'var(--color-success)' : 'var(--color-danger)'} aria-hidden="true" />
      <span className="sr-only">{ok ? t('feed.ok') : t('feed.notOk')}</span>
    </span>
  )
}

export default function PlacementsStartedTodayTable({ rows, onNavigate }: {
  rows: PlacementStartedTodayRow[]
  onNavigate?: FeedTileContext['onNavigate']
}) {
  const { t } = useTranslation('dashboard')

  // Column set: candidate, customer, then the three completeness checks.
  const columns: Column<PlacementStartedTodayRow>[] = useMemo(() => [
    { key: 'candidate', header: t('feed.col.candidate'), render: r => r.candidate || t('widget.unknown') },
    { key: 'customer', header: t('feed.col.customer'), render: r => r.customer || '—' },
    { key: 'contract_ok', header: t('feed.col.contract'), align: 'center', render: r => <CheckCell ok={r.contract_ok} /> },
    { key: 'document_ok', header: t('feed.col.document'), align: 'center', render: r => <CheckCell ok={r.document_ok} /> },
    { key: 'koppeling_ok', header: t('feed.col.coupling'), align: 'center', render: r => <CheckCell ok={r.koppeling_ok} /> },
  ], [t])

  if (!rows.length) return null

  return (
    <Block title={t('block.placementsStartedToday')}>
      <DataTable<PlacementStartedTodayRow>
        columns={columns}
        rows={rows}
        getRowId={r => r.match_id}
        onRowClick={onNavigate ? (r) => onNavigate('matches', { open: r.match_id }) : undefined}
      />
    </Block>
  )
}
