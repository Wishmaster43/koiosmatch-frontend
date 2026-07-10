/**
 * FanoutSummary — compact batch-progress card shown above OutputTree in a step's
 * "Uitvoering" (execution) tab whenever its output carries `whatsapp_fanout` (the
 * WABA queue batch a whatsapp_send step fanned out into, R3a/CMBE 2026-07-09).
 * Renders nothing for any other module — ConfigPanel stays a thin pass-through.
 */
import { useTranslation } from 'react-i18next'
import SoftChip from '@/components/ui/SoftChip'

// The step-output shape the backend embeds under `output.whatsapp_fanout`.
export interface WaFanout {
  batch_id?: string
  total?: number
  sent?: number
  skipped?: number
  failed?: number
  status?: string
  [k: string]: unknown
}

// Batch status → colour; unknown/missing statuses fall back to muted.
const STATUS_COLOR: Record<string, string> = {
  queued: 'var(--text-muted)',
  processing: 'var(--color-primary)',
  finished: 'var(--color-success)',
  failed: 'var(--color-danger)',
}

// One outcome count (sent/skipped/failed/total), coloured by meaning.
function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4, fontSize: 12 }}>
      <b style={{ color, fontFamily: "'JetBrains Mono', monospace" }}>{value}</b>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
    </span>
  )
}

export default function FanoutSummary({ fanout }: { fanout: WaFanout }) {
  const { t } = useTranslation('workflows')
  const statusKey   = String(fanout.status ?? '').toLowerCase()
  const statusColor = STATUS_COLOR[statusKey] ?? 'var(--text-muted)'
  const statusLabel = t(`wa.fanout.status.${statusKey}`, { defaultValue: fanout.status ?? '—' })

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px',
                  marginBottom: 10, background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Header row: title + status chip */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {t('wa.fanout.title')}
        </span>
        <SoftChip label={statusLabel} color={statusColor} round />
      </div>
      {/* Counts row */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <Stat label={t('wa.fanout.sent')}    value={fanout.sent ?? 0}    color="var(--color-success)" />
        <Stat label={t('wa.fanout.skipped')} value={fanout.skipped ?? 0} color="var(--text-muted)" />
        <Stat label={t('wa.fanout.failed')}  value={fanout.failed ?? 0}  color="var(--color-danger)" />
        <Stat label={t('wa.fanout.total')}   value={fanout.total ?? 0}   color="var(--text)" />
      </div>
      {/* Batch id — muted mono, for cross-referencing the Wachtrij tab */}
      {fanout.batch_id && (
        <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)' }}>
          {fanout.batch_id}
        </div>
      )}
    </div>
  )
}
