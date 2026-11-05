/** LocationDetail · create contact and link on a no-match dead end (split from LocationDetail.contacts.test.tsx; resolves copy through the active locale's own i18n). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import LocationDetail from './LocationDetail'
import { statuses, location } from './LocationDetail.testKit'
// ONE-CLICK-COUPLE-2: asserts the honest success/failure toasts the create-and-link
// flow fires — same mocked module the file already stubs above.
import { notifyError, notifySuccess } from '@/lib/notify'
import type { Contact } from '@/types/customer'
import type { LookupOption } from '@/types/common'

// useCustomFields hits the API in an effect — stub it so the Extra sub-tab stays
// hidden (no custom fields defined) and no network call happens under test.
// useLocations is react-query-backed (the Vestiging block's option list) — mocked away.
vi.mock('@/lib/useLocations', () => ({
  useLocations: () => [{ value: 'br-1', label: 'Vestiging Noord' }, { value: 'br-2', label: 'Vestiging Zuid' }],
}))
vi.mock('@/lib/useCustomFields', () => ({
  useCustomFields: () => ({ fields: [], allFields: [], loading: false, invalidate: () => {} }),
}))
// KLANTLOCATIE-GEOCODE-1: the Koppelingen sub-tab's PDOK card fires a REAL POST, so the
// client is stubbed (get too — useProvinces reads /provinces on mount) while the module's
// named helpers stay real. GeocodeButton hides itself without the permission, so useAuth
// is stubbed to grant it; hasModule stays false, exactly like the unprovided context did.
const mockPost = vi.fn()
// ONE-CLICK-COUPLE-1: `put` backs the real (unmocked) setLocationPrimaryContact —
// the new tests exercise the ACTUAL hook function, not a re-mock of it, so the
// event it dispatches on a real success is the real CONTACTS_CHANGED_EVENT too.
const mockPut = vi.fn()
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return {
    ...actual,
    default: {
      get: vi.fn().mockResolvedValue({ data: [] }),
      post: (...args: unknown[]) => mockPost(...args),
      put: (...args: unknown[]) => mockPut(...args),
      patch: vi.fn(), delete: vi.fn(),
    },
  }
})
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ hasPermission: () => true, hasModule: () => false }),
}))
vi.mock('@/lib/notify', () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }))
// Tiptap needs a real browser to mount — stubbed with a plain controlled textarea,
// mirrors EditableRichTextField.test.tsx's own convention (its pencil/save/cancel
// dance is unit-tested there; this file only needs to prove LocationDetail's wiring).
vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange }: { value?: string; onChange: (v: string) => void }) => (
    <textarea data-testid="rte" value={value ?? ''} onChange={e => onChange(e.target.value)} />
  ),
}))
// SCOPED-LIST-TAB-1: each own their own fetch (react-query/useMatchStatuses) —
// covered by ScopedListTab.test.tsx/useScopedEntityList.test.ts. Stubbed here so
// this file only proves LocationDetail's OWN wiring (right scope/id per sub-tab).
vi.mock('./ScopedVacanciesTab', () => ({
  default: ({ scope, id, customerId, customerName, scopeName }: { scope: string; id?: string; customerId?: string; customerName?: string; scopeName?: string }) =>
    <div data-testid="scoped-vacancies">{scope}:{id}:{customerId}:{customerName}:{scopeName}</div>,
}))
vi.mock('./ScopedMatchesTab', () => ({
  default: ({ scope, id, customerId }: { scope: string; id?: string; customerId?: string }) =>
    <div data-testid="scoped-matches">{scope}:{id}:{customerId}</div>,
}))
// TAKEN-OP-LOCATIE-1: same stub convention as DepartmentDetail.test.tsx — this
// file only proves LocationDetail's OWN wiring (right linkType/id), not the
// shared tab's own fetch/columns (covered elsewhere).
vi.mock('@/components/drawer/tabs/EntityTasksTab', () => ({
  default: ({ linkType, id }: { linkType: string; id?: string }) => <div data-testid="entity-tasks">{linkType}:{id}</div>,
}))
// NOTES-LOC-DEPT-1/DOCS-LOC-DEPT-1: same stub convention as ScopedVacanciesTab/
// ScopedMatchesTab above — this file only proves LocationDetail's OWN wiring
// (right scope/id/customerId), not the shared tabs' own fetch (covered elsewhere).
vi.mock('./ScopedNotesTab', () => ({
  default: ({ scope, id, customerId }: { scope: string; id?: string; customerId?: string }) =>
    <div data-testid="scoped-notes">{scope}:{id}:{customerId}</div>,
}))
// K-288: linked-notes feed's own sub-tab — same stub convention as ScopedNotesTab
// above, this file only proves LocationDetail's OWN wiring (entity/id/sub).
vi.mock('@/components/drawer/tabs/notes/LinkedNotesTab', () => ({
  default: ({ entity, id, sub }: { entity: string; id?: string; sub?: { kind: string; id?: string } }) =>
    <div data-testid="linked-notes-tab">{entity}:{id}:{sub?.kind}:{sub?.id}</div>,
}))
vi.mock('./ScopedDocumentsTab', () => ({
  default: ({ scope, id, customerId }: { scope: string; id?: string; customerId?: string }) =>
    <div data-testid="scoped-documents">{scope}:{id}:{customerId}</div>,
}))

// CustomerApplicationsList (mounted, unstubbed, by that same sub-tab) reads the
// tenant funnel lookup via the global LookupsContext — mocked here the same way
// CustomerApplicationsList.test.tsx itself does, rather than mounting a real provider.
vi.mock('@/context/LookupsContext', () => ({
  useLookups: () => ({ funnelTypes: [{ value: 'applied', label: 'Aangemeld', color: 'var(--color-info)' }], funnelMeta: () => ({ label: '', color: 'var(--text-muted)' }) }),
}))

beforeEach(() => { vi.clearAllMocks(); mockPost.mockResolvedValue({ status: 202, data: {} }) })

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const ct = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'customers', ...opts })

// Every required prop the component reads — kept minimal, only onSave is asserted.
const baseProps = {
  customerId: 'cust-1', customerName: 'Zorggroep A', locations: [], departments: [], contacts: [],
  statuses, departmentStatuses: [] as LookupOption[], contactStatuses: [] as LookupOption[],
  onDelete: vi.fn(), onAddDepartment: vi.fn(), onUpdateDepartment: vi.fn(), onRemoveDepartment: vi.fn(),
  onAddContact: vi.fn(), onUpdateContact: vi.fn(), onRemoveContact: vi.fn(), close: vi.fn(),
}

const contactFixture = (over: Partial<Contact> = {}): Contact => ({
  id: 'con-1', helloflexLink: null, shiftmanagerLink: null, customerId: 'cust-1',
  firstName: 'Joost', middleName: 'de', lastName: 'Boer', name: 'Joost de Boer', role: 'Teamleider',
  email: 'joost@klant.test', phone: '', mobile: '', gender: '', isPrimary: false,
  locationId: 'loc-1', locationName: '', departmentId: null, departmentName: '',
  locations: [], departments: [], statusId: null, status: '', statusLabel: '', statusColor: '',
  lastContactAt: null, lastContactType: null, customFields: {},
  ...over,
} as Contact)

/**
 * ONE-CLICK-COUPLE-2 (Danny, third escalation: "Waarom staat dit er nog steeds!!") — every
 * seeded location shows the fallback because the one-click couple in LocationDetail.contacts.test.tsx only fires on a
 * UNIQUE match, and most seeded/typed text matches nobody (a location mailbox email, a
 * pool-generated name). This closes THAT dead end: the no-match branch gets a second,
 * PROMOTED action that creates the missing contact from the typed text, then couples it the
 * exact same way `coupleMatch` does — one click instead of a manual detour to Contactpersonen.
 *
 * These tests exercise the REAL (unmocked) setLocationPrimaryContact — only `api.put` is
 * stubbed (`mockPut`) — so a successful click proves the real CONTACTS_CHANGED_EVENT chain,
 * same discipline as the ONE-CLICK-COUPLE-1 tests in LocationDetail.contacts.test.tsx. `onAddContact` is a per-test mock —
 * this is the container boundary LocationContactSection actually owns; the real POST body
 * that mock stands in for is covered separately by useCustomerContacts.test.ts's own `add()` tests.
 */
describe('LocationDetail · create contact and link on a no-match dead end (ONE-CLICK-COUPLE-2)', () => {
  it('(a) renders the promoted create-and-link button on a no-match dead end, with the italic warning hidden', () => {
    render(<LocationDetail location={location({ contactName: 'Sanne de Vries', email: 'locatie1@example.test' })} onSave={vi.fn()} {...baseProps}
      contacts={[]} />)

    expect(screen.getByRole('button', { name: ct('locations.detail.createAndLink') })).toBeInTheDocument()
    expect(screen.queryByText(ct('locations.detail.contactNotLinked'))).not.toBeInTheDocument()
    // The manual pick stays available too — it is now the SECONDARY way to link a
    // DIFFERENT existing person, not the only option.
    expect(screen.getByRole('button', { name: ct('locations.detail.pickPrimaryContact') })).toBeInTheDocument()
  })

  it('(b) click: calls onAddContact with the split name/email/phone, THEN PUTs the primary coupling with the returned id, in that order', async () => {
    const user = userEvent.setup()
    const calls: string[] = []
    const onAddContact = vi.fn(async () => { calls.push('contact'); return { id: 'con-new', name: 'Sanne de Vries' } as Contact })
    mockPut.mockImplementation(async () => {
      calls.push('couple')
      return { data: { data: { id: 'con-new', locations: [{ id: 'loc-1', name: 'Hoofdlocatie', is_primary: true }] } } }
    })
    render(<LocationDetail location={location({ contactName: 'Sanne de Vries', email: 'locatie1@example.test', phone: '+31104811775' })}
      onSave={vi.fn()} {...baseProps} contacts={[]} onAddContact={onAddContact} />)

    await user.click(screen.getByRole('button', { name: ct('locations.detail.createAndLink') }))

    await waitFor(() => expect(mockPut).toHaveBeenCalledWith('/customers/cust-1/contacts/con-new/locations/loc-1/primary'))
    // The split name (first word -> firstName, rest -> lastName) plus the location's own
    // typed email/phone ride along — the request body, not just that a callback fired (§13).
    expect(onAddContact).toHaveBeenCalledWith(expect.objectContaining({
      firstName: 'Sanne', lastName: 'de Vries', email: 'locatie1@example.test', phone: '+31104811775',
    }))
    // Order matters: the coupling PUT must never fire before the contact itself exists.
    expect(calls).toEqual(['contact', 'couple'])
    expect(notifySuccess).toHaveBeenCalledWith(ct('locations.detail.setPrimaryContactDone', { name: 'Sanne de Vries' }))
  })

  it('(c) contact-create failure: one honest toast, nothing lost, no coupling attempted', async () => {
    const user = userEvent.setup()
    const onAddContact = vi.fn().mockRejectedValue(new Error('422 required first_name'))
    render(<LocationDetail location={location({ contactName: 'Sanne de Vries', email: 'locatie1@example.test' })}
      onSave={vi.fn()} {...baseProps} contacts={[]} onAddContact={onAddContact} />)

    await user.click(screen.getByRole('button', { name: ct('locations.detail.createAndLink') }))

    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(ct('locations.detail.createContactFailed')))
    expect(mockPut).not.toHaveBeenCalled()
    // The block stays on the exact same fallback render — nothing to reconcile.
    expect(screen.getByRole('button', { name: ct('locations.detail.createAndLink') })).toBeInTheDocument()
  })

  it('(c) coupling fails after a successful create: the contact stays created, one honest toast, block stays in fallback', async () => {
    const user = userEvent.setup()
    const onAddContact = vi.fn().mockResolvedValue({ id: 'con-new', name: 'Sanne de Vries' } as Contact)
    mockPut.mockRejectedValue(new Error('network'))
    render(<LocationDetail location={location({ contactName: 'Sanne de Vries', email: 'locatie1@example.test' })}
      onSave={vi.fn()} {...baseProps} contacts={[]} onAddContact={onAddContact} />)

    await user.click(screen.getByRole('button', { name: ct('locations.detail.createAndLink') }))

    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(ct('locations.detail.setPrimaryContactFailed')))
    // Never rolled back: the create call happened and stays that way — the fallback UI
    // (still driven by the CALLER's own `contacts` prop, which this failure never updates)
    // simply keeps showing this same render; a real reload would find the new contact via
    // the unique-match button above once the caller's list refreshes.
    expect(onAddContact).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Sanne de Vries' })).toBeNull()
  })

  it('(d) unique-match case is unchanged: its own "Koppel {name}" button renders, not the create-and-link one', () => {
    render(<LocationDetail location={location({ contactName: 'Joost de Boer', email: 'joost@klant.test' })} onSave={vi.fn()} {...baseProps}
      contacts={[contactFixture()]} />)

    expect(screen.getByRole('button', { name: ct('locations.detail.linkNamed', { name: 'Joost de Boer' }) })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: ct('locations.detail.createAndLink') })).toBeNull()
  })
})
