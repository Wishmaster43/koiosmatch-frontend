/**
 * AddContactPersonModal — covers the house "wide form" adoption (Danny 27-07):
 * the card regroup (Persoon/Contact/Koppeling) still submits the exact same
 * ContactPayload shape via `onCreate`, the location picker (bare <select> before,
 * now a searchable CreatableSelect, allowCreate={false}) actually filters by
 * typing, and the first/last-name validation still blocks an incomplete submit.
 *
 * Danny 27-07 (customer-list point 9, "contactpersoon volgt klant of afdeling"):
 * the department picker must CASCADE off the picked location, mirroring
 * AddShiftModal's customer->department dependent picker — see the block below
 * covering that narrowing/reset/submit behaviour.
 *
 * Danny 28-07: three more cases. (1) locking the location (adding "at this
 * location") must hide ONLY the location picker, never the department picker
 * alongside it. (2) the "primair contact" toggle asks via the shared confirm
 * dialog before replacing whichever OTHER contact currently holds the flag.
 * (3) a client-side duplicate check on email/phone/mobile (scoped to the
 * customer's OTHER contacts via the new `existing` prop) blocks submit before
 * the server's 422 would.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import AddContactPersonModal from './AddContactPersonModal'
import type { Contact, Department } from '@/types/customer'

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

// Minimal-but-type-complete Department fixture — only the cascade-relevant fields
// (id/name/locationId) vary per test; everything else is a harmless default.
const dept = (id: string, name: string, locationId: string): Department => ({
  id, helloflexLink: null, shiftmanagerLink: null, name, description: '', locationId, locationName: '',
  contacts: [], costCenter: '', statusId: null, status: '', statusLabel: '', statusColor: '', customFields: {},
})
const departments = [dept('dep-1', 'Verpleging', 'loc-1'), dept('dep-2', 'Thuiszorg', 'loc-2')]

// Minimal-but-type-complete Contact fixture for the `existing` prop (the customer's
// OTHER already-loaded contacts) — drives the primary-replace confirm and the
// email/phone/mobile duplicate check.
const contact = (overrides: Partial<Contact>): Contact => ({
  id: 'c-other', helloflexLink: null, shiftmanagerLink: null, firstName: 'Anna', lastName: 'Bakker', name: 'Anna Bakker',
  role: '', email: '', phone: '', mobile: '', isPrimary: false,
  locationId: null, locationName: '', departmentId: null, departmentName: '',
  locations: [], departments: [], statusId: null, status: '', statusLabel: '', statusColor: '', customFields: {},
  lastContactAt: null, lastContactType: null,
  ...overrides,
})

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

  it('the department picker follows the selected location (C-42/point-9 cascade)', async () => {
    const onCreate = vi.fn()
    const user = userEvent.setup()
    render(<AddContactPersonModal onClose={() => {}} onCreate={onCreate} locations={locations} departments={departments} statuses={statuses} />)

    // Before any location is picked: the department field offers NOTHING to pick
    // (never "every department of this customer" — a department belongs to exactly
    // one location) and its search box asks for a location first.
    await user.click(screen.getByRole('button', { name: ct('subModal.selectDepartment') }))
    expect(screen.getByPlaceholderText(ct('subModal.pickLocationFirst'))).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Verpleging' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Thuiszorg' })).not.toBeInTheDocument()
    await user.keyboard('{Escape}')

    // Pick "Locatie Noord" — the department list narrows to ONLY that location's department.
    await user.click(screen.getByRole('button', { name: ct('subModal.selectLocation') }))
    await user.click(screen.getByRole('button', { name: 'Locatie Noord' }))

    await user.click(screen.getByRole('button', { name: ct('subModal.selectDepartment') }))
    expect(screen.getByRole('button', { name: 'Verpleging' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Thuiszorg' })).not.toBeInTheDocument()
  })

  it('changing the location resets a department that no longer belongs to it', async () => {
    const onCreate = vi.fn()
    const user = userEvent.setup()
    render(<AddContactPersonModal onClose={() => {}} onCreate={onCreate} locations={locations} departments={departments} statuses={statuses} />)

    // Pick Noord -> Verpleging.
    await user.click(screen.getByRole('button', { name: ct('subModal.selectLocation') }))
    await user.click(screen.getByRole('button', { name: 'Locatie Noord' }))
    await user.click(screen.getByRole('button', { name: ct('subModal.selectDepartment') }))
    await user.click(screen.getByRole('button', { name: 'Verpleging' }))
    expect(screen.getByRole('button', { name: ct('subModal.selectDepartment') })).toHaveTextContent('Verpleging')

    // Switching to Zuid must clear the now-invalid "Verpleging" pick — never silently
    // submit a department that belongs to a different location.
    await user.click(screen.getByRole('button', { name: ct('subModal.selectLocation') }))
    await user.click(screen.getByRole('button', { name: 'Locatie Zuid' }))
    expect(screen.getByRole('button', { name: ct('subModal.selectDepartment') })).not.toHaveTextContent('Verpleging')
    expect(screen.getByRole('button', { name: ct('subModal.selectDepartment') })).toHaveTextContent(ct('subModal.noneOption'))
  })

  it('submits the payload with the matching customer_location_id/customer_department_id pair', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<AddContactPersonModal onClose={() => {}} onCreate={onCreate} locations={locations} departments={departments} statuses={statuses} />)

    await user.type(screen.getByLabelText(ct('subModal.firstName'), { exact: false }), 'Jan')
    await user.type(screen.getByLabelText(ct('subModal.lastName'), { exact: false }), 'Jansen')

    await user.click(screen.getByRole('button', { name: ct('subModal.selectLocation') }))
    await user.click(screen.getByRole('button', { name: 'Locatie Noord' }))
    await user.click(screen.getByRole('button', { name: ct('subModal.selectDepartment') }))
    await user.click(screen.getByRole('button', { name: 'Verpleging' }))

    await user.click(screen.getByRole('button', { name: ct('subModal.create') }))

    // ContactPayload carries camelCase locationId/departmentId here; useCustomerContacts'
    // own toApi (covered by its own hook test) maps these onto customer_location_id/
    // customer_department_id on the actual POST body.
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({
      locationId: 'loc-1', departmentId: 'dep-1',
    }))
  })

  it('edit mode still resolves a legacy department whose location link is missing (CONTACT-MULTI-1 drawer chip-select has no cascade)', () => {
    // A contact edited via the drawer's independent chip-select could carry a
    // department without a matching location — the picker must still show its
    // real label, never fall back to rendering the raw id.
    const initial = {
      id: 'c1', helloflexLink: null, shiftmanagerLink: null, firstName: 'Jan', lastName: 'Jansen', name: 'Jan Jansen',
      role: '', email: '', phone: '', mobile: '', isPrimary: false,
      locationId: null, locationName: '', departmentId: 'dep-1', departmentName: 'Verpleging',
      locations: [], departments: [], statusId: null, status: '', statusLabel: '', statusColor: '', customFields: {},
      lastContactAt: null, lastContactType: null,
    } as Contact

    render(<AddContactPersonModal onClose={() => {}} onCreate={vi.fn()} locations={locations} departments={departments} statuses={statuses} initial={initial} />)

    expect(screen.getByRole('button', { name: ct('subModal.selectDepartment') })).toHaveTextContent('Verpleging')
  })

  it('locking the location (adding "at this location") hides only the location picker — department still renders and cascades', async () => {
    const onCreate = vi.fn()
    const user = userEvent.setup()
    render(<AddContactPersonModal onClose={() => {}} onCreate={onCreate} locations={locations} departments={departments} statuses={statuses} lockLocationId="loc-1" />)

    // Location is pre-filled/hidden; department must still be pickable and already
    // scoped to loc-1 (the location departmentsForLocation cascade off form.locationId).
    expect(screen.queryByRole('button', { name: ct('subModal.selectLocation') })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: ct('subModal.selectDepartment') }))
    expect(screen.getByRole('button', { name: 'Verpleging' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Thuiszorg' })).not.toBeInTheDocument()
  })

  it('toggling "primair" ON while another contact is already primary asks first — confirming turns it on', async () => {
    const onCreate = vi.fn()
    const user = userEvent.setup()
    const existing = [contact({ id: 'c-primary', name: 'Anna Bakker', isPrimary: true })]
    render(<AddContactPersonModal onClose={() => {}} onCreate={onCreate} locations={locations} statuses={statuses} existing={existing} />)

    const toggle = screen.getByRole('switch', { name: ct('subModal.isPrimary') })
    expect(toggle).toHaveAttribute('aria-checked', 'false')

    await user.click(toggle)
    // Staged, not yet applied — the toggle must not flip before the user confirms.
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByText(ct('subModal.primaryReplace.title'))).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: ct('subModal.primaryReplace.confirm') }))
    expect(toggle).toHaveAttribute('aria-checked', 'true')
  })

  it('cancelling the primary-replace confirmation leaves the toggle off and changes nothing else', async () => {
    const onCreate = vi.fn()
    const user = userEvent.setup()
    const existing = [contact({ id: 'c-primary', name: 'Anna Bakker', isPrimary: true })]
    render(<AddContactPersonModal onClose={() => {}} onCreate={onCreate} locations={locations} statuses={statuses} existing={existing} />)

    const toggle = screen.getByRole('switch', { name: ct('subModal.isPrimary') })
    await user.click(toggle)
    await user.click(screen.getByRole('button', { name: ct('subModal.primaryReplace.decline') }))

    expect(toggle).toHaveAttribute('aria-checked', 'false')
  })

  it('editing the contact that is ALREADY primary never prompts on save', async () => {
    const onCreate = vi.fn()
    const user = userEvent.setup()
    // Same id as `initial` — must be excluded from the "someone else is primary" check.
    const initial = contact({ id: 'c-self', name: 'Jan Jansen', firstName: 'Jan', lastName: 'Jansen', isPrimary: true })
    const existing = [initial]
    render(<AddContactPersonModal onClose={() => {}} onCreate={onCreate} locations={locations} statuses={statuses} initial={initial} existing={existing} />)

    const toggle = screen.getByRole('switch', { name: ct('subModal.isPrimary') })
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    // Toggling off and back on for the already-primary contact must never prompt.
    await user.click(toggle)
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByText(ct('subModal.primaryReplace.title'))).not.toBeInTheDocument()
  })

  it('typing an email that another contact already has shows the duplicate message and blocks submit', async () => {
    const onCreate = vi.fn()
    const user = userEvent.setup()
    const existing = [contact({ id: 'c-other', name: 'Anna Bakker', email: 'anna@klant.nl' })]
    render(<AddContactPersonModal onClose={() => {}} onCreate={onCreate} locations={locations} statuses={statuses} existing={existing} />)

    await user.type(screen.getByLabelText(ct('subModal.firstName'), { exact: false }), 'Jan')
    await user.type(screen.getByLabelText(ct('subModal.lastName'), { exact: false }), 'Jansen')
    await user.type(screen.getByLabelText(ct('subModal.email'), { exact: false }), 'anna@klant.nl')

    expect(screen.getByText(ct('subModal.duplicate.email', { name: 'Anna Bakker' }))).toBeInTheDocument()
    const createBtn = screen.getByRole('button', { name: ct('subModal.create') })
    expect(createBtn).toBeDisabled()

    await user.click(createBtn)
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('a phone duplicate is detected on digits only, ignoring punctuation/spacing differences', async () => {
    const onCreate = vi.fn()
    const user = userEvent.setup()
    // Same digits as the typed value below, just formatted with a dash/spaces —
    // the digit-only compare must still catch it (a plain string compare would not).
    const existing = [contact({ id: 'c-other', name: 'Anna Bakker', phone: '010-522 97 18' })]
    render(<AddContactPersonModal onClose={() => {}} onCreate={onCreate} locations={locations} statuses={statuses} existing={existing} />)

    await user.type(screen.getByLabelText(ct('subModal.firstName'), { exact: false }), 'Jan')
    await user.type(screen.getByLabelText(ct('subModal.lastName'), { exact: false }), 'Jansen')
    await user.type(screen.getByLabelText(ct('subModal.phone'), { exact: false }), '0105229718')

    expect(screen.getByText(ct('subModal.duplicate.phone', { name: 'Anna Bakker' }))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: ct('subModal.create') })).toBeDisabled()
  })

  it('an international-format phone is NOT folded to the same value as a domestic one (plain digit-strip, no country-code normalization)', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    const existing = [contact({ id: 'c-other', name: 'Anna Bakker', phone: '+31 10 522 97 18' })]
    render(<AddContactPersonModal onClose={() => {}} onCreate={onCreate} locations={locations} statuses={statuses} existing={existing} />)

    await user.type(screen.getByLabelText(ct('subModal.firstName'), { exact: false }), 'Jan')
    await user.type(screen.getByLabelText(ct('subModal.lastName'), { exact: false }), 'Jansen')
    await user.type(screen.getByLabelText(ct('subModal.phone'), { exact: false }), '0105229718')

    // "31105229718" (stripped) !== "0105229718" (stripped) — no duplicate, submit stays enabled.
    expect(screen.queryByText(ct('subModal.duplicate.phone', { name: 'Anna Bakker' }))).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: ct('subModal.create') })).not.toBeDisabled()
  })
})
