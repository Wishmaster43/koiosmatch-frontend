/**
 * DrillPager · the shared prev/next stepper for a drawer drill-down. Covers: the
 * position text reflects the given index/total; prev/next each fire their own
 * callback; an undefined handler renders (and keeps) its button disabled — the
 * honest "first/last record" end, never a silent wrap-around.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import DrillPager from './DrillPager'

const ct = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'common', ...opts })

describe('DrillPager · position tooltip', () => {
  it('shows the 1-based index and total the caller passed in', () => {
    render(<DrillPager index={3} total={12} onPrev={vi.fn()} onNext={vi.fn()} />)
    expect(screen.getByTitle(ct('drillPager.nextAt', { index: 3, total: 12 }))).toBeInTheDocument()
  })
})

describe('DrillPager · honest ends, no wrap-around', () => {
  it('disables prev when there is no onPrev handler (first record)', () => {
    render(<DrillPager index={1} total={5} onNext={vi.fn()} />)
    expect(screen.getByRole('button', { name: ct('drillPager.prev') })).toBeDisabled()
    expect(screen.getByRole('button', { name: ct('drillPager.next') })).toBeEnabled()
  })

  it('disables next when there is no onNext handler (last record)', () => {
    render(<DrillPager index={5} total={5} onPrev={vi.fn()} />)
    expect(screen.getByRole('button', { name: ct('drillPager.next') })).toBeDisabled()
    expect(screen.getByRole('button', { name: ct('drillPager.prev') })).toBeEnabled()
  })

  it('disables BOTH when the caller has nothing to step to in either direction', () => {
    render(<DrillPager index={1} total={1} />)
    expect(screen.getByRole('button', { name: ct('drillPager.prev') })).toBeDisabled()
    expect(screen.getByRole('button', { name: ct('drillPager.next') })).toBeDisabled()
  })
})

describe('DrillPager · calls the right callback', () => {
  it('prev calls onPrev only, next calls onNext only', async () => {
    const user = userEvent.setup()
    const onPrev = vi.fn()
    const onNext = vi.fn()
    render(<DrillPager index={2} total={3} onPrev={onPrev} onNext={onNext} />)

    await user.click(screen.getByRole('button', { name: ct('drillPager.next') }))
    expect(onNext).toHaveBeenCalledTimes(1)
    expect(onPrev).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: ct('drillPager.prev') }))
    expect(onPrev).toHaveBeenCalledTimes(1)
    expect(onNext).toHaveBeenCalledTimes(1)
  })
})
