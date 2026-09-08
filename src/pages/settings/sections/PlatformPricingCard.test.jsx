/**
 * PlatformPricingCard (CREDITS-1) — asserts the REAL request (route + body), per
 * §13: the initial GET, the save-on-commit PUT of the AI markup alone (the USD→EUR
 * rate is no longer on the screen and never in the body, Danny 09-09), the pointer
 * to the workflow-token overage price, and revert-on-failure.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
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
  it('GETs /admin/platform-pricing, renders the markup knob and never the fx rate', async () => {
    mockGet()
    render(<PlatformPricingCard />)
    // step 0.01 → the field rests on two decimals.
    expect(await screen.findByLabelText(t('platformPricing.markupLabel'))).toHaveValue('60,00')
    expect(api.get).toHaveBeenCalledWith('/admin/platform-pricing')
    expect(screen.queryByText(/USD/)).toBeNull()
    // The workflow-token price is managed on the tiers card; this card only points there.
    expect(screen.getByText(t('platformPricing.workflowTokenPriceWhere'))).toBeInTheDocument()
  })

  it('PUTs ai_markup_percent alone when the field commits', async () => {
    mockGet()
    api.put.mockResolvedValue({ data: { ai_markup_percent: 75 } })
    render(<PlatformPricingCard />)
    const input = await screen.findByLabelText(t('platformPricing.markupLabel'))
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '75' } })
    fireEvent.blur(input)
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/admin/platform-pricing', { ai_markup_percent: 75 }))
    await waitFor(() => expect(notifySuccess).toHaveBeenCalled())
  })

  it('reverts the field and toasts on a save failure (optimistic-with-revert)', async () => {
    mockGet()
    api.put.mockRejectedValue({ response: { status: 422, data: { message: 'nee' } } })
    render(<PlatformPricingCard />)
    const input = await screen.findByLabelText(t('platformPricing.markupLabel'))
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '75' } })
    fireEvent.blur(input)
    await waitFor(() => expect(api.put).toHaveBeenCalled())
    await waitFor(() => expect(input).toHaveValue('60,00'))
  })
})
