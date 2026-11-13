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
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import ContactDetail from './ContactDetail'
import type { Contact, Department } from '@/types/customer'

// useContactFunctions + useCustomFields both hit @/lib/api under the hood (the
// contact-function lookup + tenant settings, and the custom-field defs) — a
// harmless empty response keeps each on its own seed fallback, same mock as
// AddContactPersonModal.test.tsx for the same hooks. The archive/restore/erase tests
// that assert the exact POST route live in ContactDetail.actions.test.tsx; here
// `post` is a plain stub because no test in this file reaches it.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn().mockResolvedValue({ data: { data: [] } }), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }
})

// Notify stubs only: no test in this file asserts a toast (the K-005 erase toast is asserted in ContactDetail.actions.test.tsx).
vi.mock('@/lib/notify', () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }))

// CONTACT-TEKST-1: minimal stand-in for the Tiptap editor the free-text block
// mounts while editing — same stub EditableRichTextField.test.tsx uses; its own
// ProseMirror internals are out of scope here.
vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange }: { value?: string; onChange: (v: string) => void }) => (
    <textarea data-testid="rte" value={value ?? ''} onChange={e => onChange(e.target.value)} />
  ),
}))

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

// K-288: the linked-notes feed is now its own sub-tab (LinkedNotesTab), built in a
// parallel lane with its own suite — stub it here so this file never touches its
// internals (react-query, useNoteFeed, …).
vi.mock('@/components/drawer/tabs/notes/LinkedNotesTab', () => ({ default: () => <div data-testid="linked-notes-tab" /> }))

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const ct = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'customers', ...opts })
const cm = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'common', ...opts })

const locations = [{ id: 'loc-1', name: 'Locatie Noord' }, { id: 'loc-2', name: 'Locatie Zuid' }]
const statuses = [{ value: 'st-1', label: 'Actief' }]

// Minimal-but-type-complete Department fixture (mirrors AddContactPersonModal.test.tsx) —
// only id/name/locationId vary per test, everything else is a harmless default.
const dept = (id: string, name: string, locationId: string): Department => ({
  id, helloflexLink: null, shiftmanagerLink: null, name, description: '', locationId, locationName: '',
  contacts: [], costCenter: '', billingEmail: '', statusId: null, status: '', statusLabel: '', statusColor: '', customFields: {}, inUse: false,
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
    expect(screen.getByText(i18n.t('common:lookupSeeds.genders.female'))).toBeInTheDocument()
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
    await user.click(await screen.findByText(i18n.t('common:lookupSeeds.genders.male')))
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
