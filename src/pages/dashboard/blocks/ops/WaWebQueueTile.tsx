/**
 * WaWebQueueTile — ops tile: the WhatsApp Web send queue (K-193 fase 2b D).
 * Three headline figures (in queue / sending / failed, failed only colored
 * when > 0 per §12 "a count badge never renders on a plain zero" spirit),
 * an estimated-drain caption when a device is connected, and a compact
 * per-number breakdown. Clicking the tile deep-links to the WhatsApp
 * settings queue tab (registered by lane F1A).
 */
import { useTranslation } from 'react-i18next'
import { Block } from '@/pages/dashboard/DashboardPrimitives'
import { BodyText, Caption } from '@/components/ui/typography'
import { interactive } from '@/lib/a11y'
import { useNumberFormat } from '@/lib/formatters'
import type { WaWebQueueFeed } from '@/types/dashboard'
import type { FeedTileContext } from '../feedTileKit'

// Ops tile (see the module doc above): renders the headline figures/breakdown; clicking it deep-links to the WhatsApp queue settings tab.
export default function WaWebQueueTile({ feed, onNavigate }: {
  feed: WaWebQueueFeed
  onNavigate?: FeedTileContext['onNavigate']
}) {
  const { t } = useTranslation('dashboard')
  const { formatNumber } = useNumberFormat()
  const onClick = onNavigate ? () => onNavigate('whatsapp', { tab: 'wa-web-queue' }) : undefined
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
    <Block title={t('block.waWebQueue')}>
      <div {...interactive(onClick)} style={{ padding: '12px 16px', cursor: onClick ? 'pointer' : 'default' }}>
        <div style={{ display: 'flex', gap: 20, marginBottom: 10 }}>
          {figures.map(f => (
            <div key={f.key} {...interactive(onCount(f.status))}
              onClick={e => { e.stopPropagation(); onCount(f.status)?.() }}>
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
