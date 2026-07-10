/**
 * QueueTab — the "Wachtrij" tab on the WhatsApp page: today's WABA batches
 * (GET /whatsapp-queue, R3a). Active batches (not yet finished) sit on top with
 * a live progress bar; finished batches sit below, muted. Polling lives in
 * useWhatsAppQueue and stops the moment no batch is still active anymore.
 */
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import SoftChip from '@/components/ui/SoftChip'
import { useDateFormat } from '@/lib/datetime'
import { useWhatsAppQueue, isBatchActive } from './hooks/useWhatsAppQueue'
import type { WaQueueBatch } from '@/types/whatsapp'

// One outcome count (sent/skipped/failed), coloured by meaning — never decoration.
function Count({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4, fontSize: 12, whiteSpace: 'nowrap' }}>
      <b style={{ color, fontFamily: "'JetBrains Mono', monospace" }}>{value}</b>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
    </span>
  )
}

// One batch row. `active` drives the live progress bar vs. the muted finished look.
function BatchRow({ batch, active }: { batch: WaQueueBatch; active: boolean }) {
  const { t } = useTranslation('whatsapp')
  const { formatDateTime } = useDateFormat()
  const sent      = batch.sent ?? 0
  const skipped   = batch.skipped ?? 0
  const failed    = batch.failed ?? 0
  const total     = batch.total || 0
  const processed = sent + skipped + failed
  const pct       = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 16px',
                  borderBottom: '1px solid var(--border)', opacity: active ? 1 : 0.7 }}>
      {/* Identity row: workflow + classification + meta + timestamps */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
          background: active ? 'var(--color-primary)' : 'var(--text-muted)' }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
          {batch.workflow_name ?? '—'}
        </span>
        {batch.message_type_label && <SoftChip label={batch.message_type_label} />}
        {batch.priority != null && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('queue.priority')}: {batch.priority}</span>
        )}
        {batch.tempo != null && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('queue.tempo')}: {batch.tempo}</span>
        )}
        {batch.phone_number_id && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
            {batch.phone_number_id}
          </span>
        )}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {batch.created_at ? formatDateTime(batch.created_at) : '—'}
          {batch.finished_at ? ` → ${formatDateTime(batch.finished_at)}` : ''}
        </span>
      </div>

      {/* Progress row: live bar while active + the three outcome counts */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {active && (
          <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
            style={{ flex: 1, height: 6, borderRadius: 999, background: 'var(--hover-bg)', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999,
              background: 'var(--color-primary)', transition: 'width 0.4s ease' }} />
          </div>
        )}
        <Count label={t('queue.sent')}    value={sent}    color="var(--color-success)" />
        <Count label={t('queue.skipped')} value={skipped} color="var(--text-muted)" />
        <Count label={t('queue.failed')}  value={failed}  color="var(--color-danger)" />
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: active ? 0 : 'auto', fontFamily: "'JetBrains Mono', monospace" }}>
          {processed}/{total}
        </span>
      </div>
    </div>
  )
}

export default function QueueTab() {
  const { t } = useTranslation('whatsapp')
  const { batches, loading, error, notAvailable } = useWhatsAppQueue()

  // Loading state.
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>
        <Loader2 size={14} className="animate-spin" /> {t('queue.loading')}
      </div>
    )
  }

  // Backend hasn't shipped GET /whatsapp-queue yet — calm, explicit state, not an error.
  if (notAvailable) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center' }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{t('queue.notAvailable')}</p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{t('queue.notAvailableDesc')}</p>
      </div>
    )
  }

  // A real failure (not a 404) — kept distinct from "empty" so a broken endpoint
  // never reads as "nothing queued today".
  if (error) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: 'var(--color-danger)' }}>
        {t('queue.error')}
      </div>
    )
  }

  // Empty — no batches queued or sent today.
  if (batches.length === 0) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
        {t('queue.empty')}
      </div>
    )
  }

  // Success — active batches (with a live progress bar) on top, finished ones muted below.
  const active   = batches.filter(isBatchActive)
  const finished = batches.filter(b => !isBatchActive(b))
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}>
      {active.length > 0 && (
        <div>
          <div style={{ padding: '10px 16px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
                        textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--hover-bg)' }}>
            {t('queue.active')} ({active.length})
          </div>
          {active.map(b => <BatchRow key={b.batch_id} batch={b} active />)}
        </div>
      )}
      {finished.length > 0 && (
        <div>
          <div style={{ padding: '10px 16px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
                        textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--hover-bg)' }}>
            {t('queue.finished')} ({finished.length})
          </div>
          {finished.map(b => <BatchRow key={b.batch_id} batch={b} active={false} />)}
        </div>
      )}
    </div>
  )
}
