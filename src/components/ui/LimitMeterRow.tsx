/**
 * LimitMeterRow — the ONE meter for "how much of a limit is used" (LIMIET-MONITOR-1):
 * label, a §4-tinted progress bar when a cap exists, "used / cap · per window" and
 * the percent. Warning tint from 80%, danger tint at the cap. `cap: null` = no
 * limit (number only, no bar). `enforced: false` is a budget SIGNAL, never a hard
 * limit: at its cap it reads "signaal, niet geblokkeerd", never "limiet bereikt".
 */
import { useTranslation } from 'react-i18next'
import { useNumberFormat } from '@/lib/formatters'
import { tintBg } from '@/lib/tint'
import { Caption, BodyText } from '@/components/ui/typography'

// The fields every limits row shares (tenant rows carry no `enforced`; platform rows do).
export interface LimitMeter {
  label: string
  window: 'hour' | 'day' | 'week' | 'month'
  used: number
  cap: number | null
  percent: number | null
  cap_reached: boolean
  enforced?: boolean
}

// The percent from which the bar reads as a warning (matches the backend's 80-level alert).
const WARNING_PERCENT = 80

export default function LimitMeterRow({ meter }: { meter: LimitMeter }) {
  const { t } = useTranslation('settings')
  const { formatNumber } = useNumberFormat()
  const unlimited = meter.cap === null
  const percent = Math.max(0, meter.percent ?? 0)

  // Bar tint: danger at the cap, warning from 80%, otherwise the neutral info tone.
  const tone = meter.cap_reached ? 'var(--color-danger)'
    : percent >= WARNING_PERCENT ? 'var(--color-warning)'
    : 'var(--color-info)'

  // Status caption: only the states that change what the user should do.
  const status = unlimited ? t('limits.no_limit')
    : meter.cap_reached ? (meter.enforced === false ? t('limits.signal_not_blocked') : t('limits.cap_reached'))
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <BodyText style={{ fontWeight: 600 }}>{meter.label}</BodyText>
        {status && <Caption style={{ color: meter.cap_reached && meter.enforced !== false ? 'var(--color-danger-text)' : undefined }}>{status}</Caption>}
      </div>
      {!unlimited && (
        <div role="progressbar" aria-label={meter.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(percent, 100)}
          style={{ height: 6, borderRadius: 999, overflow: 'hidden', background: tintBg(tone) }}>
          <div style={{ height: '100%', width: `${Math.min(percent, 100)}%`, background: tone, transition: 'width var(--motion-fast)' }} />
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <Caption>
          {formatNumber(meter.used)}{unlimited ? '' : ` / ${formatNumber(meter.cap ?? 0)}`} · {t(`limits.window.${meter.window}`)}
        </Caption>
        {!unlimited && <Caption>{percent}%</Caption>}
      </div>
    </div>
  )
}
