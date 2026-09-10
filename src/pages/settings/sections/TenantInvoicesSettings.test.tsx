/**
 * TenantInvoicesSettings (INVOICE-1) — request-seam tests: the invoices list
 * fetches the real GET route and renders the four UI states, and the download
 * button issues a real blob GET against /billing/invoices/{id}/download (never
 * only a callback assertion, §13).
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'
import apiClient from '@/lib/api'
// Cast to the mocked shape (vi.mock below replaces the real client with jest-style mocks).
const api = apiClient as unknown as { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> }
import TenantInvoicesSettings from './TenantInvoicesSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

const createObjectURL = vi.fn(() => 'blob:mock-url')
const revokeObjectURL = vi.fn()

function renderScreen() {
  return render(<I18nextProvider i18n={i18n}><TenantInvoicesSettings /></I18nextProvider>)
}

beforeEach(() => { i18n.changeLanguage('nl') })
afterEach(() => { vi.clearAllMocks() })

describe('TenantInvoicesSettings', () => {
  it('fetches GET /billing/invoices and renders the rows', async () => {
    api.get.mockResolvedValueOnce({ data: [
      { id: 'inv-1', number: 'KM-000001', period: '2026-07', total: 121, vat_amount: 21, status: 'final', finalized_at: '2026-08-01', sent_at: '2026-08-01' },
    ] })
    renderScreen()
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/billing/invoices', expect.any(Object)))
    expect(await screen.findByText('KM-000001')).toBeInTheDocument()
  })

  it('renders the empty state when no invoices exist', async () => {
    api.get.mockResolvedValueOnce({ data: [] })
    renderScreen()
    expect(await screen.findByText(i18n.t('billing.invoices.empty', { ns: 'settings' }))).toBeInTheDocument()
  })

  it('renders the error state on a failed fetch', async () => {
    api.get.mockRejectedValueOnce(new Error('network'))
    renderScreen()
    expect(await screen.findByText(i18n.t('billing.invoices.loadError', { ns: 'settings' }))).toBeInTheDocument()
  })

  it('downloads the PDF via a real blob GET on /billing/invoices/{id}/download', async () => {
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
    api.get.mockResolvedValueOnce({ data: [
      { id: 'inv-1', number: 'KM-000001', period: '2026-07', total: 121, vat_amount: 21, status: 'final', finalized_at: '2026-08-01', sent_at: '2026-08-01' },
    ] })
    api.get.mockResolvedValueOnce({ data: new Blob(['%PDF'], { type: 'application/pdf' }) })
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    renderScreen()
    const button = await screen.findByRole('button', { name: i18n.t('billing.invoices.download', { ns: 'settings' }) })
    await userEvent.click(button)

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/billing/invoices/inv-1/download', { responseType: 'blob' }))
    expect(createObjectURL).toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalled()

    clickSpy.mockRestore()
    vi.unstubAllGlobals()
  })

  // SMZ-13: the endpoint paginates at 20/page (GET /billing/invoices returns
  // {data, meta}); page 2 must be requested explicitly and its rows rendered —
  // never the empty state, which is reserved for total === 0.
  it('requests page 2 (params.page = 2) on next-page and renders its rows, not the empty state', async () => {
    api.get.mockResolvedValueOnce({ data: {
      data: [{ id: 'inv-1', number: 'KM-000001', period: '2026-07', total: 121, vat_amount: 21, status: 'final', finalized_at: '2026-08-01', sent_at: '2026-08-01' }],
      meta: { current_page: 1, last_page: 2, per_page: 20, total: 25 },
    } })
    api.get.mockResolvedValueOnce({ data: {
      data: [{ id: 'inv-2', number: 'KM-000021', period: '2026-08', total: 121, vat_amount: 21, status: 'final', finalized_at: '2026-09-01', sent_at: '2026-09-01' }],
      meta: { current_page: 2, last_page: 2, per_page: 20, total: 25 },
    } })

    renderScreen()
    expect(await screen.findByText('KM-000001')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: i18n.t('nextPage', { ns: 'common' }) }))

    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/billing/invoices', expect.objectContaining({ params: { page: 2 } })))
    expect(await screen.findByText('KM-000021')).toBeInTheDocument()
    expect(screen.queryByText(i18n.t('billing.invoices.empty', { ns: 'settings' }))).not.toBeInTheDocument()
  })

  // A page change must never unmount the table/pager while the next page is
  // in flight or if it fails — the user still has rows to look at and a way
  // to navigate back (verdict item 4).
  it('keeps the table + pager mounted when a subsequent page request fails, without re-showing the spinner', async () => {
    api.get.mockResolvedValueOnce({ data: {
      data: [{ id: 'inv-1', number: 'KM-000001', period: '2026-07', total: 121, vat_amount: 21, status: 'final', finalized_at: '2026-08-01', sent_at: '2026-08-01' }],
      meta: { current_page: 1, last_page: 2, per_page: 20, total: 25 },
    } })
    api.get.mockRejectedValueOnce(new Error('network'))

    renderScreen()
    expect(await screen.findByText('KM-000001')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: i18n.t('nextPage', { ns: 'common' }) }))

    expect(await screen.findByText(i18n.t('billing.invoices.loadError', { ns: 'settings' }))).toBeInTheDocument()
    // Stale row + the prev-page control stay mounted so the user can go back.
    expect(screen.getByText('KM-000001')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: i18n.t('prevPage', { ns: 'common' }) })).toBeInTheDocument()
  })
})
