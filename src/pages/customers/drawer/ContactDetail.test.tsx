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
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import i18n from '@/i18n'
import api from '@/lib/api'
import ContactDetail from './ContactDetail'
import type { Contact, Department } from '@/types/customer'

// useContactFunctions + useCustomFields both hit @/lib/api under the hood (the
// contact-function lookup + tenant settings, and the custom-field defs) — a
// harmless empty response keeps each on its own seed fallback, same mock as
// AddContactPersonModal.test.tsx for the same hooks. ARCHIVE-SUBENTITY-1: `post`
// is now a named capture too, so the archive/restore tests below can assert the
// exact route (§13), never only that a callback fired.
const mockPost = vi.fn().mockResolvedValue({ data: {} })
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn().mockResolvedValue({ data: { data: [] } }), post: (...args: unknown[]) => mockPost(...args), patch: vi.fn(), delete: vi.fn() } }
})
beforeEach(() => { mockPost.mockClear(); mockPost.mockResolvedValue({ data: {} }) })

// Merge is permission-gated (customers.update). Default null = no auth context at all,
// which is what every pre-existing test in this file renders under.
const mockAuth: { current: { hasPermission: (p: string) => boolean } | null } = { current: null }
vi.mock('@/context/AuthContext', async () => {
  const actual = await vi.importActual('@/context/AuthContext')
  return { ...actual, useAuth: () => mockAuth.current }
})

// DD-FE-6 ("no empty tabs"): the Koppelingen sub-tab only lists when a connector
// app is enabled — default both off (matches the pre-existing no-provider
// behaviour every other test in this file already renders under).
const mockUseApps = vi.fn<() => { isAppEnabled: (id: string) => boolean }>()
vi.mock('@/context/AppsContext', () => ({ useApps: () => mockUseApps() }))
beforeEach(() => { mockUseApps.mockReturnValue({ isAppEnabled: () => false }) })

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
  // CONTACT-LINKEDIN-1: optional on Contact, defaulted here like every other field.
  linkedin: '',
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
 * NAME-COMPOSITE-1 (Danny 05-08: "voornaam, tussenvoegsel en achternaam tonen als
 * 1 regel; alleen bij het potloodje zijn het er 3") — one composed line in read
 * mode, the three loose fields only while editing.
 */
describe('ContactDetail · name composite (NAME-COMPOSITE-1)', () => {
  it('shows the full name as ONE line in read mode, not three separate rows', () => {
    // The title row above the field table always shows contact.name too — give it a
    // DISTINCT value here so the field-row assertion below can only match the
    // composite, proving it composes from firstName/middleName/lastName, not `name`.
    render(<ContactDetail contact={baseContact({ firstName: 'Jan', middleName: 'de', lastName: 'Vries', name: 'Titelweergave' })}
      locations={locations} departments={departments} statuses={statuses} onSave={vi.fn()} onDelete={vi.fn()} close={vi.fn()} />)
    expect(screen.getByText('Titelweergave')).toBeInTheDocument()
    expect(screen.getByText('Jan de Vries')).toBeInTheDocument()
    expect(screen.queryByText(ct('subModal.firstName'))).not.toBeInTheDocument()
    expect(screen.queryByText(ct('contacts.detail.middleName'))).not.toBeInTheDocument()
  })

  it('expands to the three loose fields once editing starts, pre-filled from the record', async () => {
    const user = userEvent.setup()
    render(<ContactDetail contact={baseContact({ firstName: 'Jan', middleName: 'de', lastName: 'Vries', name: 'Jan de Vries' })}
      locations={locations} departments={departments} statuses={statuses} onSave={vi.fn()} onDelete={vi.fn()} close={vi.fn()} />)

    await user.click(screen.getAllByTitle(cm('edit'))[0])

    expect(screen.getByText(ct('subModal.firstName'))).toBeInTheDocument()
    expect(screen.getByText(ct('contacts.detail.middleName'))).toBeInTheDocument()
    expect(screen.getByDisplayValue('Jan')).toBeInTheDocument()
    expect(screen.getByDisplayValue('de')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Vries')).toBeInTheDocument()
  })

  it('saves an edited tussenvoegsel as part of the flat payload, no nested "name" key', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<ContactDetail contact={baseContact({ firstName: 'Jan', middleName: '', lastName: 'Vries', name: 'Jan Vries' })}
      locations={locations} departments={departments} statuses={statuses} onSave={onSave} onDelete={vi.fn()} close={vi.fn()} />)

    await user.click(screen.getAllByTitle(cm('edit'))[0])
    const middleNameRow = screen.getByText(ct('contacts.detail.middleName')).parentElement as HTMLElement
    await user.type(within(middleNameRow).getByRole('textbox'), 'de')
    await user.click(screen.getByTitle(cm('save')))

    expect(onSave).toHaveBeenCalledWith('c1', expect.objectContaining({ firstName: 'Jan', middleName: 'de', lastName: 'Vries' }))
  })
})

/**
 * CONTACT-LINKEDIN-1 (Danny 05-08) — the backend stores only the slug; the read
 * view links out to https://www.linkedin.com/in/{slug}.
 */
describe('ContactDetail · LinkedIn (CONTACT-LINKEDIN-1)', () => {
  it('renders the standard hyphen when no LinkedIn slug is stored', () => {
    render(<ContactDetail contact={baseContact({ linkedin: '' })} locations={locations} departments={departments} statuses={statuses}
      onSave={vi.fn()} onDelete={vi.fn()} close={vi.fn()} />)
    // Other empty fields render the same hyphen — assert the one in the LinkedIn row.
    const row = screen.getByText('LinkedIn').closest('div')!.parentElement!
    expect(row.textContent).toContain('-')
    expect(row.querySelector('a')).toBeNull()
  })

  it('renders the slug as a link to the canonical LinkedIn profile URL', () => {
    render(<ContactDetail contact={baseContact({ linkedin: 'jan-vries-1' })} locations={locations} departments={departments} statuses={statuses}
      onSave={vi.fn()} onDelete={vi.fn()} close={vi.fn()} />)
    expect(screen.getByRole('link', { name: 'jan-vries-1' })).toHaveAttribute('href', 'https://www.linkedin.com/in/jan-vries-1')
  })

  it('saves an edited LinkedIn value as part of the flat payload', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<ContactDetail contact={baseContact({ linkedin: '' })} locations={locations} departments={departments} statuses={statuses}
      onSave={onSave} onDelete={vi.fn()} close={vi.fn()} />)

    await user.click(screen.getAllByTitle(cm('edit'))[0])
    const linkedinRow = screen.getByText(ct('contacts.detail.linkedin')).parentElement as HTMLElement
    await user.type(within(linkedinRow).getByRole('textbox'), 'jan-vries-1')
    await user.click(screen.getByTitle(cm('save')))

    expect(onSave).toHaveBeenCalledWith('c1', expect.objectContaining({ linkedin: 'jan-vries-1' }))
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

/**
 * ARCHIVE-SUBENTITY-1 — same reversible soft-delete pair as Location/Department,
 * gated on the same customers.update permission the merge action already uses.
 * No InUseCountsDialog wiring here (contacts have no honest disabled-trash/409
 * dialog built — `remove` fires unconditionally, unlike the location/department
 * trash button — so there is no dead end to offer an escape from).
 */
describe('ContactDetail · archive/restore (ARCHIVE-SUBENTITY-1)', () => {
  const allowed = { hasPermission: (p: string) => p === 'customers.update' }
  afterEach(() => { mockAuth.current = null })

  it('HIDES the archive action without customers.update', () => {
    mockAuth.current = { hasPermission: () => false }
    render(<ContactDetail contact={baseContact()} locations={locations} departments={departments} statuses={statuses}
      onSave={vi.fn()} onDelete={vi.fn()} close={vi.fn()} />)
    expect(screen.queryByTitle(ct('contacts.detail.archiveContact'))).toBeNull()
  })

  it('confirms, then POSTs the archive route and closes the panel on success', async () => {
    mockAuth.current = allowed
    const user = userEvent.setup()
    const close = vi.fn()
    render(<ContactDetail contact={baseContact()} locations={locations} departments={departments} statuses={statuses}
      onSave={vi.fn()} onDelete={vi.fn()} close={close} />)

    await user.click(screen.getByTitle(ct('contacts.detail.archiveContact')))
    await user.click(screen.getByRole('button', { name: cm('confirm') }))

    expect(mockPost).toHaveBeenCalledWith('/customers/cust-1/contacts/c1/archive')
    await waitFor(() => expect(close).toHaveBeenCalled())
  })

  it('renders no archive button once the contact is already archived — the ArchivedBanner offers restore instead', () => {
    mockAuth.current = allowed
    render(<ContactDetail contact={baseContact({ archived: true })} locations={locations} departments={departments} statuses={statuses}
      onSave={vi.fn()} onDelete={vi.fn()} close={vi.fn()} />)
    expect(screen.queryByTitle(ct('contacts.detail.archiveContact'))).toBeNull()
    expect(screen.getByText(ct('contacts.archivedBanner.flag'))).toBeInTheDocument()
  })

  it('restore round-trip: the banner\'s restore button POSTs the restore route and closes the panel', async () => {
    mockAuth.current = allowed
    const user = userEvent.setup()
    const close = vi.fn()
    render(<ContactDetail contact={baseContact({ archived: true })} locations={locations} departments={departments} statuses={statuses}
      onSave={vi.fn()} onDelete={vi.fn()} close={close} />)

    await user.click(screen.getByRole('button', { name: ct('contacts.archivedBanner.restore') }))

    expect(mockPost).toHaveBeenCalledWith('/customers/cust-1/contacts/c1/restore')
    await waitFor(() => expect(close).toHaveBeenCalled())
  })
})

/** LOC-DEPT-CHANGELOG-1 — mirrors Location/DepartmentDetail: proves the actual GET. */
describe('ContactDetail · changelog (LOC-DEPT-CHANGELOG-1)', () => {
  it('fetches this contact\'s own activity endpoint once the popover opens', async () => {
    const user = userEvent.setup()
    render(<ContactDetail contact={baseContact()} locations={locations} departments={departments} statuses={statuses}
      onSave={vi.fn()} onDelete={vi.fn()} close={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: cm('changelog') }))
    await waitFor(() => expect(vi.mocked(api.get)).toHaveBeenCalledWith('/customers/cust-1/contacts/c1/activity', expect.anything()))
  })
})

/**
 * SCOPED-LIST-TAB-1 — the contact's own Kansen sub-tab (mirrors Location/
 * DepartmentDetail's identical wiring). Mounts the REAL ScopedOpportunitiesTab
 * (no stub) so the assertion below proves the ACTUAL request — method + route +
 * the `contact_id[]` array-shaped param key (§13, never only that a callback
 * fired). Needs a QueryClientProvider: unlike every other hook this file already
 * exercises, ScopedOpportunitiesTab's list fetch goes through react-query.
 */
describe('ContactDetail · Kansen sub-tab (SCOPED-LIST-TAB-1)', () => {
  const queryWrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      {children}
    </QueryClientProvider>
  )

  it('renders the Kansen sub-tab content and fetches /opportunities with contact_id[]', async () => {
    const user = userEvent.setup()
    render(<ContactDetail contact={baseContact()} locations={locations} departments={departments} statuses={statuses}
      onSave={vi.fn()} onDelete={vi.fn()} close={vi.fn()} />, { wrapper: queryWrapper })

    await user.click(screen.getByRole('tab', { name: ct('drawer.tabs.opportunities') }))

    // The scope param key itself carries the literal `[]` (see ScopedOpportunitiesTab's
    // own file-header doc) — this is what turns a bare id into the one-element array
    // OpportunityQuery expects for the contact scope.
    await waitFor(() => expect(vi.mocked(api.get)).toHaveBeenCalledWith('/opportunities',
      expect.objectContaining({ params: { 'contact_id[]': 'c1', per_page: 100 } })))
  })
})

/**
 * GESPREK-CONTACT-1 — the contact's own Conversaties sub-tab. Mounts the REAL
 * ContactConversationsSection (no stub) so the assertion proves the actual
 * nested request, mirroring the Kansen test above and ContactConversationsSection's
 * own dedicated test file.
 */
describe('ContactDetail · Conversaties sub-tab (GESPREK-CONTACT-1)', () => {
  it('renders the Conversaties sub-tab content and fetches this contact\'s nested conversations route', async () => {
    const user = userEvent.setup()
    render(<ContactDetail contact={baseContact()} locations={locations} departments={departments} statuses={statuses}
      onSave={vi.fn()} onDelete={vi.fn()} close={vi.fn()} />)

    await user.click(screen.getByRole('tab', { name: ct('contacts.detail.subtabs.conversations') }))

    await waitFor(() => expect(vi.mocked(api.get)).toHaveBeenCalledWith('/customers/cust-1/contacts/c1/conversations', { params: undefined }))
  })
})

/**
 * DD-FE-6 ("no empty tabs" — 08-08): this file passes no extra children into
 * the shared BackofficeLinksTab, so with both connector apps off its body
 * would render nothing (no card, no "Koppelen" button) — the sub-tab must not
 * even be listed. useBackofficeLinksVisible drives the gate.
 */
describe('ContactDetail · Koppelingen sub-tab hidden when empty (DD-FE-6)', () => {
  it('drops the Koppelingen sub-tab when no connector app is enabled', () => {
    render(<ContactDetail contact={baseContact()} locations={locations} departments={departments} statuses={statuses}
      onSave={vi.fn()} onDelete={vi.fn()} close={vi.fn()} />)
    expect(screen.queryByRole('tab', { name: cm('backofficeLinks.tabLabel') })).not.toBeInTheDocument()
  })

  it('lists Koppelingen once a connector app (HelloFlex) is enabled', () => {
    mockUseApps.mockReturnValue({ isAppEnabled: (id: string) => id === 'hf' })
    render(<ContactDetail contact={baseContact()} locations={locations} departments={departments} statuses={statuses}
      onSave={vi.fn()} onDelete={vi.fn()} close={vi.fn()} />)
    expect(screen.getByRole('tab', { name: cm('backofficeLinks.tabLabel') })).toBeInTheDocument()
  })
})
