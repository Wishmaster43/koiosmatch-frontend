/**
 * AdminInvoicesSettings (INVOICE-1, super-admin) — request-seam tests for the
 * generate/finalize/resend/export/download actions: each asserts the real route
 * and body, never only that a callback fired (§13). Finalize semantics: a
 * final-but-undelivered invoice shows "Opnieuw versturen" and calls the SAME
 * finalize endpoint (the re-send path), a draft shows "Finaliseren".
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
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
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/invoices/inv-d/finalize', undefined, expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) })))
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
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/invoices/inv-f/finalize', undefined, expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) })))
  })

  // CLAIM-1: the finalize call's `mailed`/`reason` fields drive an extra info
  // toast on top of today's finalize-success toast — captured via the real
  // `km:toast` event (no notify mock in this file) so the request AND the
  // surfaced reason are both proven, never only that finalize resolved.
  describe('CLAIM-1 mail-claim reasons on finalize', () => {
    function captureToasts() {
      const events: Array<{ type: string; message: string }> = []
      const handler = (e: Event) => events.push((e as CustomEvent).detail)
      window.addEventListener('km:toast', handler)
      return { events, stop: () => window.removeEventListener('km:toast', handler) }
    }

    it('shows only the success toast when mailed: true', async () => {
      api.get.mockResolvedValueOnce({ data: [
        { id: 'inv-d', tenant_id: 't1', tenant_name: 'Yesway', number: null, period: '2026-08', status: 'draft', total: 100, vat_amount: 21, finalized_at: null, sent_at: null },
      ] })
      api.post.mockResolvedValueOnce({ data: { mailed: true, reason: null } })
      api.get.mockResolvedValueOnce({ data: [] })
      const { events, stop } = captureToasts()
      renderScreen()
      const btn = await screen.findByRole('button', { name: i18n.t('adminInvoices.finalize', { ns: 'settings' }) })
      await userEvent.click(btn)
      await waitFor(() => expect(events.length).toBeGreaterThan(0))
      expect(events).toEqual([{ type: 'success', message: i18n.t('adminInvoices.finalizeSuccess', { ns: 'settings' }) }])
      stop()
    })

    it('adds the "in_flight" info toast on top of the success toast when mailed: false', async () => {
      api.get.mockResolvedValueOnce({ data: [
        { id: 'inv-d', tenant_id: 't1', tenant_name: 'Yesway', number: null, period: '2026-08', status: 'draft', total: 100, vat_amount: 21, finalized_at: null, sent_at: null },
      ] })
      api.post.mockResolvedValueOnce({ data: { mailed: false, reason: 'in_flight' } })
      api.get.mockResolvedValueOnce({ data: [] })
      const { events, stop } = captureToasts()
      renderScreen()
      const btn = await screen.findByRole('button', { name: i18n.t('adminInvoices.finalize', { ns: 'settings' }) })
      await userEvent.click(btn)
      await waitFor(() => expect(events.length).toBe(2))
      expect(events[0]).toEqual({ type: 'success', message: i18n.t('adminInvoices.finalizeSuccess', { ns: 'settings' }) })
      expect(events[1]).toEqual({ type: 'info', message: i18n.t('adminInvoices.mailInFlight', { ns: 'settings' }) })
      stop()
    })

    it('adds the "unconfirmed" info toast when mailed: false, reason: unconfirmed', async () => {
      api.get.mockResolvedValueOnce({ data: [
        { id: 'inv-d', tenant_id: 't1', tenant_name: 'Yesway', number: null, period: '2026-08', status: 'draft', total: 100, vat_amount: 21, finalized_at: null, sent_at: null },
      ] })
      api.post.mockResolvedValueOnce({ data: { mailed: false, reason: 'unconfirmed' } })
      api.get.mockResolvedValueOnce({ data: [] })
      const { events, stop } = captureToasts()
      renderScreen()
      const btn = await screen.findByRole('button', { name: i18n.t('adminInvoices.finalize', { ns: 'settings' }) })
      await userEvent.click(btn)
      await waitFor(() => expect(events.length).toBe(2))
      expect(events[1]).toEqual({ type: 'info', message: i18n.t('adminInvoices.mailUnconfirmed', { ns: 'settings' }) })
      stop()
    })

    it('adds the "already_final" info toast when mailed: false, reason: already_final', async () => {
      api.get.mockResolvedValueOnce({ data: [
        { id: 'inv-d', tenant_id: 't1', tenant_name: 'Yesway', number: null, period: '2026-08', status: 'draft', total: 100, vat_amount: 21, finalized_at: null, sent_at: null },
      ] })
      api.post.mockResolvedValueOnce({ data: { mailed: false, reason: 'already_final' } })
      api.get.mockResolvedValueOnce({ data: [] })
      const { events, stop } = captureToasts()
      renderScreen()
      const btn = await screen.findByRole('button', { name: i18n.t('adminInvoices.finalize', { ns: 'settings' }) })
      await userEvent.click(btn)
      await waitFor(() => expect(events.length).toBe(2))
      expect(events[1]).toEqual({ type: 'info', message: i18n.t('adminInvoices.alreadyFinal', { ns: 'settings' }) })
      stop()
    })

    // Resend path (status: final) with mailed: false must not also claim success —
    // the invoice was already final, so the only honest toast is the reason one.
    it('shows only the reason toast (no resendSuccess) when resending a final invoice and mailed: false', async () => {
      api.get.mockResolvedValueOnce({ data: [
        { id: 'inv-f', tenant_id: 't1', tenant_name: 'Yesway', number: 'KM-000002', period: '2026-08', status: 'final', total: 100, vat_amount: 21, finalized_at: '2026-08-02', sent_at: null },
      ] })
      api.post.mockResolvedValueOnce({ data: { mailed: false, reason: 'in_flight' } })
      api.get.mockResolvedValueOnce({ data: [] })
      const { events, stop } = captureToasts()
      renderScreen()
      const btn = await screen.findByRole('button', { name: i18n.t('adminInvoices.resend', { ns: 'settings' }) })
      await userEvent.click(btn)
      await waitFor(() => expect(events.length).toBe(1))
      expect(events).toEqual([{ type: 'info', message: i18n.t('adminInvoices.mailInFlight', { ns: 'settings' }) }])
      stop()
    })

    it('adds the generic unknown-reason info toast, with the raw reason as the toast title', async () => {
      api.get.mockResolvedValueOnce({ data: [
        { id: 'inv-d', tenant_id: 't1', tenant_name: 'Yesway', number: null, period: '2026-08', status: 'draft', total: 100, vat_amount: 21, finalized_at: null, sent_at: null },
      ] })
      api.post.mockResolvedValueOnce({ data: { mailed: false, reason: 'smtp_timeout' } })
      api.get.mockResolvedValueOnce({ data: [] })
      const events: Array<{ type: string; message: string; title?: string }> = []
      const handler = (e: Event) => events.push((e as CustomEvent).detail)
      window.addEventListener('km:toast', handler)
      renderScreen()
      const btn = await screen.findByRole('button', { name: i18n.t('adminInvoices.finalize', { ns: 'settings' }) })
      await userEvent.click(btn)
      await waitFor(() => expect(events.length).toBe(2))
      expect(events[1]).toEqual({ type: 'info', message: i18n.t('adminInvoices.mailFailedUnknownReason', { ns: 'settings' }), title: 'smtp_timeout' })
      window.removeEventListener('km:toast', handler)
    })
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

// CLAIM-RESOLVE-1 (Danny 04-10 answer 2): a stuck mail claim (sending_at set, sent_at null) offers
// "Markeer als niet verzonden" — appended to the suite on HEAD's own fixtures and mocks, never a rewrite.
describe('AdminInvoicesSettings · resolve a stuck mail claim (CLAIM-RESOLVE-1)', () => {
  const resolveLabel = () => i18n.t('adminInvoices.resolveNotSent', { ns: 'settings' })
  const stuck = { id: 'inv-stuck', tenant_id: 't1', tenant_name: 'Tenant Stuck', number: 'INV-9', total: '100.00', status: 'final', sent_at: null, sending_at: '2026-10-04T08:00:00Z' }
  const mailed = { id: 'inv-mailed', tenant_id: 't2', tenant_name: 'Tenant Mailed', number: 'INV-8', total: '200.00', status: 'final', sent_at: '2026-10-03T08:00:00Z', sending_at: '2026-10-03T08:00:00Z' }
  const draft = { id: 'inv-draft', tenant_id: 't3', tenant_name: 'Tenant Draft', number: null, total: '50.00', status: 'draft', sent_at: null, sending_at: null }

  it('shows the resolve button only for a row with sending_at set and sent_at null', async () => {
    api.get.mockResolvedValue({ data: [stuck, mailed, draft] })
    renderScreen()
    await waitFor(() => expect(screen.getByText('Tenant Stuck')).toBeInTheDocument())
    const row = (name: string) => screen.getAllByRole('row').find(r => within(r).queryByText(name))!
    expect(within(row('Tenant Stuck')).getByRole('button', { name: resolveLabel() })).toBeInTheDocument()
    expect(within(row('Tenant Mailed')).queryByRole('button', { name: resolveLabel() })).toBeNull()
    expect(within(row('Tenant Draft')).queryByRole('button', { name: resolveLabel() })).toBeNull()
  })

  it('POSTs resolve-sending with exactly { reason } and an Idempotency-Key, then reloads and notifies', async () => {
    api.get.mockResolvedValueOnce({ data: [stuck] })
    api.post.mockResolvedValueOnce({ data: { sending_at: null, resolved: true } })
    api.get.mockResolvedValueOnce({ data: [{ ...stuck, sending_at: null }] })
    // Toasts are observed through the real km:toast event, like the CLAIM-1 cases above (no notify mock in this file).
    const events: Array<{ type: string; message: string }> = []
    const onToast = (e: Event) => events.push((e as CustomEvent).detail)
    window.addEventListener('km:toast', onToast)
    const user = userEvent.setup()
    renderScreen()
    await waitFor(() => expect(screen.getByText('Tenant Stuck')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: resolveLabel() }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText(i18n.t('resolveClaim.reason', { ns: 'common' }), { exact: false }), 'Mail support confirmed nothing sent')
    await user.click(within(dialog).getByRole('button', { name: resolveLabel() }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(
      '/admin/invoices/inv-stuck/resolve-sending',
      { reason: 'Mail support confirmed nothing sent' },
      expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) }),
    ))
    await waitFor(() => expect(events).toContainEqual({ type: 'success', message: i18n.t('adminInvoices.resolved', { ns: 'settings' }) }))
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2))
    window.removeEventListener('km:toast', onToast)
  })
})
