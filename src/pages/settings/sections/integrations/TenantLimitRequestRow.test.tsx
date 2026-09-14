/**
 * TenantLimitRequestRow — asserts the mode sentence, the approval badge, the
 * POST route on "request an increase", and that a tier-driven row (settable and
 * can_request both false, as the BE serves them) renders nothing (§3 no fake affordance).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import i18n from '@/i18n'
import TenantLimitRequestRow from './TenantLimitRequestRow'
import type { TenantLimitRow } from './limitsApi'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn() } }
})

const t = (k: string, o?: Record<string, unknown>) => i18n.t(k, { ns: 'settings', ...o })

const baseRow: TenantLimitRow = {
  key: 'geocode_search', label: 'Adres zoeken (geocoding)', scope: 'tenant', window: 'day',
  used: 10, cap: 500, percent: 2, cap_reached: false, mode: 'block', mode_effective: 'block', mode_fixed: true,
  cap_source: 'config', settable: true, can_request: true, approval: null,
}

beforeEach(() => vi.clearAllMocks())

const renderRow = (row: TenantLimitRow) => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><TenantLimitRequestRow row={row} /></QueryClientProvider>,
)

describe('TenantLimitRequestRow', () => {
  it('shows the mode sentence', () => {
    renderRow(baseRow)
    expect(screen.getByText(`${t('limits.at_cap_prefix')} ${t('limits.mode.block')}`)).toBeInTheDocument()
  })

  it('POSTs the request route with no body beyond an optional note', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { status: 'requested' } })
    const user = userEvent.setup()
    renderRow(baseRow)
    await user.click(screen.getByRole('button', { name: t('limits.request.button') }))
    expect(api.post).toHaveBeenCalledWith('/settings/integrations/limits/geocode_search/request', { note: undefined })
    expect(await screen.findByText(t('limits.request.requested'))).toBeInTheDocument()
  })

  it('renders nothing for a tier-driven row (settable and can_request both false, no mode) — never a dead button or an empty box', () => {
    const { container } = renderRow({ ...baseRow, settable: false, can_request: false, mode: null, mode_effective: null })
    expect(container.innerHTML).toBe('')
    expect(screen.queryByRole('button', { name: t('limits.request.button') })).not.toBeInTheDocument()
  })

  it('shows the active approval badge', () => {
    renderRow({ ...baseRow, approval: { id: 'a1', until: '2026-09-30', extra_cap: 200 } })
    expect(screen.getByText(new RegExp(t('limits.approval.active', { date: '30-09-2026', extra: '200' })))).toBeInTheDocument()
  })

  it('shows a distinct message for already_requested_today, never the plain "requested" text', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { status: 'already_requested_today' } })
    const user = userEvent.setup()
    renderRow(baseRow)
    await user.click(screen.getByRole('button', { name: t('limits.request.button') }))
    expect(await screen.findByText(t('limits.request.already_requested_today'))).toBeInTheDocument()
    expect(screen.queryByText(t('limits.request.requested'))).not.toBeInTheDocument()
  })

  it('shows a distinct message for no_recipient, never claiming success', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { status: 'no_recipient' } })
    const user = userEvent.setup()
    renderRow(baseRow)
    await user.click(screen.getByRole('button', { name: t('limits.request.button') }))
    expect(await screen.findByText(t('limits.request.no_recipient'))).toBeInTheDocument()
    expect(screen.queryByText(t('limits.request.requested'))).not.toBeInTheDocument()
  })

  it('renders an inline error when the request POST is rejected, never a silent failure', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({ response: { data: { message: 'Kon de aanvraag niet versturen.' } } })
    const user = userEvent.setup()
    renderRow(baseRow)
    await user.click(screen.getByRole('button', { name: t('limits.request.button') }))
    expect(await screen.findByText('Kon de aanvraag niet versturen.')).toBeInTheDocument()
  })
})
