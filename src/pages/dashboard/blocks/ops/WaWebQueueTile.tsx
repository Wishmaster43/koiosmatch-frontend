/**
 * WaWebQueueTile — ops tile: the WhatsApp Web send queue (K-193 fase 2b D).
 * Three headline figures (in queue / sending / failed, failed only colored
 * when > 0 per §12 "a count badge never renders on a plain zero" spirit),
 * an estimated-drain caption when a device is connected, and a compact
 * per-number breakdown. The Block header's action link deep-links to the
 * WhatsApp settings queue tab; each headline figure is its own link,
 * pre-filtered on that figure's status.
 */
import { useTranslation } from 'react-i18next'
import { Block } from '@/pages/dashboard/DashboardPrimitives'
import { BodyText, Caption } from '@/components/ui/typography'
import { interactive } from '@/lib/a11y'
import { useNumberFormat } from '@/lib/formatters'
import type { WaWebQueueFeed } from '@/types/dashboard'
import type { FeedTileContext } from '../feedTileKit'

// Ops tile (see the module doc above): renders the headline figures/breakdown; the header action link and each figure link deep-link to the WhatsApp queue settings tab.
export default function WaWebQueueTile({ feed, onNavigate }: {
  feed: WaWebQueueFeed
  onNavigate?: FeedTileContext['onNavigate']
}) {
  const { t } = useTranslation('dashboard')
  const { formatNumber } = useNumberFormat()
  const onOpenQueue = onNavigate ? () => onNavigate('whatsapp', { tab: 'wa-web-queue' }) : undefined
  // Each headline count deep-links pre-filtered on its own status — a click on
  // "failed: 2" must land on those 2 rows, never on the unfiltered queue.
  const onCount = (status: string) => onNavigate ? () => onNavigate('whatsapp', { tab: 'wa-web-queue', status }) : undefined

  // Three headline figures; failed only reads the danger token when it is a real, non-zero count.
  const figures: { key: string; label: string; value: number; status: string; danger?: boolean }[] = [
    { key: 'in_queue', label: t('feed.waWebQueue.inQueue'), value: feed.in_queue, status: 'queued' },
    { key: 'sending', label: t('feed.waWebQueue.sending'), value: feed.sending, status: 'sending' },
    { key: 'failed', label: t('feed.waWebQueue.failed'), value: feed.failed, status: 'failed', danger: feed.failed > 0 },
  ]

  return (
    // The whole-tile "open queue" affordance lives in the Block header action
    // link (mirrors ShiftCoverageHeatmap) rather than a role="button" wrapper —
    // that wrapper used to nest three more role="button" figures inside it,
    // an invalid nested-interactive pattern (§6).
    <Block title={t('block.waWebQueue')} action={onOpenQueue ? t('action.all') : undefined} onAction={onOpenQueue}>
      <div style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', gap: 20, marginBottom: 10 }}>
          {figures.map(f => (
            <div key={f.key} {...interactive(onCount(f.status))} style={{ cursor: onCount(f.status) ? 'pointer' : 'default' }}>
              {/* Headline figure shares the KpiCard 24/700 identity — no third headline size on the dashboard. */}
              <div style={{ fontSize: 24, fontWeight: 700, color: f.danger ? 'var(--color-danger-text)' : 'var(--text)' }}>
                {formatNumber(f.value)}
              </div>
              <Caption as="div">{f.label}</Caption>
            </div>
          ))}
        </div>
        {feed.est_drain_hours != null && (
          <Caption as="div" style={{ marginBottom: 8 }}>
            {t('feed.waWebQueue.estDrain', { hours: formatNumber(feed.est_drain_hours) })}
          </Caption>
        )}
        {feed.numbers.map((n, i) => (
          <div key={n.number_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0',
            borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
            <BodyText as="div" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {n.label || t('widget.unknown')}
            </BodyText>
            <Caption style={{ flexShrink: 0 }}>{t('feed.waWebQueue.numberRow', { inQueue: formatNumber(n.in_queue), rateLimit: formatNumber(n.rate_limit) })}</Caption>
          </div>
        ))}
      </div>
    </Block>
  )
}
