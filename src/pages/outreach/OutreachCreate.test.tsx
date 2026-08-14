/**
 * OutreachCreate · modal conversion (Danny 27-07: "+ Bellijst is geen
 * popup???" / same wide-form frame as +Match / +Kandidaat). Covers: the
 * accessible dialog on the shared WIDE_MODAL frame, the channel/pool pickers
 * being searchable CreatableSelects (not a bare <select>), Escape/Annuleren
 * closing without creating, empty-name validation, and the create payload
 * (incl. pool-seeding) being byte-for-byte the same as the pre-modal version.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OutreachCreate from './OutreachCreate'

// Talent pools for the optional source picker (shared /pools resource).
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: [{ id: 'p1', name: 'Zorgpool Noord' }] })) },
}))
const { createCampaign } = vi.hoisted(() => ({
  createCampaign: vi.fn<(body: Record<string, unknown>) => Promise<{ id: string; name: string }>>(
    async () => ({ id: 'c-new', name: 'New' }),
  ),
}))
vi.mock('./data/outreachApi', () => ({ createCampaign }))

beforeEach(() => { createCampaign.mockClear() })

describe('OutreachCreate · shared wide-form frame', () => {
  it('renders as an accessible dialog on the WIDE_MODAL footprint (same as +Match/+Kandidaat)', async () => {
    render(<OutreachCreate onClose={vi.fn()} onCreated={vi.fn()} />)
    // Let the /pools fetch settle inside act() before asserting (avoids an
    // unwrapped state-update warning from the unrelated pool load).
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveStyle({ maxWidth: '1320px', maxHeight: '94vh' })
    expect(dialog).toHaveAttribute('aria-label', 'create.title')
  })

  it('groups fields into the Algemeen/Bron titled cards, never a bare <select>', async () => {
    render(<OutreachCreate onClose={vi.fn()} onCreated={vi.fn()} />)
    await screen.findByRole('dialog') // let the /pools fetch settle first
    expect(screen.getByText('create.generalCard')).toBeInTheDocument()
    expect(screen.getByText('create.sourceCard')).toBeInTheDocument()
    expect(document.querySelector('select')).toBeNull()
  })

  it('channel is a searchable CreatableSelect listing the fixed enum values', async () => {
    const user = userEvent.setup()
    render(<OutreachCreate onClose={vi.fn()} onCreated={vi.fn()} />)
    // Trigger shows the default channel ("call"); opening it reveals the other two.
    await user.click(screen.getByRole('button', { name: 'channel.call' }))
    expect(await screen.findByRole('button', { name: 'channel.email' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'channel.whatsapp' })).toBeInTheDocument()
  })
})

describe('OutreachCreate · close without creating', () => {
  it('Escape closes the modal and never calls createCampaign', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<OutreachCreate onClose={onClose} onCreated={vi.fn()} />)
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
    expect(createCampaign).not.toHaveBeenCalled()
  })

  it('Annuleren closes the modal and never calls createCampaign', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<OutreachCreate onClose={onClose} onCreated={vi.fn()} />)
    // t('common:cancel', { defaultValue: 'Cancel' }) resolves to its default
    // when i18next has no loaded instance (no init in the test environment).
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalled()
    expect(createCampaign).not.toHaveBeenCalled()
  })
})

describe('OutreachCreate · validation + submit payload (unchanged behaviour)', () => {
  it('blocks submit while the name is empty', async () => {
    render(<OutreachCreate onClose={vi.fn()} onCreated={vi.fn()} />)
    await screen.findByRole('dialog') // let the /pools fetch settle first
    expect(screen.getByRole('button', { name: 'create.submit' })).toBeDisabled()
    expect(createCampaign).not.toHaveBeenCalled()
  })

  it('POSTs the same body as before: trimmed name + channel, no from_pool_id when unset', async () => {
    const onCreated = vi.fn()
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<OutreachCreate onClose={onClose} onCreated={onCreated} />)
    await user.type(screen.getByPlaceholderText('create.namePlaceholder'), '  Bellijst Noord  ')
    await user.click(screen.getByRole('button', { name: 'create.submit' }))
    await waitFor(() => expect(createCampaign).toHaveBeenCalledWith({ name: 'Bellijst Noord', channel: 'call' }))
    expect(onCreated).toHaveBeenCalledWith({ id: 'c-new', name: 'New' })
    expect(onClose).toHaveBeenCalled()
  })

  it('includes from_pool_id when a source pool is picked (pool-seeding unchanged)', async () => {
    const user = userEvent.setup()
    render(<OutreachCreate onClose={vi.fn()} onCreated={vi.fn()} />)
    await user.type(screen.getByPlaceholderText('create.namePlaceholder'), 'Bellijst Zuid')
    // The pool list loads async from /pools — open the picker once it has arrived.
    await user.click(screen.getByRole('button', { name: 'create.poolNone' }))
    await user.click(await screen.findByRole('button', { name: 'Zorgpool Noord' }))
    await user.click(screen.getByRole('button', { name: 'create.submit' }))
    await waitFor(() => expect(createCampaign).toHaveBeenCalledWith({ name: 'Bellijst Zuid', channel: 'call', from_pool_id: 'p1' }))
  })
})
