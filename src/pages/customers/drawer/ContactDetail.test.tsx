/**
 * ContactDetail — BUG FIX 28-07: the location/department coupling used to render
 * as two INDEPENDENT chip-select fields (no cascade), so a recruiter editing a
 * contact from the drawer could save a department belonging to a DIFFERENT
 * location than the one picked — a department belongs to exactly one location,
 * so an uncoupled pair is invalid data. AddContactPersonModal already got this
 * cascade fixed; this covers the same fix landing in the drawer's own edit path:
 * the department picker narrows to the picked location, changing the location
 * resets an invalid department, and the saved payload always carries a matching
 * pair (assert the REQUEST — CLAUDE.md §13, not just that onSave fired).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import ContactDetail from './ContactDetail'
import type { Contact, Department } from '@/types/customer'

// useContactFunctions + useCustomFields both hit @/lib/api under the hood (the
// contact-function lookup + tenant settings, and the custom-field defs) — a
// harmless empty response keeps each on its own seed fallback, same mock as
// AddContactPersonModal.test.tsx for the same hooks.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn().mockResolvedValue({ data: { data: [] } }), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }
})

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const ct = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'customers', ...opts })
const cm = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'common', ...opts })

const locations = [{ id: 'loc-1', name: 'Locatie Noord' }, { id: 'loc-2', name: 'Locatie Zuid' }]
const statuses = [{ value: 'st-1', label: 'Actief' }]

// Minimal-but-type-complete Department fixture (mirrors AddContactPersonModal.test.tsx) —
// only id/name/locationId vary per test, everything else is a harmless default.
const dept = (id: string, name: string, locationId: string): Department => ({
  id, helloflexLink: null, shiftmanagerLink: null, name, description: '', locationId, locationName: '',
  contacts: [], costCenter: '', statusId: null, status: '', statusLabel: '', statusColor: '', customFields: {},
})
const departments = [dept('dep-1', 'Verpleging', 'loc-1'), dept('dep-2', 'Thuiszorg', 'loc-2')]

const baseContact = (overrides: Partial<Contact> = {}): Contact => ({
  id: 'c1', helloflexLink: null, shiftmanagerLink: null,
  firstName: 'Jan', middleName: '', lastName: 'Jansen', name: 'Jan Jansen',
  role: '', email: '', phone: '', mobile: '', isPrimary: false,
  locationId: null, locationName: '', departmentId: null, departmentName: '',
  locations: [], departments: [], statusId: null, status: '', statusLabel: '', statusColor: '', customFields: {},
  // Last-contact pair (customer_contacts.last_contact_at / _type) — null here, as the
  // API sends it today: CustomerContactResource does not expose the columns yet.
  lastContactAt: null, lastContactType: null,
  ...overrides,
})

describe('ContactDetail · location/department coupling (+Vestiging shape, 28-07)', () => {
  // The coupling is no longer a pencil + two dropdowns; it is the same shape as
  // "+ Vestiging": a link trigger per row, the current value as a removable chip, and
  // saving happens on the pick. The RULE it guards is unchanged and is what matters —
  // a department belongs to exactly one location, so an uncoupled pair must be
  // unreachable. These tests assert the PATCH, never merely that a callback fired.
  const openLocationPicker = async (user: ReturnType<typeof userEvent.setup>) =>
    user.click(screen.getByRole('button', { name: ct('contacts.detail.linkLocation') }))
  const openDepartmentPicker = async (user: ReturnType<typeof userEvent.setup>) =>
    user.click(screen.getByRole('button', { name: ct('contacts.detail.linkDepartment') }))

  it('shows an empty state on both rows when nothing is linked', () => {
    render(<ContactDetail contact={baseContact()} locations={locations} departments={departments} statuses={statuses}
      onSave={vi.fn()} onDelete={vi.fn()} close={vi.fn()} />)
    expect(screen.getByText(ct('subModal.pickLocationFirst'))).toBeInTheDocument()
  })

  it('shows the linked location/department as chips, resolved against the customer-wide lists', () => {
    // locationName/departmentName stay empty on purpose — the list endpoint never fills
    // them (measured 2026-07-14); the labels must resolve off the ids.
    const contact = baseContact({ locationId: 'loc-1', locationName: '', departmentId: 'dep-1', departmentName: '' })
    render(<ContactDetail contact={contact} locations={locations} departments={departments} statuses={statuses}
      onSave={vi.fn()} onDelete={vi.fn()} close={vi.fn()} />)
    expect(screen.getByText('Locatie Noord')).toBeInTheDocument()
    expect(screen.getByText('Verpleging')).toBeInTheDocument()
  })

  it('offers no departments at all until a location is linked', async () => {
    const user = userEvent.setup()
    render(<ContactDetail contact={baseContact()} locations={locations} departments={departments} statuses={statuses}
      onSave={vi.fn()} onDelete={vi.fn()} close={vi.fn()} />)
    await openDepartmentPicker(user)
    expect(screen.queryByRole('button', { name: 'Verpleging' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Thuiszorg' })).not.toBeInTheDocument()
  })

  it('narrows the department list to the linked location only', async () => {
    const user = userEvent.setup()
    render(<ContactDetail contact={baseContact({ locationId: 'loc-1' })} locations={locations} departments={departments}
      statuses={statuses} onSave={vi.fn()} onDelete={vi.fn()} close={vi.fn()} />)
    await openDepartmentPicker(user)
    expect(screen.getByRole('button', { name: 'Verpleging' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Thuiszorg' })).not.toBeInTheDocument()
  })

  // CONTACT-MULTI-1 (Danny 28-07): a contact can serve SEVERAL sites and departments. The
  // frontend writes the arrays now; the backend has had the pivots all along.
  it('ADDS a second location instead of replacing the first', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<ContactDetail contact={baseContact({ locationId: 'loc-1', departmentId: 'dep-1' })} locations={locations}
      departments={departments} statuses={statuses} onSave={onSave} onDelete={vi.fn()} close={vi.fn()} />)

    await openLocationPicker(user)
    await user.click(screen.getByRole('button', { name: 'Locatie Zuid' }))
    // Both sites, and Verpleging (at Noord) survives because Noord is still linked.
    expect(onSave).toHaveBeenCalledWith('c1', { locationIds: ['loc-1', 'loc-2'] })
  })

  it('unlinking a location drops the departments that hung off it', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<ContactDetail contact={baseContact({ locationId: 'loc-1', departmentId: 'dep-1' })} locations={locations}
      departments={departments} statuses={statuses} onSave={onSave} onDelete={vi.fn()} close={vi.fn()} />)

    // Toggling the only linked location OFF must take Verpleging with it — a department
    // at a site the contact no longer serves is invalid data, not just untidy.
    await openLocationPicker(user)
    await user.click(screen.getByRole('button', { name: 'Locatie Noord' }))
    expect(onSave).toHaveBeenCalledWith('c1', { locationIds: [], departmentIds: [] })
  })

  it('adds a department without touching the locations', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<ContactDetail contact={baseContact({ locationId: 'loc-1' })} locations={locations} departments={departments}
      statuses={statuses} onSave={onSave} onDelete={vi.fn()} close={vi.fn()} />)
    await openDepartmentPicker(user)
    await user.click(screen.getByRole('button', { name: 'Verpleging' }))
    expect(onSave).toHaveBeenCalledWith('c1', { departmentIds: ['dep-1'] })
  })

  it('removing a location chip unlinks just that one', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<ContactDetail contact={baseContact({ locationId: 'loc-1', departmentId: 'dep-1' })} locations={locations}
      departments={departments} statuses={statuses} onSave={onSave} onDelete={vi.fn()} close={vi.fn()} />)
    // Scope to the location CHIP itself — matching on the shared "remove" label alone
    // also catches the reference-number copy button in the title row.
    const chip = screen.getByText('Locatie Noord').closest('span') as HTMLElement
    await user.click(within(chip).getByRole('button', { name: cm('remove') }))
    expect(onSave).toHaveBeenCalledWith('c1', { locationIds: [], departmentIds: [] })
  })
})


describe('ContactDetail · declining the primary-replace question', () => {
  const other = baseContact({ id: 'c2', firstName: 'Anna', middleName: '', lastName: 'Bakker', name: 'Anna Bakker', isPrimary: true })

  it('saves isPrimary false AND leaves the toggle off on screen', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<ContactDetail contact={baseContact()} locations={locations} departments={departments} statuses={statuses}
      existing={[baseContact(), other]} onSave={onSave} onDelete={vi.fn()} close={vi.fn()} />)

    await user.click(screen.getAllByTitle(cm('edit'))[0])
    await user.click(screen.getByRole('switch', { name: ct('contacts.detail.primary') }))
    await user.click(screen.getByTitle(cm('save')))
    await user.click(screen.getByRole('button', { name: ct('subModal.primaryReplace.decline') }))

    // What we stored…
    expect(onSave).toHaveBeenCalledWith('c1', expect.objectContaining({ isPrimary: false }))
    // …is what the screen shows.
    expect(screen.getByRole('switch', { name: ct('contacts.detail.primary') })).toHaveAttribute('aria-checked', 'false')
  })

  it('saves isPrimary true when the replacement is confirmed', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<ContactDetail contact={baseContact()} locations={locations} departments={departments} statuses={statuses}
      existing={[baseContact(), other]} onSave={onSave} onDelete={vi.fn()} close={vi.fn()} />)

    await user.click(screen.getAllByTitle(cm('edit'))[0])
    await user.click(screen.getByRole('switch', { name: ct('contacts.detail.primary') }))
    await user.click(screen.getByTitle(cm('save')))
    await user.click(screen.getByRole('button', { name: ct('subModal.primaryReplace.confirm') }))

    expect(onSave).toHaveBeenCalledWith('c1', expect.objectContaining({ isPrimary: true }))
  })
})
