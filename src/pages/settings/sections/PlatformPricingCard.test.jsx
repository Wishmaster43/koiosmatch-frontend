/**
 * PlatformPricingCard (CREDITS-1) — asserts the REAL request (route + body), per
 * §13: proves the seam, not just that a callback fired. Covers the initial GET,
 * the optimistic save-on-blur PUT of the AI markup and fx_usd_eur knobs (B-26),
 * and revert-on-failure. PRIJSMODEL-C (30-08): the workflow credit-price knob is
 * gone from this endpoint.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import PlatformPricingCard from './PlatformPricingCard'
import { notifySuccess } from '@/lib/notify'

vi.mock('@/lib/notify', async () => {
  const actual = await vi.importActual('@/lib/notify')
  return { ...actual, notifyError: vi.fn(), notifySuccess: vi.fn() }
})

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

const t = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

afterEach(() => vi.clearAllMocks())

function mockGet(pricing = { ai_markup_percent: 60, fx_usd_eur: 1.05 }) {
  api.get.mockResolvedValue({ data: pricing })
}

describe('PlatformPricingCard', () => {
  it('GETs /admin/platform-pricing and renders both markup and fx_usd_eur knobs', async () => {
    mockGet()
    render(<PlatformPricingCard />)
    expect(await screen.findByLabelText(t('platformPricing.markupLabel'))).toHaveValue(60)
    expect(screen.getByLabelText(t('platformPricing.fxUsdEurLabel'))).toHaveValue(1.05)
    expect(api.get).toHaveBeenCalledWith('/admin/platform-pricing')
    // The workflow credit-price knob is gone; the overage price lives in the tiers card.
    expect(screen.queryByText(/creditprijs/i)).toBeNull()
  })

  it('PUTs both ai_markup_percent and fx_usd_eur on blur of markup field', async () => {
    mockGet()
    api.put.mockResolvedValue({ data: { ai_markup_percent: 75, fx_usd_eur: 1.05 } })
    render(<PlatformPricingCard />)
    const user = userEvent.setup()
    const input = await screen.findByLabelText(t('platformPricing.markupLabel'))
    await user.clear(input); await user.type(input, '75'); await user.tab()
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/admin/platform-pricing', { ai_markup_percent: 75, fx_usd_eur: 1.05 }))
    await waitFor(() => expect(notifySuccess).toHaveBeenCalled())
  })

  it('PUTs both fields when fx_usd_eur is changed', async () => {
    mockGet()
    api.put.mockResolvedValue({ data: { ai_markup_percent: 60, fx_usd_eur: 1.1 } })
    render(<PlatformPricingCard />)
    const user = userEvent.setup()
    const fxInput = await screen.findByLabelText(t('platformPricing.fxUsdEurLabel'))
    await user.clear(fxInput); await user.type(fxInput, '1.1'); await user.tab()
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/admin/platform-pricing', { ai_markup_percent: 60, fx_usd_eur: 1.1 }))
    await waitFor(() => expect(notifySuccess).toHaveBeenCalled())
  })

  it('reverts the field and toasts on a save failure (optimistic-with-revert)', async () => {
    mockGet()
    api.put.mockRejectedValue({ response: { status: 422, data: { message: 'nee' } } })
    render(<PlatformPricingCard />)
    const user = userEvent.setup()
    const input = await screen.findByLabelText(t('platformPricing.markupLabel'))
    await user.clear(input); await user.type(input, '75'); await user.tab()
    await waitFor(() => expect(api.put).toHaveBeenCalled())
    await waitFor(() => expect(input).toHaveValue(60))
  })
})
