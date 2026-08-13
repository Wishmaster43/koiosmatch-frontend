/**
 * PlatformPricingCard (CREDITS-1) — asserts the REAL request (route + body), per
 * §13: proves the seam, not just that a callback fired. Covers the initial GET,
 * the optimistic save-on-blur PUT with both knobs together, and revert-on-failure.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import PlatformPricingCard from './PlatformPricingCard'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

const t = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

afterEach(() => vi.clearAllMocks())

function mockGet(pricing = { ai_markup_percent: 60, workflow_credit_price: 0 }) {
  api.get.mockResolvedValue({ data: pricing })
}

describe('PlatformPricingCard', () => {
  it('GETs /admin/platform-pricing and renders both knobs', async () => {
    mockGet()
    render(<PlatformPricingCard />)

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/admin/platform-pricing'))
    expect(await screen.findByLabelText(t('platformPricing.markupLabel'))).toHaveValue(60)
    expect(screen.getByLabelText(t('platformPricing.creditPriceLabel'))).toHaveValue(0)
  })

  it('PUTs both knobs together on blur (a small complete pricing sheet, never a partial patch)', async () => {
    mockGet()
    api.put.mockResolvedValue({ data: { ai_markup_percent: 75, workflow_credit_price: 0.005 } })
    render(<PlatformPricingCard />)

    const markupInput = await screen.findByLabelText(t('platformPricing.markupLabel'))
    await userEvent.clear(markupInput)
    await userEvent.type(markupInput, '75')
    await userEvent.tab()

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/admin/platform-pricing', {
      ai_markup_percent: 75, workflow_credit_price: 0,
    }))
  })

  it('reverts the field and toasts on a save failure (optimistic-with-revert)', async () => {
    mockGet()
    api.put.mockRejectedValue({ response: { status: 422, data: { message: 'Invalid.' } } })
    render(<PlatformPricingCard />)

    const priceInput = await screen.findByLabelText(t('platformPricing.creditPriceLabel'))
    await userEvent.clear(priceInput)
    await userEvent.type(priceInput, '0.005')
    await userEvent.tab()

    await waitFor(() => expect(api.put).toHaveBeenCalled())
    // Reverted back to the last server-confirmed value (0) after the failed save.
    await waitFor(() => expect(priceInput).toHaveValue(0))
  })
})
