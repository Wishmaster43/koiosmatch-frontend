/** ContactDetail · merge, pager, archive/restore and erase (split from ContactDetail.test.tsx; resolves copy through the active locale's own i18n). */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import ContactDetail from './ContactDetail'
import { CONTACTS_CHANGED_EVENT } from '../hooks/useCustomerContacts'
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

// ONIX K-005: the erase flow's success toast is a real call, not just "a callback fired".
const mockNotifySuccess = vi.fn()
vi.mock('@/lib/notify', () => ({ notifySuccess: (...args: unknown[]) => mockNotifySuccess(...args), notifyError: vi.fn() }))

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

    expect(mockPost).toHaveBeenCalledWith('/customers/cust-1/contacts/c1/archive', undefined, expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) }))
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

    expect(mockPost).toHaveBeenCalledWith('/customers/cust-1/contacts/c1/restore', undefined, expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) }))
    await waitFor(() => expect(close).toHaveBeenCalled())
  })
})


/**
 * ONIX K-005 — "Persoon wissen". Permission-gated like merge/archive (privacy.erase),
 * and a fake affordance once already archived (an erase leaves the contact archived,
 * so a second click would always fail). The POST is asserted by route + body (§13).
 */
describe('ContactDetail · erase person (ONIX K-005)', () => {
  const allowed = { hasPermission: (p: string) => p === 'privacy.erase' }
  afterEach(() => { mockAuth.current = null })

  it('HIDES the erase action without privacy.erase', () => {
    mockAuth.current = { hasPermission: () => false }
    render(<ContactDetail contact={baseContact()} locations={locations} departments={departments} statuses={statuses}
      onSave={vi.fn()} onDelete={vi.fn()} close={vi.fn()} />)
    expect(screen.queryByTitle(ct('contacts.detail.erasePerson'))).toBeNull()
  })

  it('HIDES the erase action on an already-archived contact', () => {
    mockAuth.current = allowed
    render(<ContactDetail contact={baseContact({ archived: true })} locations={locations} departments={departments} statuses={statuses}
      onSave={vi.fn()} onDelete={vi.fn()} close={vi.fn()} />)
    expect(screen.queryByTitle(ct('contacts.detail.erasePerson'))).toBeNull()
  })

  it('shows the erase action with privacy.erase on a live contact', () => {
    mockAuth.current = allowed
    render(<ContactDetail contact={baseContact()} locations={locations} departments={departments} statuses={statuses}
      onSave={vi.fn()} onDelete={vi.fn()} close={vi.fn()} />)
    expect(screen.getByTitle(ct('contacts.detail.erasePerson'))).toBeInTheDocument()
  })

  it('opens the dialog, POSTs the erase route with { password }, and shows the success toast', async () => {
    mockAuth.current = allowed
    const user = userEvent.setup()
    const close = vi.fn()
    const onChangedEvent = vi.fn()
    window.addEventListener(CONTACTS_CHANGED_EVENT, onChangedEvent)
    mockPost.mockResolvedValue({ data: { data: { message: 'ok', contact_id: 'c1' } } })
    render(<ContactDetail contact={baseContact()} locations={locations} departments={departments} statuses={statuses}
      onSave={vi.fn()} onDelete={vi.fn()} close={close} />)

    await user.click(screen.getByTitle(ct('contacts.detail.erasePerson')))
    const dialog = screen.getByRole('dialog', { name: ct('contacts.detail.eraseTitle') })

    await user.type(within(dialog).getByLabelText(cm('eraseDialog.password'), { exact: false }), 'geheim')
    await user.click(within(dialog).getByRole('button', { name: ct('contacts.detail.eraseTitle') }))

    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/customers/cust-1/contacts/c1/erase', { password: 'geheim' }))
    await waitFor(() => expect(mockNotifySuccess).toHaveBeenCalledWith(ct('contacts.detail.eraseDone')))
    await waitFor(() => expect(onChangedEvent).toHaveBeenCalled())
    await waitFor(() => expect(close).toHaveBeenCalled())
    window.removeEventListener(CONTACTS_CHANGED_EVENT, onChangedEvent)
  })
})
