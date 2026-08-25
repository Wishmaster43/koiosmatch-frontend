/**
 * WaWebQueueTab — K-193 fase 1: the private WhatsApp (WAHA/Baileys) outbox.
 * A per-number stats strip (KpiCard: backlog / rate limit / est. drain) above a
 * DataTable of the tenant's queue rows, with send-now/pause/retry/cancel row
 * actions gated on whatsapp.manage. Status filtering lives in the right panel
 * (WhatsAppPage registers it while this tab is active) — this component stays
 * presentational plus the mutation wiring.
 */
import { useTranslation } from 'react-i18next'
import { Send, Pause, RotateCcw, X } from 'lucide-react'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import KpiCard from '@/components/ui/KpiCard'
import SoftChip from '@/components/ui/SoftChip'
import StatusPill from '@/components/ui/StatusPill'
import Button from '@/components/ui/Button'
import { Mono, Caption } from '@/components/ui/typography'
import { humanize } from '@/components/drawer/ConversationMessage'
import { useDateFormat } from '@/lib/datetime'
import { useWaWebQueueList, useWaWebQueueStats, useWaWebQueueActions } from './hooks/useWaWebQueue'
import type { WaWebQueueRow } from './hooks/useWaWebQueue'

// Status → semantic colour token (never a hardcoded hex — §4).
const STATUS_COLOR: Record<string, string> = {
  queued: 'var(--color-info)',
  sending: 'var(--color-secondary)',
  sent: 'var(--color-success)',
  failed: 'var(--color-danger)',
  paused: 'var(--text-muted)',
  canceled: 'var(--text-muted)',
}

export default function WaWebQueueTab({ status, canManage }: { status: string; canManage: boolean }) {
  const { t } = useTranslation('whatsapp')
  const { formatDateTime } = useDateFormat()
  const { data: rows = [], isLoading, isError } = useWaWebQueueList(status || undefined)
  const { data: stats = [], isLoading: statsLoading } = useWaWebQueueStats(rows.some(r => r.status === 'queued' || r.status === 'sending'))
  const { sendNow, pause, retry, cancel } = useWaWebQueueActions()

  // Row's number label: resolved from the stats strip (the only place the label
  // reaches the FE today — the queue row itself carries number_id only).
  const numberLabel = (numberId?: string | null) => stats.find(s => s.number_id === numberId)?.label ?? numberId ?? '—'

  const columns: Column<WaWebQueueRow>[] = [
    {
      key: 'number', header: t('waWebQueue.column.number'),
      render: r => <Mono>{numberLabel(r.number_id)}</Mono>,
    },
    {
      key: 'candidate', header: t('waWebQueue.column.candidate'),
      render: r => r.candidate?.name ?? <Caption as="span">{t('waWebQueue.noCandidate')}</Caption>,
    },
    {
      key: 'type', header: t('waWebQueue.column.type'),
      render: r => r.message_type ? <SoftChip label={r.message_type.label} color={r.message_type.color} /> : '—',
    },
    {
      key: 'status', header: t('waWebQueue.column.status'),
      render: r => <StatusPill label={t(`waWebQueue.status.${r.status}`, { defaultValue: humanize(r.status) })} color={STATUS_COLOR[r.status]} />,
    },
    {
      key: 'hold_reason', header: t('waWebQueue.column.holdReason'),
      render: r => r.hold_reason
        ? <Caption as="span" title={t(`waWebQueue.reason.${r.hold_reason}`, { defaultValue: humanize(r.hold_reason) })}>
            {t(`waWebQueue.reason.${r.hold_reason}`, { defaultValue: humanize(r.hold_reason) })}
          </Caption>
        : '—',
    },
    {
      key: 'scheduled_at', header: t('waWebQueue.column.scheduledAt'),
      render: r => r.scheduled_at ? formatDateTime(r.scheduled_at) : '—',
    },
    {
      key: 'attempts', header: t('waWebQueue.column.attempts'),
      render: r => <Mono>{r.attempts}</Mono>,
    },
    ...(canManage ? [{
      key: 'actions', header: t('waWebQueue.column.actions'), align: 'right' as const,
      render: (r: WaWebQueueRow) => (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          {/* Send now = pull a waiting (queued/paused) item forward; never re-send a sent one. */}
          {(r.status === 'queued' || r.status === 'paused') && (
            <Button size="sm" variant="secondary" iconOnly aria-label={t('waWebQueue.action.sendNow')}
              title={t('waWebQueue.action.sendNow')} onClick={() => sendNow.mutate(r.id)}>
              <Send size={13} />
            </Button>
          )}
          {r.status === 'queued' && (
            <Button size="sm" variant="secondary" iconOnly aria-label={t('waWebQueue.action.pause')}
              title={t('waWebQueue.action.pause')} onClick={() => pause.mutate(r.id)}>
              <Pause size={13} />
            </Button>
          )}
          {r.status === 'failed' && (
            <Button size="sm" variant="secondary" iconOnly aria-label={t('waWebQueue.action.retry')}
              title={t('waWebQueue.action.retry')} onClick={() => retry.mutate(r.id)}>
              <RotateCcw size={13} />
            </Button>
          )}
          {r.status !== 'canceled' && r.status !== 'sent' && (
            <Button size="sm" variant="dangerSoft" iconOnly aria-label={t('waWebQueue.action.cancel')}
              title={t('waWebQueue.action.cancel')} onClick={() => cancel.mutate(r.id)}>
              <X size={13} />
            </Button>
          )}
        </div>
      ),
    }] : []),
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Per-device stats strip — backlog, hourly rate limit, estimated drain. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        {statsLoading && <KpiCard label={t('waWebQueue.statsLoading')} loading />}
        {!statsLoading && stats.length === 0 && (
          <Caption as="div" style={{ padding: '8px 0' }}>{t('waWebQueue.noDevices')}</Caption>
        )}
        {stats.map(s => (
          <KpiCard key={s.number_id} label={s.label ?? s.number_id}
            value={t('waWebQueue.statValue', { count: s.in_queue })}
            // Rate limit is always shown; the drain estimate only exists while
            // the device actually has a positive rate (Outbox\'s own null case).
            note={s.est_drain != null
              ? t('waWebQueue.rateAndDrain', { rate: s.rate_limit, hours: s.est_drain })
              : t('waWebQueue.rateLimit', { rate: s.rate_limit })} />
        ))}
      </div>

      {/* Queue rows. */}
      <DataTable columns={columns} rows={rows} loading={isLoading}
        loadingText={t('waWebQueue.loading')}
        emptyText={isError ? t('waWebQueue.error') : t('waWebQueue.empty')} />
    </div>
  )
}
