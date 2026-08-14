/**
 * AdminInvoicesSettings (INVOICE-1, super-admin) — request-seam tests for the
 * generate/finalize/resend/export/download actions: each asserts the real route
 * and body, never only that a callback fired (§13). Finalize semantics: a
 * final-but-undelivered invoice shows "Opnieuw versturen" and calls the SAME
 * finalize endpoint (the re-send path), a draft shows "Finaliseren".
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'
import apiClient from '@/lib/api'
// Cast to the mocked shape (vi.mock below replaces the real client with jest-style mocks).
const api = apiClient as unknown as { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> }
import AdminInvoicesSettings from './AdminInvoicesSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

const createObjectURL = vi.fn(() => 'blob:mock-url')
const revokeObjectURL = vi.fn()

function renderScreen() {
  return render(<I18nextProvider i18n={i18n}><AdminInvoicesSettings /></I18nextProvider>)
}

beforeEach(() => { i18n.changeLanguage('nl') })
afterEach(() => { vi.clearAllMocks() })

describe('AdminInvoicesSettings', () => {
  it('fetches GET /admin/invoices?month= on load', async () => {
    api.get.mockResolvedValueOnce({ data: [] })
    renderScreen()
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/admin/invoices', expect.objectContaining({ params: expect.objectContaining({ month: expect.any(String) }) })))
  })

  it('generate posts POST /admin/invoices/generate with the selected month', async () => {
    api.get.mockResolvedValue({ data: [] })
    api.post.mockResolvedValueOnce({ data: {} })
    renderScreen()
    const btn = await screen.findByRole('button', { name: i18n.t('adminInvoices.generate', { ns: 'settings' }) })
    await userEvent.click(btn)
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/invoices/generate', expect.objectContaining({ month: expect.any(String) })))
  })

  it('shows "Finaliseren" for a draft and posts the finalize route', async () => {
    api.get.mockResolvedValueOnce({ data: [
      { id: 'inv-d', tenant_id: 't1', tenant_name: 'Yesway', number: null, period: '2026-08', status: 'draft', total: 100, vat_amount: 21, finalized_at: null, sent_at: null },
    ] })
    api.post.mockResolvedValueOnce({ data: {} })
    api.get.mockResolvedValueOnce({ data: [] }) // reload after finalize
    renderScreen()
    const btn = await screen.findByRole('button', { name: i18n.t('adminInvoices.finalize', { ns: 'settings' }) })
    await userEvent.click(btn)
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/invoices/inv-d/finalize'))
  })

  it('shows "Opnieuw versturen" for a final-but-undelivered invoice and hits the same finalize route', async () => {
    api.get.mockResolvedValueOnce({ data: [
      { id: 'inv-f', tenant_id: 't1', tenant_name: 'Yesway', number: 'KM-000002', period: '2026-08', status: 'final', total: 100, vat_amount: 21, finalized_at: '2026-08-02', sent_at: null },
    ] })
    api.post.mockResolvedValueOnce({ data: {} })
    api.get.mockResolvedValueOnce({ data: [] })
    renderScreen()
    const btn = await screen.findByRole('button', { name: i18n.t('adminInvoices.resend', { ns: 'settings' }) })
    await userEvent.click(btn)
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/invoices/inv-f/finalize'))
  })

  it('downloads a final invoice PDF via a real blob GET', async () => {
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
    api.get.mockResolvedValueOnce({ data: [
      { id: 'inv-f', tenant_id: 't1', tenant_name: 'Yesway', number: 'KM-000002', period: '2026-08', status: 'final', total: 100, vat_amount: 21, finalized_at: '2026-08-02', sent_at: '2026-08-02' },
    ] })
    api.get.mockResolvedValueOnce({ data: new Blob(['%PDF'], { type: 'application/pdf' }) })
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    renderScreen()
    const btn = await screen.findByRole('button', { name: i18n.t('adminInvoices.download', { ns: 'settings' }) })
    await userEvent.click(btn)
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/admin/invoices/inv-f/download', { params: {}, responseType: 'blob' }))

    clickSpy.mockRestore()
    vi.unstubAllGlobals()
  })

  // i18n coverage: every label renders the translated key value, never a raw
  // Dutch/English literal or an unresolved 'adminInvoices.*' key string.
  it('renders every visible label from t() in both nl and en, never a raw literal or unresolved key', async () => {
    for (const lng of ['nl', 'en']) {
      i18n.changeLanguage(lng)
      api.get.mockResolvedValueOnce({ data: [
        { id: 'inv-d', tenant_id: 't1', tenant_name: 'Yesway', number: null, period: '2026-08', status: 'draft', total: 100, vat_amount: 21, finalized_at: null, sent_at: null },
      ] })
      const { unmount } = renderScreen()
      expect(await screen.findByText(i18n.t('adminInvoices.title', { ns: 'settings' }))).toBeInTheDocument()
      expect(screen.getByText(i18n.t('adminInvoices.colTenant', { ns: 'settings' }))).toBeInTheDocument()
      expect(screen.getByText(i18n.t('adminInvoices.colNumber', { ns: 'settings' }))).toBeInTheDocument()
      expect(screen.getByText(i18n.t('adminInvoices.colTotal', { ns: 'settings' }))).toBeInTheDocument()
      expect(screen.getByText(i18n.t('adminInvoices.colStatus', { ns: 'settings' }))).toBeInTheDocument()
      expect(screen.getByText(i18n.t('adminInvoices.status.draft', { ns: 'settings' }))).toBeInTheDocument()
      expect(screen.getByRole('button', { name: i18n.t('adminInvoices.generate', { ns: 'settings' }) })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: i18n.t('adminInvoices.exportXlsx', { ns: 'settings' }) })).toBeInTheDocument()
      expect(screen.queryByText(/adminInvoices\./)).not.toBeInTheDocument()
      unmount()
    }
  })

  it('exports xlsx via GET /admin/invoices/export with the selected month', async () => {
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
    api.get.mockResolvedValueOnce({ data: [
      { id: 'inv-f', tenant_id: 't1', tenant_name: 'Yesway', number: 'KM-000002', period: '2026-08', status: 'final', total: 100, vat_amount: 21, finalized_at: '2026-08-02', sent_at: '2026-08-02' },
    ] })
    api.get.mockResolvedValueOnce({ data: new Blob(['xlsx'], { type: 'application/vnd.openxmlformats' }) })
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    renderScreen()
    const btn = await screen.findByRole('button', { name: i18n.t('adminInvoices.exportXlsx', { ns: 'settings' }) })
    await userEvent.click(btn)
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/admin/invoices/export', { params: { month: expect.any(String) }, responseType: 'blob' }))

    clickSpy.mockRestore()
    vi.unstubAllGlobals()
  })
})
