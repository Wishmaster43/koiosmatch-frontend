/**
 * MatchContractSendModal — HF-CONTRACT-1 confirm face: renders the stored values
 * (DD-MM-YYYY), flags missing ones without blocking, sends with no body and shows
 * the mapped refusal in a banner.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'
import MatchContractSendModal from './MatchContractSendModal'
import type { MatchRow } from '@/types/match'

const mockSend = vi.fn()
let detail: Record<string, unknown> = {}
vi.mock('../hooks/useContractSend', () => ({ useContractSend: () => ({ send: mockSend, sending: false }) }))
vi.mock('../hooks/useMatchContract', () => ({ useMatchContract: () => ({ data: detail, loading: false, error: false }) }))
vi.mock('@/lib/notify', () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }))

const tm = (k: string) => i18n.t(k, { ns: 'matches' })
function renderModal(match: Partial<MatchRow>) {
  const onClose = vi.fn(); const onUpdate = vi.fn()
  render(<I18nextProvider i18n={i18n}><MatchContractSendModal match={{ id: 'm1', ...match } as MatchRow} onClose={onClose} onUpdate={onUpdate} /></I18nextProvider>)
  return { onClose, onUpdate }
}

describe('MatchContractSendModal', () => {
  beforeEach(() => {
    vi.clearAllMocks(); i18n.changeLanguage('nl')
    detail = { contractForm: { value: 'flex', label: 'Flex', color: 'var(--color-primary)' }, contract_type: 'flex', function_title: 'Driver', start_date: '2026-11-01', end_date: null, hours_per_week: 37.5, cost_center: 'CC1', purchase_order_number: 'PO-7' }
  })

  it('renders the stored values with DD-MM-YYYY dates and no form fields', () => {
    renderModal({})
    expect(screen.getByText('Driver')).toBeInTheDocument()
    expect(screen.getByText('01-11-2026')).toBeInTheDocument()
    expect(screen.getByText('PO-7')).toBeInTheDocument()
    expect(screen.getByText('37,5')).toBeInTheDocument()
    // The contract FORM (Contractvorm) is the row HelloFlex resolves its contract type from.
    expect(screen.getByText('Flex')).toBeInTheDocument()
    // Exactly the rows HelloFlex receives (ContractPayloadBuilder): no rate, no scale/step/remarks.
    for (const key of ['contractForm', 'functionTitle', 'startDate', 'endDate', 'hoursPerWeek', 'costCenter', 'purchaseOrderNumber']) {
      expect(screen.getByText(tm(`drawer.contractSend.${key}`))).toBeInTheDocument()
    }
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByText(tm('drawer.contractSend.fillOnOverview'))).toBeNull()
  })

  it('flags missing required values but keeps the send button enabled', () => {
    detail = { ...detail, start_date: null, function_title: null }
    renderModal({})
    expect(screen.getAllByText(tm('drawer.contractSend.missing')).length).toBe(2)
    expect(screen.getByText(tm('drawer.contractSend.fillOnOverview'))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: tm('drawer.contractSend.submit') })).toBeEnabled()
  })

  it('sends with no body, refreshes the row and closes on success', async () => {
    mockSend.mockResolvedValue({ ok: true, data: { contract_status: 'sent' } })
    const { onClose, onUpdate } = renderModal({})
    await userEvent.click(screen.getByRole('button', { name: tm('drawer.contractSend.submit') }))
    await waitFor(() => expect(mockSend).toHaveBeenCalledWith())
    expect(onUpdate).toHaveBeenCalledWith('m1', { contractStatus: 'sent', helloflexContractGuid: null })
    expect(onClose).toHaveBeenCalled()
  })

  it('shows the mapped refusal in an alert banner and stays open', async () => {
    mockSend.mockResolvedValue({ ok: false, message: 'Mapped refusal', fieldErrors: {} })
    const { onClose } = renderModal({})
    await userEvent.click(screen.getByRole('button', { name: tm('drawer.contractSend.submit') }))
    expect(await screen.findByText('Mapped refusal')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Mapped refusal')
    expect(onClose).not.toHaveBeenCalled()
  })
})
