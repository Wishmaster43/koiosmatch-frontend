/**
 * InvoiceCompanySettings (INVOICE-1, super-admin) — request-seam tests: the save
 * button PUTs the real body to /admin/invoice-settings, and a failed save reverts
 * the form to the last server-confirmed snapshot (house optimistic pattern, §13).
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'
import apiClient from '@/lib/api'
// Cast to the mocked shape (vi.mock below replaces the real client with jest-style mocks).
const api = apiClient as unknown as { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> }
import InvoiceCompanySettings from './InvoiceCompanySettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

function renderScreen() {
  return render(<I18nextProvider i18n={i18n}><InvoiceCompanySettings /></I18nextProvider>)
}

beforeEach(() => { i18n.changeLanguage('nl') })
afterEach(() => { vi.clearAllMocks() })

describe('InvoiceCompanySettings', () => {
  it('loads GET /admin/invoice-settings and shows the not-ready notice when the company block is empty', async () => {
    api.get.mockResolvedValueOnce({ data: {} })
    renderScreen()
    expect(await screen.findByText(i18n.t('invoiceSettings.notReadyTitle', { ns: 'settings' }))).toBeInTheDocument()
  })

  it('PUTs the full form to /admin/invoice-settings on save', async () => {
    api.get.mockResolvedValueOnce({ data: {
      invoice_company_name: 'Yesway Flex B.V.', invoice_address: 'Straat 1', invoice_postal_city: '1234 AB Stad',
      invoice_coc_number: '12345678', invoice_vat_number: 'NL123456789B01', invoice_iban: 'NL00BANK0123456789',
      invoice_email: 'facturen@yesway.nl', invoice_vat_percent: 21, invoice_number_prefix: 'KM-', invoice_auto_finalize: false,
    } })
    api.put.mockResolvedValueOnce({ data: {} })
    renderScreen()
    const saveBtn = await screen.findByRole('button', { name: i18n.t('common.save', { ns: 'settings' }) })
    await userEvent.click(saveBtn)
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/admin/invoice-settings', expect.objectContaining({ invoice_company_name: 'Yesway Flex B.V.' })))
  })

  it('reverts the form to the last saved snapshot when the PUT fails', async () => {
    api.get.mockResolvedValueOnce({ data: {
      invoice_company_name: 'Yesway Flex B.V.', invoice_address: '', invoice_postal_city: '',
      invoice_coc_number: '', invoice_vat_number: '', invoice_iban: '', invoice_email: '',
      invoice_vat_percent: 21, invoice_number_prefix: 'KM-', invoice_auto_finalize: false,
    } })
    api.put.mockRejectedValueOnce({ response: { status: 422, data: { message: 'invalid' } } })
    renderScreen()
    const nameInput = await screen.findByDisplayValue('Yesway Flex B.V.')
    await userEvent.clear(nameInput)
    await userEvent.type(nameInput, 'Broken Name')
    const saveBtn = screen.getByRole('button', { name: i18n.t('common.save', { ns: 'settings' }) })
    await userEvent.click(saveBtn)
    await waitFor(() => expect(screen.getByDisplayValue('Yesway Flex B.V.')).toBeInTheDocument())
  })
})
