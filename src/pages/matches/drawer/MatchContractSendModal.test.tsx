/**
 * MatchContractSendModal — required fields and end >= start block submit; a valid
 * form POSTs through the hook with the exact body (HF-CONTRACT-SEND-1).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'
import MatchContractSendModal from './MatchContractSendModal'
import type { MatchRow } from '@/types/match'

const mockSend = vi.fn()
vi.mock('../hooks/useContractSend', () => ({ useContractSend: () => ({ send: mockSend, sending: false }) }))
vi.mock('@/lib/useContractTypes', () => ({ useContractTypes: () => ({ types: ['flex'], options: [] }) }))
vi.mock('@/lib/notify', () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }))

const submitName = () => i18n.t('drawer.contractSend.submit', { ns: 'matches' })
function renderModal(match: Partial<MatchRow>) {
  const onClose = vi.fn(); const onUpdate = vi.fn()
  render(<I18nextProvider i18n={i18n}><MatchContractSendModal match={{ id: 'm1', ...match } as MatchRow} onClose={onClose} onUpdate={onUpdate} /></I18nextProvider>)
  return { onClose, onUpdate }
}

describe('MatchContractSendModal', () => {
  beforeEach(() => { vi.clearAllMocks(); i18n.changeLanguage('en') })

  it('shows required errors only after a submit attempt and never posts', async () => {
    renderModal({})
    expect(screen.queryByRole('alert')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: submitName() }))
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0)
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('labels resolve to their controls (a11y)', () => {
    renderModal({})
    expect(screen.getByLabelText(new RegExp(i18n.t('drawer.contractSend.functionTitle', { ns: 'matches' })))).toBeInTheDocument()
    expect(screen.getByLabelText(new RegExp(i18n.t('drawer.contract.contractType', { ns: 'matches' })))).toBeInTheDocument()
  })

  it('blocks submit when the end date is before the start date', async () => {
    renderModal({ contractType: 'flex', functionTitle: 'Driver', startDate: '2026-11-10', endDate: '2026-11-01' })
    await userEvent.click(screen.getByRole('button', { name: submitName() }))
    expect(mockSend).not.toHaveBeenCalled()
    expect(screen.getByText(i18n.t('drawer.contractSend.endBeforeStart', { ns: 'matches' }))).toBeInTheDocument()
  })

  it('POSTs a valid prefilled form with the exact body and refreshes the row', async () => {
    mockSend.mockResolvedValue({ ok: true, data: { contract_status: 'sent' } })
    const { onClose, onUpdate } = renderModal({ contractType: 'flex', functionTitle: 'Driver', startDate: '2026-11-01' })
    await userEvent.click(screen.getByRole('button', { name: submitName() }))
    await waitFor(() => expect(mockSend).toHaveBeenCalledWith({ function_title: 'Driver', start_date: '2026-11-01', contract_type: 'flex' }))
    expect(onUpdate).toHaveBeenCalledWith('m1', { contractStatus: 'sent', helloflexContractGuid: null })
    expect(onClose).toHaveBeenCalled()
  })

  it('sends numbers as numbers and omits untouched optional keys', async () => {
    mockSend.mockResolvedValue({ ok: true, data: { contract_status: 'sent', guid: 'g1' } })
    renderModal({ contractType: 'flex', functionTitle: 'Driver', startDate: '2026-11-01' })
    await userEvent.type(screen.getByLabelText(new RegExp(i18n.t('drawer.contractSend.hourlyRate', { ns: 'matches' }))), '18.50')
    await userEvent.type(screen.getByLabelText(new RegExp(i18n.t('drawer.contractSend.hoursPerWeek', { ns: 'matches' }))), '32')
    await userEvent.type(screen.getByLabelText(new RegExp(i18n.t('drawer.contractSend.remarks', { ns: 'matches' }))), 'Note')
    await userEvent.click(screen.getByRole('button', { name: submitName() }))
    await waitFor(() => expect(mockSend).toHaveBeenCalled())
    const body = mockSend.mock.calls[0][0]
    expect(body).toEqual({ function_title: 'Driver', start_date: '2026-11-01', contract_type: 'flex', hourly_rate: 18.5, hours_per_week: 32, remarks: 'Note' })
  })
})
