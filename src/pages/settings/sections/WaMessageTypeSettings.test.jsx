/**
 * WaMessageTypeSettings — the /whatsapp-message-types editor is the ONE StatusListEditor
 * caller that must show `showRank`: its sort_order drives WhatsAppSendModule's queue
 * priority split (koiosmatch-api app/Workflow/Modules/WhatsAppSendModule.php:260-276),
 * so the rank number is real "1 = sent first" semantics, not decoration. This regression-
 * guards the 2026-07-10 extraction (ee207f18) that recreated the editor without it.
 * Also: §13 regression guard for the withValueSlug opt-in (AF:lookups-1):
 * WhatsappMessageTypeController extends SlugLookupController, whose store() REQUIRES `value`.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import { WaMessageTypeSettings } from './WaMessageTypeSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

// eslint-disable-next-line no-restricted-syntax -- DATA: a fixture type's tenant-picked colour, not a style rule.
const type = (over = {}) => ({ id: 'm1', name: 'Sollicitatie', color: '#3B8FD4', ...over })

afterEach(() => { vi.clearAllMocks() })

describe('WaMessageTypeSettings — priority rank input', () => {
  it('renders the typed-rank input per row so the send-priority order is explicit', async () => {
    api.get.mockResolvedValue({
      data: [type({ id: 'm1', name: 'Sollicitatie' }), type({ id: 'm2', name: 'Match' })],
    })
    render(<WaMessageTypeSettings />)

    await screen.findByText('Match')
    // showRank renders a number input titled/labelled with the priority-rank copy.
    const rankInputs = screen.getAllByTitle(st('statusList.priorityRank', { defaultValue: 'Prioriteit (1 = eerst verstuurd)' }))
    expect(rankInputs).toHaveLength(2)
    expect(rankInputs[0]).toHaveValue(1)
    expect(rankInputs[1]).toHaveValue(2)
  })
})

// X-27: priority flag + daily cap ride the create request exactly as the backend
// validates them (WhatsappMessageTypeController: is_priority boolean, daily_cap 1..10000).
describe('WaMessageTypeSettings — priority flag and daily cap', () => {
  it('POSTs is_priority and daily_cap picked in the create modal', async () => {
    api.get.mockResolvedValue({ data: [type()] })
    api.post.mockResolvedValue({ data: type({ id: 'm9', name: 'Herinnering', is_priority: true, daily_cap: 50 }) })
    const user = userEvent.setup()
    render(<WaMessageTypeSettings />)

    await screen.findByText('Sollicitatie')
    await user.click(screen.getByRole('button', { name: st('waMessageTypes.add') }))
    await user.type(screen.getByPlaceholderText(st('statusList.namePlaceholder')), 'Herinnering')
    await user.click(screen.getByRole('switch', { name: st('waMessageTypes.isPriority') }))
    await user.type(screen.getByRole('spinbutton', { name: st('waMessageTypes.dailyCap') }), '50')
    await user.click(screen.getByRole('button', { name: st('statusList.addBtn') }))

    await waitFor(() => expect(api.post).toHaveBeenCalled())
    const [route, body] = api.post.mock.calls[0]
    expect(route).toBe('/whatsapp-message-types')
    expect(body).toEqual(expect.objectContaining({ name: 'Herinnering', is_priority: true }))
    expect(Number(body.daily_cap)).toBe(50)
  })

  it('create POST to /whatsapp-message-types carries the slugged value (withValueSlug)', async () => {
    api.get.mockResolvedValue({ data: [] })
    api.post.mockResolvedValue({ data: type({ id: 'm9', name: 'Bulk SMS' }) })
    const user = userEvent.setup()
    render(<WaMessageTypeSettings />)

    await user.click(await screen.findByRole('button', { name: st('waMessageTypes.add') }))
    await user.type(screen.getByPlaceholderText(st('statusList.namePlaceholder')), 'Bulk SMS')
    await user.click(screen.getByRole('button', { name: st('statusList.addBtn') }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/whatsapp-message-types',
      expect.objectContaining({ name: 'Bulk SMS', value: 'bulk_sms' })))
  })

  // LOOKUP-ICONS-FE-2 fix (13-09): whatsapp_message_types has no icon column/
  // validation — the mark stays colour-only.
  it('the value mark stays colour-only', async () => {
    api.get.mockResolvedValue({ data: [type()] })
    api.put.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<WaMessageTypeSettings />)

    await screen.findByText('Sollicitatie')
    const trigger = screen.getByRole('button', { name: st('statusList.colorMark', { label: 'Sollicitatie' }) })
    await user.click(trigger)
    expect(screen.getByRole('dialog', { name: st('statusList.colorMark', { label: 'Sollicitatie' }) })).toBeInTheDocument()
  })
})

