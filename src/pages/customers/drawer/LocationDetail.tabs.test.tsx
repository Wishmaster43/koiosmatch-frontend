/** LocationDetail · sub-tab wiring (scoped lists, notes, documents, applications, timeline, tasks) (split from LocationDetail.test.tsx; resolves copy through the active locale's own i18n). */
import type { ReactElement } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import LocationDetail from './LocationDetail'
import { statuses, location } from './LocationDetail.testKit'
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

// SOLLICITATIES-SCOPE-1: opening the new Sollicitaties sub-tab mounts
// LocationSollicitatiesTab, which calls a REAL react-query hook
// (useScopedVacancyIds) — only THOSE tests need a QueryClient in context, so
// this wrapper is used just there (see that describe block below); every other
// test in this file still uses plain `render`, unaffected by this feature.
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
const renderLocationDetail = (ui: ReactElement) =>
  render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
// CustomerApplicationsList (mounted, unstubbed, by that same sub-tab) reads the
// tenant funnel lookup via the global LookupsContext — mocked here the same way
// CustomerApplicationsList.test.tsx itself does, rather than mounting a real provider.
vi.mock('@/context/LookupsContext', () => ({
  useLookups: () => ({ funnelTypes: [{ value: 'applied', label: 'Aangemeld', color: 'var(--color-info)' }], funnelMeta: () => ({ label: '', color: 'var(--text-muted)' }) }),
}))

beforeEach(() => { vi.clearAllMocks(); mockPost.mockResolvedValue({ status: 202, data: {} }); queryClient.clear() })

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const ct = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'customers', ...opts })

// Every required prop the component reads — kept minimal, only onSave is asserted.
const baseProps = {
  customerId: 'cust-1', customerName: 'Zorggroep A', locations: [], departments: [], contacts: [],
  statuses, departmentStatuses: [] as LookupOption[], contactStatuses: [] as LookupOption[],
  onDelete: vi.fn(), onAddDepartment: vi.fn(), onUpdateDepartment: vi.fn(), onRemoveDepartment: vi.fn(),
  onAddContact: vi.fn(), onUpdateContact: vi.fn(), onRemoveContact: vi.fn(), close: vi.fn(),
}


/**
 * SCOPED-LIST-TAB-1 — the two new read-only sub-tabs pass this location's own
 * id + the right scope token through to the shared children (stubbed above).
 */
describe('LocationDetail · Vacatures/Matches sub-tabs', () => {
  it('wires the location scope + id into ScopedVacanciesTab', async () => {
    const user = userEvent.setup()
    render(<LocationDetail location={location()} onSave={vi.fn()} {...baseProps} />)
    await user.click(screen.getByRole('tab', { name: ct('drawer.tabs.vacancies') }))
    expect(screen.getByTestId('scoped-vacancies')).toHaveTextContent('location:loc-1')
  })

  // Point 1 (Danny's ten-point round): "+ Vacature"/"+ Match" from a scoped
  // sub-tab need the customer too — this location knows it, so it passes it on
  // (ScopedVacanciesTab also needs the customer NAME, for its lock display).
  it('also threads customerId/customerName/scopeName into ScopedVacanciesTab (point 1)', async () => {
    const user = userEvent.setup()
    render(<LocationDetail location={location()} onSave={vi.fn()} {...baseProps} />)
    await user.click(screen.getByRole('tab', { name: ct('drawer.tabs.vacancies') }))
    expect(screen.getByTestId('scoped-vacancies')).toHaveTextContent('location:loc-1:cust-1:Zorggroep A:Hoofdlocatie')
  })

  it('wires the location scope + id into ScopedMatchesTab', async () => {
    const user = userEvent.setup()
    render(<LocationDetail location={location()} onSave={vi.fn()} {...baseProps} />)
    await user.click(screen.getByRole('tab', { name: ct('drawer.tabs.matches') }))
    expect(screen.getByTestId('scoped-matches')).toHaveTextContent('location:loc-1')
  })

  // Point 1: "+ Match" needs the customer id to prefill MatchModal's cascade.
  it('also threads customerId into ScopedMatchesTab (point 1)', async () => {
    const user = userEvent.setup()
    render(<LocationDetail location={location()} onSave={vi.fn()} {...baseProps} />)
    await user.click(screen.getByRole('tab', { name: ct('drawer.tabs.matches') }))
    expect(screen.getByTestId('scoped-matches')).toHaveTextContent('location:loc-1:cust-1')
  })
})

/**
 * NOTES-LOC-DEPT-1/DOCS-LOC-DEPT-1 — this location's own Notities/Documenten
 * sub-tabs, right after Sollicitaties, wired with the "location" scope + this
 * location's own id + the customer id (stubbed above).
 */
describe('LocationDetail · Notities/Documenten sub-tabs (NOTES-LOC-DEPT-1/DOCS-LOC-DEPT-1)', () => {
  it('wires the location scope + id into ScopedNotesTab', async () => {
    const user = userEvent.setup()
    render(<LocationDetail location={location()} onSave={vi.fn()} {...baseProps} />)
    await user.click(screen.getByRole('tab', { name: ct('drawer.tabs.notes') }))
    expect(screen.getByTestId('scoped-notes')).toHaveTextContent('location:loc-1:cust-1')
  })

  it('wires the location scope + id into ScopedDocumentsTab', async () => {
    const user = userEvent.setup()
    render(<LocationDetail location={location()} onSave={vi.fn()} {...baseProps} />)
    await user.click(screen.getByRole('tab', { name: ct('drawer.tabs.documents') }))
    expect(screen.getByTestId('scoped-documents')).toHaveTextContent('location:loc-1:cust-1')
  })
})

/** K-288: the linked-notes feed (NOTITIE-DOORLINK-1) moved out of ScopedNotesTab
 *  into its own sub-tab, right after Notities — wired with the customer id +
 *  the "locations" sub kind + this location's own id. */
describe('LocationDetail · linkedNotes sub-tab (K-288)', () => {
  it('wires entity/id/sub into LinkedNotesTab', async () => {
    const user = userEvent.setup()
    render(<LocationDetail location={location()} onSave={vi.fn()} {...baseProps} />)
    await user.click(screen.getByRole('tab', { name: ct('notes.linkedNotes') }))
    expect(screen.getByTestId('linked-notes-tab')).toHaveTextContent('customers:cust-1:locations:loc-1')
  })
})

/**
 * SOLLICITATIES-SCOPE-1 (Danny asked 3x at customer level, then again for
 * location/department) — the real two-step chain, unlike Vacatures/Matches
 * above (which stub the whole sub-component): CustomerApplicationsList is NOT
 * stubbed here, so this proves the actual honest data path end to end —
 * useScopedVacancyIds (step 1) resolves this location's own vacancies, THEN
 * useApplicationsByVacancyIds (step 2) filters by exactly those ids.
 */
describe('LocationDetail · Sollicitaties sub-tab (SOLLICITATIES-SCOPE-1)', () => {
  it('is lazy: no /vacancies or /applications request fires before the sub-tab is opened', () => {
    // Plain `render` here (not `renderLocationDetail`) is a deliberate part of the
    // proof: LocationSollicitatiesTab (and its react-query hook) never mounts
    // unless this sub-tab opens, so no QueryClientProvider is even needed yet.
    render(<LocationDetail location={location()} onSave={vi.fn()} {...baseProps} />)
    const calls = vi.mocked(api.get).mock.calls.map(([url]) => url)
    expect(calls).not.toContain('/vacancies')
    expect(calls).not.toContain('/applications')
  })

  it('opening it resolves this location\'s own vacancies, then filters applications by EXACTLY those vacancy ids', async () => {
    const user = userEvent.setup()
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/vacancies') return Promise.resolve({ data: { data: [{ id: 'vac-1' }, { id: 'vac-2' }] } })
      if (url === '/applications') {
        return Promise.resolve({
          data: {
            data: [{
              id: 'app-1', candidate: { id: 'cand-1', name: 'Jane Doe' }, vacancy: { id: 'vac-1', title: 'Verpleegkundige' },
              phase_key: 'applied', score: 82, created_at: '2026-07-01',
            }],
          },
        })
      }
      return Promise.resolve({ data: [] })
    })
    // Opening this sub-tab mounts LocationSollicitatiesTab's real react-query hook,
    // so THIS test (only) needs the QueryClientProvider-wrapped render.
    renderLocationDetail(<LocationDetail location={location()} onSave={vi.fn()} {...baseProps} />)

    await user.click(screen.getByRole('tab', { name: i18n.t('applications:title') }))
    // The real row rendering proves the WHOLE chain resolved, not just a callback.
    expect(await screen.findByText('Jane Doe')).toBeInTheDocument()

    const applicationsCall = vi.mocked(api.get).mock.calls.find(([url]) => url === '/applications')
    expect(applicationsCall?.[1]?.params).toMatchObject({ vacancy_id: ['vac-1', 'vac-2'] })
  })

  it('zero vacancies at this location: the empty state renders and /applications is never called', async () => {
    const user = userEvent.setup()
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/vacancies') return Promise.resolve({ data: { data: [] } })
      return Promise.resolve({ data: [] })
    })
    renderLocationDetail(<LocationDetail location={location()} onSave={vi.fn()} {...baseProps} />)

    await user.click(screen.getByRole('tab', { name: i18n.t('applications:title') }))
    expect(await screen.findByText(i18n.t('applications:empty'))).toBeInTheDocument()
    expect(vi.mocked(api.get).mock.calls.some(([url]) => url === '/applications')).toBe(false)
  })

  // Restore the file's own default GET response — the two tests above override
  // it per-URL, and vi.clearAllMocks() (the global beforeEach) clears CALLS but
  // not a mocked implementation, so the next describe block would otherwise
  // inherit this one's routing.
  afterEach(() => { vi.mocked(api.get).mockResolvedValue({ data: [] }) })
})


/**
 * TIJDLIJN-SUBDRILL-1 — the timeline tab shows this location's own activity log
 * (LOC-DEPT-CHANGELOG-1). Proves the tab renders and GETs the correct endpoint.
 */
describe('LocationDetail · timeline tab (TIJDLIJN-SUBDRILL-1)', () => {
  it('renders the timeline tab in the expected position and opens it via the sub-tab bar', async () => {
    const user = userEvent.setup()
    render(<LocationDetail location={location()} onSave={vi.fn()} {...baseProps} />)

    // Find and click the timeline tab.
    const timelineTab = screen.getByRole('tab', { name: ct('drawer.tabs.timeline') })
    expect(timelineTab).toBeInTheDocument()
    await user.click(timelineTab)

    // Verify the endpoint is called when the tab opens.
    await waitFor(() => expect(vi.mocked(api.get)).toHaveBeenCalledWith('/customers/cust-1/locations/loc-1/activity', expect.anything()))
  })
})

/** TAKEN-OP-LOCATIE-1 — the Taken sub-tab mounts the shared EntityTasksTab with
 *  this location's own token/id (TaskLinkResolver::MODELS['customer_location']). */
describe('LocationDetail · Taken sub-tab (TAKEN-OP-LOCATIE-1)', () => {
  it('wires linkType="customer_location" + this location\'s own id into EntityTasksTab', async () => {
    const user = userEvent.setup()
    render(<LocationDetail location={location()} onSave={vi.fn()} {...baseProps} />)
    await user.click(screen.getByRole('tab', { name: ct('drawer.tabs.tasks') }))
    expect(screen.getByTestId('entity-tasks')).toHaveTextContent('customer_location:loc-1')
  })
})

