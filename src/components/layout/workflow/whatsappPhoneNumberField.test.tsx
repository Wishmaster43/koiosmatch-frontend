/**
 * whatsappPhoneNumberField.test — CMBE K-193 fase 0 seam: the whatsapp_send
 * phone_number_id picker filters to Coexistence-only numbers when the sibling
 * `channel` config value is 'waba_coex', and keeps a stored value visible even
 * when the current filter would otherwise drop it from the list.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { WhatsappPhoneNumberField } from './fieldControls'

// Real GET /whatsapp-phone-numbers shape: value/label + the new coexistence flag.
vi.mock('@/lib/api', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  default: { get: vi.fn().mockResolvedValue({ data: [
    { value: '111', label: 'WABA main', coexistence: false },
    { value: '222', label: 'Coexistence line', coexistence: true },
  ] }) },
}))

describe('WhatsappPhoneNumberField · channel-driven Coexistence filter', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists every sender number when channel is not waba_coex', async () => {
    render(<WhatsappPhoneNumberField value={undefined} onChange={vi.fn()} fieldKey="phone_number_id" endpoint="/whatsapp-phone-numbers" config={{ channel: 'waba' }} />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(screen.getAllByRole('button')[0]).toHaveAttribute('aria-expanded', 'true'))
    expect(await screen.findByText('WABA main')).toBeInTheDocument()
    expect(screen.getByText('Coexistence line')).toBeInTheDocument()
  })

  it('keeps only coexistence:true numbers when channel is waba_coex', async () => {
    render(<WhatsappPhoneNumberField value={undefined} onChange={vi.fn()} fieldKey="phone_number_id" endpoint="/whatsapp-phone-numbers" config={{ channel: 'waba_coex' }} />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(screen.getAllByRole('button')[0]).toHaveAttribute('aria-expanded', 'true'))
    expect(await screen.findByText('Coexistence line')).toBeInTheDocument()
    expect(screen.queryByText('WABA main')).not.toBeInTheDocument()
  })

  it('keeps a stored value visible even when the active filter would drop it', async () => {
    render(<WhatsappPhoneNumberField value="111" onChange={vi.fn()} fieldKey="phone_number_id" endpoint="/whatsapp-phone-numbers" config={{ channel: 'waba_coex' }} />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(screen.getAllByRole('button')[0]).toHaveAttribute('aria-expanded', 'true'))
    // '111' is not coexistence, but is the CURRENT value — must stay reachable
    // (trigger shows it as selected AND the dropdown lists it, hence 2 matches).
    await waitFor(() => expect(screen.getAllByText('WABA main').length).toBeGreaterThan(1))
  })

  it('shows the coexistence-only hint only when the channel filter is active', async () => {
    const { rerender } = render(<WhatsappPhoneNumberField value={undefined} onChange={vi.fn()} fieldKey="phone_number_id" endpoint="/whatsapp-phone-numbers" config={{ channel: 'waba' }} />)
    expect(screen.queryByText('fields.coexistenceOnly')).not.toBeInTheDocument()
    rerender(<WhatsappPhoneNumberField value={undefined} onChange={vi.fn()} fieldKey="phone_number_id" endpoint="/whatsapp-phone-numbers" config={{ channel: 'waba_coex' }} />)
    expect(await screen.findByText('fields.coexistenceOnly')).toBeInTheDocument()
  })

  it('writes the picked number id via onChange', async () => {
    const onChange = vi.fn()
    render(<WhatsappPhoneNumberField value={undefined} onChange={onChange} fieldKey="phone_number_id" endpoint="/whatsapp-phone-numbers" config={{ channel: 'waba' }} />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(screen.getAllByRole('button')[0]).toHaveAttribute('aria-expanded', 'true'))
    fireEvent.click(await screen.findByText('WABA main'))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('phone_number_id', '111'))
  })
})
