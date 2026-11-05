/** ContactDetail · changelog, timeline and sub-tabs (split from ContactDetail.test.tsx; resolves copy through the active locale's own i18n). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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
 * TIJDLIJN-SUBDRILL-1 — the timeline tab shows this contact's own activity log
 * (LOC-DEPT-CHANGELOG-1). Proves the tab renders and GETs the correct endpoint.
 */
describe('ContactDetail · timeline tab (TIJDLIJN-SUBDRILL-1)', () => {
  it('renders the timeline tab and opens it via the sub-tab bar', async () => {
    const user = userEvent.setup()
    render(<ContactDetail contact={baseContact()} locations={locations} departments={departments} statuses={statuses}
      onSave={vi.fn()} onDelete={vi.fn()} close={vi.fn()} />)

    // Find and click the timeline tab.
    const timelineTab = screen.getByRole('tab', { name: ct('drawer.tabs.timeline') })
    expect(timelineTab).toBeInTheDocument()
    await user.click(timelineTab)

    // Verify the endpoint is called when the tab opens.
    await waitFor(() => expect(vi.mocked(api.get)).toHaveBeenCalledWith('/customers/cust-1/contacts/c1/activity', expect.anything()))
  })
})

/** K-288: the linked-notes feed moved out of the Notities sub-tab into its own
 *  sub-tab, right after Notities. */
describe('ContactDetail · linkedNotes sub-tab (K-288)', () => {
  it('renders the LinkedNotesTab stub when the sub-tab is clicked', async () => {
    const user = userEvent.setup()
    render(<ContactDetail contact={baseContact()} locations={locations} departments={departments} statuses={statuses}
      onSave={vi.fn()} onDelete={vi.fn()} close={vi.fn()} />)

    await user.click(screen.getByRole('tab', { name: ct('notes.linkedNotes') }))
    expect(await screen.findByTestId('linked-notes-tab')).toBeInTheDocument()
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
