/**
 * MatchDurationBar — M25 (contract duration label) + M26 (progress indicator,
 * "nog 53% te gaan") on the Overview tab. Renders only once BOTH start and end
 * dates are set (computeMatchDuration returns null otherwise — an honest
 * absence, not a fake 0% bar). Soft-tint fill (§4: color-mix on the primary
 * token, never a solid fill) — track in --border, fill in the primary token.
 */
import { useTranslation } from 'react-i18next'
import { computeMatchDuration } from '../matchDuration'

interface Props {
  startDate: string | null | undefined
  endDate: string | null | undefined
}

// Contract-duration label plus progress bar; renders nothing unless both start and end dates are set, an honest absence rather than a fake 0% bar (see file header).
export default function MatchDurationBar({ startDate, endDate }: Props) {
  const { t } = useTranslation('matches')
  const duration = computeMatchDuration(startDate, endDate)
  if (!duration) return null

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: 'var(--text)' }}>
          {t(`drawer.duration.unit.${duration.unit}`, { count: duration.amount })}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {t('drawer.duration.remaining', { pct: duration.remainingPct })}
        </span>
      </div>
      {/* Soft-tint progress track — fill = elapsed %, never a solid-color bar (§4). */}
      <div role="progressbar" aria-valuenow={duration.elapsedPct} aria-valuemin={0} aria-valuemax={100}
        aria-label={t('drawer.duration.progressLabel')}
        style={{ height: 6, borderRadius: 99, background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${duration.elapsedPct}%`, borderRadius: 99,
          background: 'color-mix(in srgb, var(--color-primary) 55%, transparent)', transition: 'width 0.2s' }} />
      </div>
    </div>
  )
}
