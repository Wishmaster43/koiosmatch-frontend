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
import { describe, it, expect, vi, afterEach } from 'vitest'
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

// Merge is permission-gated (customers.update). Default null = no auth context at all,
// which is what every pre-existing test in this file renders under.
const mockAuth: { current: { hasPermission: (p: string) => boolean } | null } = { current: null }
vi.mock('@/context/AuthContext', async () => {
  const actual = await vi.importActual('@/context/AuthContext')
  return { ...actual, useAuth: () => mockAuth.current }
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
  contacts: [], costCenter: '', statusId: null, status: '', statusLabel: '', statusColor: '', customFields: {}, inUse: false,
})
const departments = [dept('dep-1', 'Verpleging', 'loc-1'), dept('dep-2', 'Thuiszorg', 'loc-2')]

const baseContact = (overrides: Partial<Contact> = {}): Contact => ({
  id: 'c1', helloflexLink: null, shiftmanagerLink: null,
  // CONTACT-GESLACHT-1 + the merge scope id — both required on Contact now.
  customerId: 'cust-1', gender: '',
  firstName: 'Jan', middleName: '', lastName: 'Jansen', name: 'Jan Jansen',
  role: '', email: '', phone: '', mobile: '', isPrimary: false,
  locationId: null, locationName: '', departmentId: null, departmentName: '',
  locations: [], departments: [], statusId: null, status: '', statusLabel: '', statusColor: '', customFields: {},
  // Last-contact pair — the resource sends both now; null here means "never contacted".
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

/**
 * CONTACT-GESLACHT-1 — the column is `gender` and stores the candidate_genders VALUE
 * SLUG, so the field must (a) offer the tenant /genders lookup rather than three
 * hardcoded options and (b) SAVE the slug while DISPLAYING the label. `@/lib/api` is
 * mocked to an empty response above, so useGenders falls back to its seed list.
 */
describe('ContactDetail · gender', () => {
  it('renders the lookup LABEL in read mode, not the stored slug', () => {
    render(<ContactDetail contact={baseContact({ gender: 'female' })} locations={locations} departments={departments}
      statuses={statuses} onSave={vi.fn()} onDelete={vi.fn()} close={vi.fn()} />)
    expect(screen.getByText('Vrouw')).toBeInTheDocument()
    expect(screen.queryByText('female')).not.toBeInTheDocument()
  })

  it('saves the SLUG, never the label', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<ContactDetail contact={baseContact()} locations={locations} departments={departments} statuses={statuses}
      onSave={onSave} onDelete={vi.fn()} close={vi.fn()} />)

    await user.click(screen.getAllByTitle(cm('edit'))[0])
    // Open the gender combobox (the row is label-span + control-div) and pick by label.
    await user.click(screen.getByText(ct('contacts.detail.gender')).parentElement!.querySelector('button')!)
    await user.click(await screen.findByText('Man'))
    await user.click(screen.getByTitle(cm('save')))

    expect(onSave).toHaveBeenCalledWith('c1', expect.objectContaining({ gender: 'male' }))
  })
})

/**
 * CMFE-16 merge entry point. Merging is destructive and irreversible, so the trigger is
 * permission-gated in the UI (customers.update — the backend re-checks anyway) and is
 * absent whenever it could not possibly succeed: no customer scope, or no second contact
 * at this customer to merge with. A button that can only ever fail is a fake affordance.
 */
describe('ContactDetail · merge entry point', () => {
  const other = baseContact({ id: 'c2', firstName: 'Jan', lastName: 'Janssen', name: 'Jan Janssen' })
  const allowed = { hasPermission: (p: string) => p === 'customers.update' }

  afterEach(() => { mockAuth.current = null })

  const renderDetail = (existing: Contact[]) =>
    render(<ContactDetail contact={baseContact()} locations={locations} departments={departments} statuses={statuses}
      existing={existing} onSave={vi.fn()} onDelete={vi.fn()} close={vi.fn()} />)

  it('shows the merge action with customers.update and a second contact present', () => {
    mockAuth.current = allowed
    renderDetail([baseContact(), other])
    expect(screen.getByRole('button', { name: ct('contacts.merge.title') })).toBeInTheDocument()
  })

  it('HIDES the merge action without customers.update', () => {
    mockAuth.current = { hasPermission: () => false }
    renderDetail([baseContact(), other])
    expect(screen.queryByRole('button', { name: ct('contacts.merge.title') })).not.toBeInTheDocument()
  })

  it('HIDES the merge action when this customer has no second contact', () => {
    mockAuth.current = allowed
    renderDetail([baseContact()])
    expect(screen.queryByRole('button', { name: ct('contacts.merge.title') })).not.toBeInTheDocument()
  })

  it('opens the merge dialog, scoped to this contact and its customer', async () => {
    mockAuth.current = allowed
    const user = userEvent.setup()
    renderDetail([baseContact(), other])

    await user.click(screen.getByRole('button', { name: ct('contacts.merge.title') }))

    expect(screen.getByRole('dialog', { name: ct('contacts.merge.title') })).toBeInTheDocument()
    // The other contact of THIS customer is offered as the duplicate.
    expect(screen.getByText('Jan Janssen')).toBeInTheDocument()
  })
})

/**
 * DRILL-PAGER-1 (Danny 02-08) — ContactDetail only RENDERS the pager the caller
 * (ContactsPanel) hands it; the caller-side scoping/navigation is covered in
 * ContactsPanel.test.tsx. This proves the wiring: no `pager` prop → no pager on
 * screen (today's behaviour, unaffected); a `pager` prop renders it in the title
 * row, before the delete button, and its buttons call exactly what was passed in.
 */
describe('ContactDetail · pager wiring', () => {
  it('renders no pager when the caller passes none', () => {
    render(<ContactDetail contact={baseContact()} locations={locations} departments={departments} statuses={statuses}
      onSave={vi.fn()} onDelete={vi.fn()} close={vi.fn()} />)
    expect(screen.queryByLabelText(cm('drillPager.next'))).toBeNull()
  })

  it('renders the pager before the delete button, wired to the caller\'s own handlers', async () => {
    const user = userEvent.setup()
    const onPrev = vi.fn()
    const onNext = vi.fn()
    render(<ContactDetail contact={baseContact()} locations={locations} departments={departments} statuses={statuses}
      onSave={vi.fn()} onDelete={vi.fn()} close={vi.fn()} pager={{ index: 1, total: 3, onNext }} />)

    expect(screen.getByTitle(cm('drillPager.nextAt', { index: 1, total: 3 }))).toBeInTheDocument()
    // First record: prev has no handler, so its button renders disabled.
    expect(screen.getByRole('button', { name: cm('drillPager.prev') })).toBeDisabled()
    const deleteBtn = screen.getByTitle(cm('delete'))
    const nextBtn = screen.getByRole('button', { name: cm('drillPager.next') })
    // The pager sits BEFORE the delete button in the same title-row corner.
    expect(nextBtn.compareDocumentPosition(deleteBtn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    await user.click(nextBtn)
    expect(onNext).toHaveBeenCalledTimes(1)
    expect(onPrev).not.toHaveBeenCalled()
  })
})
