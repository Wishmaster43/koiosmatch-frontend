/**
 * QueueTab — the "Wachtrij" tab on the WhatsApp page: today's WABA batches
 * (GET /whatsapp-queue, R3a). Active batches (not yet finished) sit on top with
 * a live progress bar; finished batches sit below, muted.
 *
 * WA-KPI9-1: the useWhatsAppQueue() hook (data + 5s polling) now lives in
 * WhatsAppPage instead of here — the KPI band above the tabs needs these same
 * batches (queued/failed today) regardless of which tab is active, so a second,
 * tab-local instance of the hook would double the polling and the request count.
 * This component stays presentational; it only renders what the page hands it.
 */
import { useTranslation } from 'react-i18next'
import SoftChip from '@/components/ui/SoftChip'
import Spinner from '@/components/ui/Spinner'
import { Mono, Caption, BodyText, GroupLabel } from '@/components/ui/typography'
import { useDateFormat } from '@/lib/datetime'
import { humanize } from '@/components/drawer/ConversationMessage'
import { isBatchActive } from './hooks/useWhatsAppQueue'
import type { WaQueueBatch } from '@/types/whatsapp'

// One outcome count (sent/skipped/failed), coloured by meaning — never decoration.
function Count({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4, fontSize: 12, whiteSpace: 'nowrap' }}>
      <Mono as="b" style={{ color, fontWeight: 700 }}>{value}</Mono>
      <Caption as="span">{label}</Caption>
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
        {/* a status DOT (active/finished), not a button — no Button variant applies */}
        <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
          // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- see comment above
          background: active ? 'var(--color-primary)' : 'var(--text-muted)' }} />
        <BodyText as="span" style={{ fontWeight: 600 }}>
          {batch.workflow_name ?? '—'}
        </BodyText>
        {batch.message_type_label && <SoftChip label={batch.message_type_label} />}
        {/* K-194 (e): priority arrives as a slug (high|normal|low) — translate it,
            never render the slug raw (§5). */}
        {batch.priority != null && (
          <Caption as="span">
            {t('queue.priority')}: {t(`queue.priorityLevel.${batch.priority}`, { defaultValue: humanize(batch.priority) })}
          </Caption>
        )}
        {batch.tempo != null && (
          <Caption as="span">{t('queue.tempo')}: {batch.tempo}</Caption>
        )}
        {batch.phone_number_id && <Caption as="span"><Mono as="span">{batch.phone_number_id}</Mono></Caption>}
        <div style={{ flex: 1 }} />
        <Caption as="span" style={{ whiteSpace: 'nowrap' }}>
          {batch.created_at ? formatDateTime(batch.created_at) : '—'}
          {batch.finished_at ? ` → ${formatDateTime(batch.finished_at)}` : ''}
        </Caption>
      </div>

      {/* Progress row: live bar while active + the three outcome counts */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {active && (
          <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
            style={{ flex: 1, height: 6, borderRadius: 999, background: 'var(--hover-bg)', overflow: 'hidden' }}>
            {/* a progress-bar FILL, not a button — no Button variant applies */}
            <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999,
              // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- see comment above
              background: 'var(--color-primary)', transition: 'width 0.4s ease' }} />
          </div>
        )}
        <Count label={t('queue.sent')}    value={sent}    color="var(--color-success)" />
        <Count label={t('queue.skipped')} value={skipped} color="var(--text-muted)" />
        <Count label={t('queue.failed')}  value={failed}  color="var(--color-danger)" />
        <Caption as="span" style={{ marginLeft: active ? 0 : 'auto' }}>
          <Mono as="span">{processed}/{total}</Mono>
        </Caption>
      </div>
    </div>
  )
}

// Batches + their loading/error/notAvailable state, lifted to WhatsAppPage so the
// KPI band and this tab share the one polled fetch (see the file header above).
interface QueueTabProps {
  batches: WaQueueBatch[]
  loading: boolean
  error: boolean
  notAvailable: boolean
}

export default function QueueTab({ batches, loading, error, notAvailable }: QueueTabProps) {
  const { t } = useTranslation('whatsapp')

  // Loading state.
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>
        <Spinner size={14} /> {t('queue.loading')}
      </div>
    )
  }

  // Backend hasn't shipped GET /whatsapp-queue yet — calm, explicit state, not an error.
  if (notAvailable) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center' }}>
        <BodyText as="p" style={{ fontWeight: 600 }}>{t('queue.notAvailable')}</BodyText>
        <Caption as="p" style={{ marginTop: 4 }}>{t('queue.notAvailableDesc')}</Caption>
      </div>
    )
  }

  // A real failure (not a 404) — kept distinct from "empty" so a broken endpoint
  // never reads as "nothing queued today".
  if (error) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: 'var(--color-danger-text)' }}>
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
          <GroupLabel style={{ padding: '10px 16px', background: 'var(--hover-bg)' }}>
            {t('queue.active')} ({active.length})
          </GroupLabel>
          {active.map(b => <BatchRow key={b.batch_id} batch={b} active />)}
        </div>
      )}
      {finished.length > 0 && (
        <div>
          <GroupLabel style={{ padding: '10px 16px', background: 'var(--hover-bg)' }}>
            {t('queue.finished')} ({finished.length})
          </GroupLabel>
          {finished.map(b => <BatchRow key={b.batch_id} batch={b} active={false} />)}
        </div>
      )}
    </div>
  )
}
