/**
 * AddContactPersonModal — covers the house "wide form" adoption (Danny 27-07):
 * the card regroup (Persoon/Contact/Koppeling) still submits the exact same
 * ContactPayload shape via `onCreate`, the location picker (bare <select> before,
 * now a searchable CreatableSelect, allowCreate={false}) actually filters by
 * typing, and the first/last-name validation still blocks an incomplete submit.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import AddContactPersonModal from './AddContactPersonModal'

// Both hooks fired by useContactFunctions (contact-functions + tenant settings)
// hit the module-scope cached-lookup path — a harmless empty response keeps
// each hook on its own seed fallback, same as before this change.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn().mockResolvedValue({ data: { data: [] } }), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }
})

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const ct = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'customers', ...opts })

const locations = [{ id: 'loc-1', name: 'Locatie Noord' }, { id: 'loc-2', name: 'Locatie Zuid' }]
const statuses = [{ value: 'st-1', label: 'Actief' }]

describe('AddContactPersonModal', () => {
  it('blocks submit while first/last name are empty and shows the required message', async () => {
    const onCreate = vi.fn()
    const user = userEvent.setup()
    render(<AddContactPersonModal onClose={() => {}} onCreate={onCreate} locations={locations} statuses={statuses} />)

    const createBtn = screen.getByRole('button', { name: ct('subModal.create') })
    expect(createBtn).toBeDisabled()

    // Typing only the first name still leaves the button disabled (last name missing).
    await user.type(screen.getByLabelText(ct('subModal.firstName'), { exact: false }), 'Jan')
    expect(createBtn).toBeDisabled()
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('the location picker is searchable — typing narrows the option list, then picking updates the trigger', async () => {
    const onCreate = vi.fn()
    const user = userEvent.setup()
    render(<AddContactPersonModal onClose={() => {}} onCreate={onCreate} locations={locations} statuses={statuses} />)

    // Trigger's name is now the field label (aria-labelledby self-reference drops
    // its own visible text) — location and department each get their OWN distinct
    // label now, so no more index-into-getAllByRole needed to tell them apart.
    await user.click(screen.getByRole('button', { name: ct('subModal.selectLocation') }))

    const search = screen.getByPlaceholderText(ct('subModal.noneOption'))
    await user.type(search, 'Noord')

    expect(screen.getByRole('button', { name: 'Locatie Noord' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Locatie Zuid' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Locatie Noord' }))
    // Trigger's name stays the field label; assert the pick via its rendered text.
    expect(screen.getByRole('button', { name: ct('subModal.selectLocation') })).toHaveTextContent('Locatie Noord')
  })

  it('submits the same ContactPayload shape via onCreate once required fields are filled', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<AddContactPersonModal onClose={() => {}} onCreate={onCreate} locations={locations} statuses={statuses} />)

    await user.type(screen.getByLabelText(ct('subModal.firstName'), { exact: false }), 'Jan')
    await user.type(screen.getByLabelText(ct('subModal.lastName'), { exact: false }), 'Jansen')

    // Pick the location to prove the field still lands in the payload after
    // becoming a CreatableSelect. Trigger's name is the field label now.
    await user.click(screen.getByRole('button', { name: ct('subModal.selectLocation') }))
    await user.click(screen.getByRole('button', { name: 'Locatie Noord' }))

    await user.click(screen.getByRole('button', { name: ct('subModal.create') }))

    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({
      firstName: 'Jan', lastName: 'Jansen', locationId: 'loc-1',
    }))
  })
})
