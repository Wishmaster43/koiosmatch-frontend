/**
 * DocumentsAttentionTable — ops tile: candidates with a missing or expiring
 * document (dash.documents_attention). Each row deep-links to that
 * candidate's documents tab.
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import { Block } from '@/pages/dashboard/DashboardPrimitives'
import SoftChip from '@/components/ui/SoftChip'
import { Mono } from '@/components/ui/typography'
import { useDateFormat } from '@/lib/datetime'
import type { DocumentAttentionRow } from '@/types/dashboard'
import type { FeedTileContext } from '../feedTileKit'

export default function DocumentsAttentionTable({ rows, onNavigate }: {
  rows: DocumentAttentionRow[]
  onNavigate?: FeedTileContext['onNavigate']
}) {
  const { t } = useTranslation('dashboard')
  const { formatDate } = useDateFormat()

  // Column set: candidate, the issue chip, expiry date, days left.
  const columns: Column<DocumentAttentionRow>[] = useMemo(() => [
    { key: 'name', header: t('feed.col.candidate'), render: r => r.name },
    {
      key: 'issue', header: t('feed.col.issue'),
      render: r => (
        <SoftChip label={t(`feed.issue.${r.issue}`)}
          color={r.issue === 'missing_cv' ? 'var(--color-danger)' : 'var(--color-warning)'} />
      ),
    },
    { key: 'expires_at', header: t('feed.col.expiresAt'), render: r => r.expires_at ? formatDate(r.expires_at) : '—' },
    // feed.col.daysLeft has no seeded key yet — used anyway, listed in MISSING_KEYS.
    { key: 'days_left', header: t('feed.col.daysLeft'), align: 'right',
      render: r => r.days_left == null ? '—' : <Mono>{t('kpi.daysValue', { count: r.days_left })}</Mono> },
  ], [t, formatDate])

  if (!rows.length) return null

  return (
    <Block title={t('block.documentsAttention')}>
      <DataTable<DocumentAttentionRow>
        columns={columns}
        rows={rows}
        getRowId={r => r.candidate_id}
        onRowClick={onNavigate ? (r) => onNavigate('candidates', { open: r.candidate_id, tab: 'documents' }) : undefined}
      />
    </Block>
  )
}
