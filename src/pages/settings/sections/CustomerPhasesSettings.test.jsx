/**
 * CustomerPhasesSettings (KLANT-FASE-1) — the tenant editor for the customer
 * lifecycle-phase lookup, mounted on the shared StatusListEditor against
 * /customer-phases.
 *
 * These assert the REQUESTS, because that is where this class of bug hides: the
 * endpoint is a SlugLookupController, whose store() validates `value` as REQUIRED,
 * while StatusListEditor only ever sent name/label — "+ fase toevoegen" would have
 * 422'd on every tenant. The `withValueSlug` opt-in is what makes the button real,
 * so the create test checks the exact POST body (slug + label + the is_customer flag).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import { CustomerPhasesSettings } from './CustomerSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

// Fixture rows in the shape /customer-phases really returns (value slug + flags + in_use).
/* eslint-disable no-restricted-syntax -- DATA: the tenant's own seeded phase colours, not a style rule. */
const prospect = (over = {}) => ({ id: 'f1', value: 'prospect', label: 'Prospect', color: '#1B60A9', is_customer: false, is_default: true, in_use: true, ...over })
const klant = (over = {}) => ({ id: 'f2', value: 'klant', label: 'Klant', color: '#16A34A', is_customer: true, is_default: false, in_use: false, ...over })
/* eslint-enable no-restricted-syntax */

afterEach(() => vi.clearAllMocks())

describe('CustomerPhasesSettings', () => {
  it('loads the phases from /customer-phases and shows the is_default toggle', async () => {
    api.get.mockResolvedValue({ data: [prospect(), klant()] })
    render(<CustomerPhasesSettings />)

    await screen.findByText('Prospect')
    expect(api.get).toHaveBeenCalledWith('/customer-phases', undefined)
    expect(screen.getByText('Klant')).toBeInTheDocument()
    // The is_default row renders the active (disabled) "Standaard" pill.
    expect(screen.getByRole('button', { name: st('common.default') })).not.toBeDisabled() // DEFAULT-UNDO 04-08: active pill stays clickable (click = clear)
  })

  it('adding a phase POSTs a valid slug + label + the is_customer flag (the body the API requires)', async () => {
    api.get.mockResolvedValue({ data: [prospect(), klant()] })
    api.post.mockResolvedValue({ data: { id: 'f3', value: 'vaste_klant', label: 'Vaste klant', is_customer: true } })
    const user = userEvent.setup()
    render(<CustomerPhasesSettings />)
    await screen.findByText('Prospect')

    await user.click(screen.getByRole('button', { name: st('customerLookups.phases.add') }))
    await user.type(screen.getByPlaceholderText(st('statusList.namePlaceholder')), 'Vaste klant')
    // Flip the behaviour flag the app binds on (is_customer), then save.
    await user.click(screen.getByRole('switch', { name: st('customerLookups.phases.isCustomer') }))
    await user.click(screen.getByRole('button', { name: st('statusList.addBtn') }))

    await waitFor(() => expect(api.post).toHaveBeenCalled())
    const [url, body] = api.post.mock.calls[0]
    expect(url).toBe('/customer-phases')
    // ^[a-z0-9_]+$ is the backend rule; "Vaste klant" must arrive as a valid slug.
    expect(body.value).toBe('vaste_klant')
    expect(body.label).toBe('Vaste klant')
    expect(body.is_customer).toBe(true)
  })

  it('promoting a phase to default PUTs is_default:true on that row', async () => {
    api.get.mockResolvedValue({ data: [prospect(), klant()] })
    api.put.mockResolvedValue({ data: klant({ is_default: true }) })
    const user = userEvent.setup()
    render(<CustomerPhasesSettings />)
    await screen.findByText('Klant')

    await user.click(screen.getByRole('button', { name: st('common.setDefault') }))

    await waitFor(() => expect(api.put).toHaveBeenCalled())
    const [url, body] = api.put.mock.calls[0]
    expect(url).toBe('/customer-phases/f2')
    expect(body.is_default).toBe(true)
  })

  it('keeps an in-use phase on a 409 delete instead of removing it from the list', async () => {
    api.get.mockResolvedValue({ data: [klant()] })
    api.delete.mockRejectedValue({ response: { status: 409 } })
    const user = userEvent.setup()
    render(<CustomerPhasesSettings />)
    await screen.findByText('Klant')

    // Row layout is [swatch, badge, …, edit, delete] — delete is the last button.
    const rowButtons = screen.getByText('Klant').closest('div').querySelectorAll('button')
    await user.click(rowButtons[rowButtons.length - 1])
    await user.click(await screen.findByRole('button', { name: i18n.t('confirm', { ns: 'common' }) }))

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/customer-phases/f2'))
    expect(screen.getByText('Klant')).toBeInTheDocument()
  })
})
