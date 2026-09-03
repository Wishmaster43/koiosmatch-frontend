/**
 * WebhookRequestsPanel — the per-webhook "Verzoeken" (requests) drill-in
 * (WEBHOOK-LOG-FE-1): every request this inbound webhook received, newest
 * first, server-paginated. Row click opens WebhookRequestDetailPanel (a second
 * FloatingPanel, stacked above this one). Handles all four UI states. The table
 * body is the named export `WebhookRequestsLog` (WEBHOOK-LOG-FE-2) so the
 * workflow editor's Webhook Trigger config panel can embed the same log
 * without the FloatingPanel/onClose shell; this default export stays the
 * Settings overlay, unchanged.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw } from 'lucide-react'
import FloatingPanel from '@/components/ui/FloatingPanel'
import Button from '@/components/ui/Button'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import PaginationBar from '@/components/ui/PaginationBar'
import SoftChip from '@/components/ui/SoftChip'
import WorkflowRefs from './WorkflowRefs'
import { BodyText, Caption, Mono } from '@/components/ui/typography'
import { useDateFormat } from '@/lib/datetime'
import { useWebhookRequests } from './useWebhookRequests'
import { statusChipColor, statusLabelKey } from './webhookRequestStatus'
import WebhookRequestDetailPanel from './WebhookRequestDetailPanel'
import type { WebhookRequestRow } from './webhookRequestTypes'

const PAGE_SIZE_OPTIONS = [25, 50, 100] // contract cap: ≤100 per page

// The request log's table body: states, columns, pagination, retention line and
// the detail drill-in. Shared by the Settings overlay below and the workflow
// editor's Webhook Trigger config panel (WEBHOOK-LOG-FE-2) — same webhook, same log.
export function WebhookRequestsLog({ webhookId, webhookName, compact = false }: {
  webhookId: string | number
  webhookName: string
  /** Panel-embedded variant (workflow editor, ~440px): drops the IP and workflows columns so the table fits. */
  compact?: boolean
}) {
  const { t } = useTranslation('settings')
  const { formatDateTime } = useDateFormat()
  const { page, setPage, pageSize, setPageSize, result, phase, reload } = useWebhookRequests(webhookId)
  // Accessible name for the log region: role="region" (unlike a generic div, this
  // role DOES expose aria-label as its accessible name) so a caller without the
  // FloatingPanel shell — the workflow editor's config panel — still names it.
  const tableLabel = t('webhooks.incoming.requests.title', { name: webhookName })
  // The currently drilled-into request id, if any (opens the detail panel).
  const [detailId, setDetailId] = useState<string | number | null>(null)

  // Column model: time, method, status (SoftChip), ip (Mono), matched workflows.
  // No column is sortable: the server already delivers newest-first per page, and
  // a client-side re-sort on a server-paginated list would only reorder the
  // CURRENT page (resetting on every page change) — a fake affordance (§3).
  // audit screen-webhooklog-1: the full column set is the settings overlay's; the
  // compact panel keeps time/method/status only (details open on row click anyway).
  const columns: Column<WebhookRequestRow>[] = ([
    { key: 'created_at', header: t('webhooks.incoming.requests.col.time'),
      render: r => formatDateTime(r.created_at) },
    { key: 'method', header: t('webhooks.incoming.requests.col.method'),
      render: r => <Mono style={{ fontSize: 12 }}>{r.method}</Mono> },
    { key: 'status_code', header: t('webhooks.incoming.requests.col.status'),
      render: r => (
        <SoftChip label={r.status_code} color={statusChipColor(r.status_code)}
          title={t(`webhooks.incoming.requests.status.${statusLabelKey(r.status_code)}`, { code: r.status_code })} />
      ) },
    { key: 'ip', header: t('webhooks.incoming.requests.col.ip'),
      render: r => <Mono style={{ fontSize: 12 }}>{r.ip ?? t('webhooks.incoming.requests.noIp')}</Mono> },
    { key: 'workflow_ids', header: t('webhooks.incoming.requests.col.workflows'),
      render: r => {
        const ids = r.workflow_ids ?? []
        const workflows = r.workflows ?? []
        if (ids.length === 0 && workflows.length === 0) return <Caption>{t('webhooks.incoming.requests.noWorkflows')}</Caption>
        // Named workflows (WEBHOOK-RUN-CORRELATION-1) render as real per-workflow
        // links; WorkflowRefs falls back to the honest ids-only reference for
        // older rows that carry no name.
        return <WorkflowRefs ids={ids} workflows={workflows} />
      } },
  ] as Column<WebhookRequestRow>[]).filter(c => !compact || !['ip', 'workflow_ids'].includes(String(c.key)))

  return (
    <div role="region" aria-label={tableLabel} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ padding: '12px 20px 0' }}>
        <Caption>{t('webhooks.incoming.requests.subtitle')}</Caption>
      </div>

      {phase === 'error' ? (
        <div style={{ padding: '24px 20px', textAlign: 'center' }}>
          <BodyText style={{ color: 'var(--text-muted)', marginBottom: 12 }}>{t('webhooks.incoming.requests.loadError')}</BodyText>
          <Button variant="secondary" onClick={reload}>
            <RefreshCw size={13} /> {t('webhooks.incoming.requests.retry')}
          </Button>
        </div>
      ) : (
        <div style={{ flex: 1, overflow: 'auto', padding: '10px 20px 0' }}>
          <DataTable columns={columns} rows={result.rows} onRowClick={r => setDetailId(r.id)}
            loading={phase === 'loading'} loadingText={t('webhooks.incoming.requests.loading')}
            emptyText={t('webhooks.incoming.requests.empty')} />
        </div>
      )}

      {phase !== 'error' && result.total > 0 && (
        <PaginationBar page={page} totalPages={result.lastPage} totalRows={result.total}
          pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS} />
      )}

      {/* Retention note — always visible, per the backend's write-time 30-day retention. */}
      <div style={{ padding: '8px 20px 14px' }}>
        <Caption>{t('webhooks.incoming.requests.retention')}</Caption>
      </div>

      {detailId != null && (
        <WebhookRequestDetailPanel webhookId={webhookId} requestId={detailId} onClose={() => setDetailId(null)} />
      )}
    </div>
  )
}

// Per-webhook requests drill-in shell (see the module doc above): the Settings
// FloatingPanel overlay wrapping WebhookRequestsLog above.
export default function WebhookRequestsPanel({ webhookId, webhookName, onClose }: {
  webhookId: string | number
  webhookName: string
  onClose: () => void
}) {
  const { t } = useTranslation('settings')
  return (
    <FloatingPanel open onClose={onClose}
      title={t('webhooks.incoming.requests.title', { name: webhookName })}
      width={860} persistKey="webhook-requests-list" bodyStyle={{ display: 'flex', flexDirection: 'column', padding: 0 }}
      scrollBody={false}>
      <WebhookRequestsLog webhookId={webhookId} webhookName={webhookName} />
    </FloatingPanel>
  )
}
