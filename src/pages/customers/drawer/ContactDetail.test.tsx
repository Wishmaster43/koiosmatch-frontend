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
  firstName: 'Jan', lastName: 'Jansen', name: 'Jan Jansen',
  role: '', email: '', phone: '', mobile: '', isPrimary: false,
  locationId: null, locationName: '', departmentId: null, departmentName: '',
  locations: [], departments: [], statusId: null, status: '', statusLabel: '', statusColor: '', customFields: {},
  ...overrides,
})

// Scope into the row carrying this field's own label span (mirrors the candidate
// ProfileTab test's within(field).getByRole('button') convention) — avoids any
// ambiguity between the location/department triggers or their placeholder text.
const rowFor = (label: string) => screen.getByText(label).parentElement as HTMLElement

describe('ContactDetail · location/department cascade (BUG FIX 28-07)', () => {
  it('shows a dash for both fields when neither is linked', () => {
    render(<ContactDetail contact={baseContact()} locations={locations} departments={departments} statuses={statuses}
      onSave={vi.fn()} onDelete={vi.fn()} close={vi.fn()} />)
    expect(within(rowFor(ct('contacts.detail.location'))).getByText('-')).toBeInTheDocument()
    expect(within(rowFor(ct('contacts.detail.department'))).getByText('-')).toBeInTheDocument()
  })

  it('resolves the linked location/department NAME against the customer-wide lists in read mode', () => {
    // locationName/departmentName left empty on purpose — the list endpoint leaves
    // them empty for every seeded contact (measured 2026-07-14); the drawer must
    // resolve the real label off locationId/departmentId against the props lists.
    const contact = baseContact({ locationId: 'loc-1', locationName: '', departmentId: 'dep-1', departmentName: '' })
    render(<ContactDetail contact={contact} locations={locations} departments={departments} statuses={statuses}
      onSave={vi.fn()} onDelete={vi.fn()} close={vi.fn()} />)
    expect(within(rowFor(ct('contacts.detail.location'))).getByText('Locatie Noord')).toBeInTheDocument()
    expect(within(rowFor(ct('contacts.detail.department'))).getByText('Verpleging')).toBeInTheDocument()
  })

  it('the department picker offers nothing and asks for a location first, before any location is picked', async () => {
    const user = userEvent.setup()
    render(<ContactDetail contact={baseContact()} locations={locations} departments={departments} statuses={statuses}
      onSave={vi.fn()} onDelete={vi.fn()} close={vi.fn()} />)

    // Index 1: the Link block's own pencil (0 = main field table, 2 = phone numbers).
    await user.click(screen.getAllByTitle(cm('edit'))[1])
    await user.click(within(rowFor(ct('contacts.detail.department'))).getByRole('button'))
    expect(screen.getByPlaceholderText(ct('subModal.pickLocationFirst'))).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Verpleging' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Thuiszorg' })).not.toBeInTheDocument()
  })

  it('picking a location narrows the department list to that location only (C-42/point-9 cascade)', async () => {
    const user = userEvent.setup()
    render(<ContactDetail contact={baseContact()} locations={locations} departments={departments} statuses={statuses}
      onSave={vi.fn()} onDelete={vi.fn()} close={vi.fn()} />)

    await user.click(screen.getAllByTitle(cm('edit'))[1])
    await user.click(within(rowFor(ct('contacts.detail.location'))).getByRole('button'))
    await user.click(screen.getByRole('button', { name: 'Locatie Noord' }))

    await user.click(within(rowFor(ct('contacts.detail.department'))).getByRole('button'))
    expect(screen.getByRole('button', { name: 'Verpleging' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Thuiszorg' })).not.toBeInTheDocument()
  })

  it('changing the location resets a department that no longer belongs to it', async () => {
    const user = userEvent.setup()
    const contact = baseContact({ locationId: 'loc-1', departmentId: 'dep-1' })
    render(<ContactDetail contact={contact} locations={locations} departments={departments} statuses={statuses}
      onSave={vi.fn()} onDelete={vi.fn()} close={vi.fn()} />)

    await user.click(screen.getAllByTitle(cm('edit'))[1])
    expect(within(rowFor(ct('contacts.detail.department'))).getByRole('button')).toHaveTextContent('Verpleging')

    // Switching to Zuid must clear the now-invalid "Verpleging" pick — never
    // silently keep a department that belongs to a different location.
    await user.click(within(rowFor(ct('contacts.detail.location'))).getByRole('button'))
    await user.click(screen.getByRole('button', { name: 'Locatie Zuid' }))

    expect(within(rowFor(ct('contacts.detail.department'))).getByRole('button')).not.toHaveTextContent('Verpleging')
    expect(within(rowFor(ct('contacts.detail.department'))).getByRole('button')).toHaveTextContent(ct('subModal.noneOption'))
  })

  it('saves the exact matching locationId/departmentId pair — asserts the REQUEST, not just that a callback fired', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<ContactDetail contact={baseContact()} locations={locations} departments={departments} statuses={statuses}
      onSave={onSave} onDelete={vi.fn()} close={vi.fn()} />)

    await user.click(screen.getAllByTitle(cm('edit'))[1])
    await user.click(within(rowFor(ct('contacts.detail.location'))).getByRole('button'))
    await user.click(screen.getByRole('button', { name: 'Locatie Noord' }))
    await user.click(within(rowFor(ct('contacts.detail.department'))).getByRole('button'))
    await user.click(screen.getByRole('button', { name: 'Verpleging' }))

    await user.click(screen.getByTitle(cm('save')))

    expect(onSave).toHaveBeenCalledWith('c1', { locationId: 'loc-1', departmentId: 'dep-1' })
  })

  it('cancel discards the draft pick without calling onSave, and re-opening re-seeds from the ORIGINAL pair', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const contact = baseContact({ locationId: 'loc-1', departmentId: 'dep-1' })
    render(<ContactDetail contact={contact} locations={locations} departments={departments} statuses={statuses}
      onSave={onSave} onDelete={vi.fn()} close={vi.fn()} />)

    await user.click(screen.getAllByTitle(cm('edit'))[1])
    await user.click(within(rowFor(ct('contacts.detail.location'))).getByRole('button'))
    await user.click(screen.getByRole('button', { name: 'Locatie Zuid' }))
    await user.click(screen.getByTitle(cm('cancel')))

    expect(onSave).not.toHaveBeenCalled()
    await user.click(screen.getAllByTitle(cm('edit'))[1])
    expect(within(rowFor(ct('contacts.detail.location'))).getByRole('button')).toHaveTextContent('Locatie Noord')
  })

  it('still resolves a legacy mismatched department (set before this fix existed) instead of dropping it silently', async () => {
    const user = userEvent.setup()
    // dep-1 belongs to loc-1, but this contact's location is loc-2 — a pre-existing
    // mismatched pair from before the cascade existed (CONTACT-MULTI-1 era data).
    const contact = baseContact({ locationId: 'loc-2', departmentId: 'dep-1' })
    render(<ContactDetail contact={contact} locations={locations} departments={departments} statuses={statuses}
      onSave={vi.fn()} onDelete={vi.fn()} close={vi.fn()} />)

    await user.click(screen.getAllByTitle(cm('edit'))[1])
    expect(within(rowFor(ct('contacts.detail.department'))).getByRole('button')).toHaveTextContent('Verpleging')
  })
})
