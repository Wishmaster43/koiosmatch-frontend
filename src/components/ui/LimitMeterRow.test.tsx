/**
 * LimitMeterRow — the meter's four faces: capped (bar + percent + window), uncapped
 * (number only, "geen limiet", no bar), at the cap (danger caption) and an
 * unenforced budget signal at its cap (never the hard-limit wording).
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import i18n from '@/i18n'
import LimitMeterRow, { type LimitMeter } from './LimitMeterRow'

const meter = (over: Partial<LimitMeter> = {}): LimitMeter =>
  ({ label: 'Koios AI-tokens', window: 'month', used: 12000, cap: 50000, percent: 24, cap_reached: false, ...over })

const t = (k: string) => i18n.t(k, { ns: 'settings' })

describe('LimitMeterRow', () => {
  it('capped: shows used / cap with the window, the percent and a bar', () => {
    render(<LimitMeterRow meter={meter()} />)
    expect(screen.getByText('Koios AI-tokens')).toBeInTheDocument()
    expect(screen.getByText('12.000 / 50.000 · ' + t('limits.window.month'))).toBeInTheDocument()
    expect(screen.getByText('24%')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Koios AI-tokens' })).toHaveAttribute('aria-valuenow', '24')
  })

  it('uncapped: number only, "geen limiet", no bar and no percent', () => {
    render(<LimitMeterRow meter={meter({ cap: null, percent: null, used: 340, window: 'day' })} />)
    expect(screen.getByText('340 · ' + t('limits.window.day'))).toBeInTheDocument()
    expect(screen.getByText(t('limits.no_limit'))).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.queryByText(/%$/)).not.toBeInTheDocument()
  })

  it('at the cap: the hard-limit caption and a bar clamped to 100', () => {
    render(<LimitMeterRow meter={meter({ used: 60000, percent: 120, cap_reached: true, enforced: true })} />)
    expect(screen.getByText(t('limits.cap_reached'))).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
  })

  it('an unenforced budget signal at its cap never reads as a hard limit', () => {
    render(<LimitMeterRow meter={meter({ percent: 100, cap_reached: true, enforced: false })} />)
    expect(screen.getByText(t('limits.signal_not_blocked'))).toBeInTheDocument()
    expect(screen.queryByText(t('limits.cap_reached'))).not.toBeInTheDocument()
  })
})
