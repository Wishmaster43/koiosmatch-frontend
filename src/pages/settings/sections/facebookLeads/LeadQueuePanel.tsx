/**
 * LeadQueuePanel (LEAD-LEDGER-1) — the bureau admin's view of the Facebook lead queue: counts,
 * a status filter and the receipts table with a retry action. No lead data is shown.
 */
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { useNumberFormat } from '@/lib/formatters'
import { formatDateTimeStr } from '@/lib/localDate'
import Button from '@/components/ui/Button'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import EntityLink from '@/components/ui/EntityLink'
import ErrorBanner from '@/components/ui/ErrorBanner'
import PaginationBar from '@/components/ui/PaginationBar'
import SearchSelect from '@/components/ui/SearchSelect'
import SoftChip from '@/components/ui/SoftChip'
import { BodyText, Caption, Mono } from '@/components/ui/typography'
import { useLeadReceipts } from './useLeadReceipts'
import type { LeadReceipt, ReceiptStatus } from './useLeadReceipts'

const STATUSES: ReceiptStatus[] = ['pending', 'retrieved', 'rejected', 'failed']
const RETRYABLE: ReceiptStatus[] = ['pending', 'failed', 'rejected']
// Status chip colours are semantic tokens: waiting = warning, landed = success, dead ends = danger.
const STATUS_COLOR: Record<ReceiptStatus, string> = {
  pending: 'var(--color-warning)',
  retrieved: 'var(--color-success)',
  rejected: 'var(--color-danger)',
  failed: 'var(--color-danger)',
}

// Renders the queue summary, filter, receipts table and pagination for the current bureau.
export default function LeadQueuePanel() {
  const { t } = useTranslation('settings')
  const { formatNumber } = useNumberFormat()
  const canRetry = Boolean(useAuth()?.hasPermission('settings.update'))
  const q = useLeadReceipts('pending')
  const dash = '—'
  const date = (v: string | null) => (v ? formatDateTimeStr(v) : dash)

  const columns: Column<LeadReceipt>[] = [
    { key: 'created_at', header: t('facebookLeads.queue.col.created'), nowrap: true, render: (r) => date(r.created_at) },
    { key: 'form_id', header: t('facebookLeads.queue.col.form'), render: (r) => <Mono>{r.form_id ?? dash}</Mono> },
    { key: 'status', header: t('facebookLeads.queue.col.status'), render: (r) => <SoftChip label={t(`facebookLeads.queue.status.${r.status}`)} color={STATUS_COLOR[r.status]} /> },
    { key: 'attempts', header: t('facebookLeads.queue.col.attempts'), align: 'right', render: (r) => formatNumber(r.attempts) },
    { key: 'last_error_code', header: t('facebookLeads.queue.col.lastError'), render: (r) => (r.last_error_code ? <Mono>{r.last_error_code}</Mono> : dash) },
    { key: 'next_retry_at', header: t('facebookLeads.queue.col.nextAttempt'), nowrap: true, render: (r) => date(r.next_retry_at) },
    { key: 'retrieved_at', header: t('facebookLeads.queue.col.retrieved'), nowrap: true, render: (r) => date(r.retrieved_at) },
    { key: 'candidate_id', header: t('facebookLeads.queue.col.candidate'), render: (r) => (r.candidate_id != null
      ? <EntityLink page="candidates" id={r.candidate_id}>{t('facebookLeads.queue.view')}</EntityLink> : dash) },
    { key: 'actions', header: '', render: (r) => (canRetry && RETRYABLE.includes(r.status)
      ? <Button variant="secondary" disabled={q.retryingId === r.id} onClick={() => q.retry(r.id)}>{t('facebookLeads.queue.retry')}</Button> : null) },
  ]

  const options = [{ value: '', label: t('facebookLeads.queue.status.all') }, ...STATUSES.map((s) => ({ value: s, label: t(`facebookLeads.queue.status.${s}`) }))]
  const statusLabel = t(`facebookLeads.queue.status.${q.status || 'all'}`)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {q.summary && (
        <div>
          <BodyText style={{ margin: 0 }}>
            {STATUSES.map((s) => t(`facebookLeads.queue.summary.${s}`, { count: q.summary?.[s] ?? 0, formatted: formatNumber(q.summary?.[s] ?? 0) })).join(' · ')}
          </BodyText>
          {q.summary.oldest_pending_at && (
            <Caption style={{ display: 'block', marginTop: 2 }}>
              {t('facebookLeads.queue.oldestPending', { date: formatDateTimeStr(q.summary.oldest_pending_at) })}
            </Caption>
          )}
        </div>
      )}
      <div>
        <SearchSelect closeOnToggle selectAll={false} width={220} options={options}
          selected={q.status ? [q.status] : []} onClear={() => q.setStatus('')} triggerLabel={statusLabel} triggerAriaLabel={t('facebookLeads.queue.filterLabel')}
          onToggle={(v) => q.setStatus(v as ReceiptStatus | '')} />
      </div>
      {q.retryError && <ErrorBanner>{q.retryError}</ErrorBanner>}
      {q.error ? (
        <ErrorBanner onRetry={q.reload} retryLabel={t('facebookLeads.retry')}>{t('facebookLeads.queue.loadError')}</ErrorBanner>
      ) : (
        <>
          <DataTable columns={columns} rows={q.rows} getRowId={(r) => r.id} loading={q.loading}
            loadingText={t('common.loadingShort')} emptyText={t('facebookLeads.queue.empty')} />
          <PaginationBar page={q.page} totalPages={q.lastPage} totalRows={q.total} pageSize={q.perPage} onPageChange={q.setPage} />
        </>
      )}
    </div>
  )
}
