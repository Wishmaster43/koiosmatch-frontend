/** DepartmentDetail · vacancies/matches/tasks/notes/documents/applications sub-tabs (split from DepartmentDetail.test.tsx; same mock header, own tests). */
import type { ReactElement } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import DepartmentDetail from './DepartmentDetail'
import type { Department } from '@/types/customer'
import { statuses } from './DepartmentDetail.testKit'

// useCustomFields hits the API in an effect — stub it so the Extra sub-tab stays
// hidden (no custom fields defined) and no network call happens under test.
vi.mock('@/lib/useCustomFields', () => ({
  useCustomFields: () => ({ fields: [], allFields: [], loading: false, invalidate: () => {} }),
}))
vi.mock('@/lib/notify', () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }))
// ARCHIVE-SUBENTITY-1/AFDELING-SAMENVOEGEN-1: both are gated on customers.update —
// granted here so the archive/merge tests (DepartmentDetail.actions / .misc) can reach the buttons.
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ hasPermission: () => true, hasModule: () => false }),
}))
// DD-FE-6 ("no empty tabs"): the Koppelingen sub-tab only lists when a connector
// app is enabled — default both off (matches the pre-existing no-provider
// behaviour every other test in this file already renders under).
const mockUseApps = vi.fn<() => { isAppEnabled: (id: string) => boolean }>()
vi.mock('@/context/AppsContext', () => ({ useApps: () => mockUseApps() }))
// SOLLICITATIES-SCOPE-1: DepartmentDetail now calls a REAL react-query hook
// (useScopedVacancyIds, step 1 of the Sollicitaties chain) — this file previously
// needed no api mock at all (every other query-touching child was stubbed).
// Default GET resolves empty for any URL not overridden per-test.
const mockPost = vi.fn().mockResolvedValue({ data: {} })
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn().mockResolvedValue({ data: [] }), post: (...args: unknown[]) => mockPost(...args), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }
})
// Tiptap needs a real browser to mount — stubbed with a plain controlled textarea,
// mirrors LocationDetail.test.tsx's own convention (RichTextEditor's own pencil/
// save/cancel dance is unit-tested on EditableRichTextField.test.tsx).
vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange }: { value?: string; onChange: (v: string) => void }) => (
    <textarea data-testid="rte" value={value ?? ''} onChange={e => onChange(e.target.value)} />
  ),
}))
// SCOPED-LIST-TAB-1/TAKEN-OP-AFDELING-1: the three new sub-tabs each own their own
// fetch (react-query/useMatchStatuses/useEntityTasks) — already covered by their
// own tests (ScopedListTab.test.tsx, useScopedEntityList.test.ts). Stubbed here so
// this file only proves DepartmentDetail's OWN wiring: the right scope/id reaches
// the right child when its sub-tab is picked.
vi.mock('./ScopedVacanciesTab', () => ({
  default: ({ scope, id, customerId, customerName, scopeName }: { scope: string; id?: string; customerId?: string; customerName?: string; scopeName?: string }) =>
    <div data-testid="scoped-vacancies">{scope}:{id}:{customerId}:{customerName}:{scopeName}</div>,
}))
vi.mock('./ScopedMatchesTab', () => ({
  default: ({ scope, id, customerId }: { scope: string; id?: string; customerId?: string }) =>
    <div data-testid="scoped-matches">{scope}:{id}:{customerId}</div>,
}))
vi.mock('@/components/drawer/tabs/EntityTasksTab', () => ({
  default: ({ linkType, id }: { linkType: string; id?: string }) => <div data-testid="entity-tasks">{linkType}:{id}</div>,
}))
// NOTES-LOC-DEPT-1/DOCS-LOC-DEPT-1: same stub convention as ScopedVacanciesTab/
// ScopedMatchesTab above — this file only proves DepartmentDetail's OWN wiring
// (right scope/id/customerId), not the shared tabs' own fetch (covered elsewhere).
vi.mock('./ScopedNotesTab', () => ({
  default: ({ scope, id, customerId }: { scope: string; id?: string; customerId?: string }) =>
    <div data-testid="scoped-notes">{scope}:{id}:{customerId}</div>,
}))
// K-288: linked-notes feed's own sub-tab — same stub convention as ScopedNotesTab
// above, this file only proves DepartmentDetail's OWN wiring (entity/id/sub).
vi.mock('@/components/drawer/tabs/notes/LinkedNotesTab', () => ({
  default: ({ entity, id, sub }: { entity: string; id?: string; sub?: { kind: string; id?: string } }) =>
    <div data-testid="linked-notes-tab">{entity}:{id}:{sub?.kind}:{sub?.id}</div>,
}))
vi.mock('./ScopedDocumentsTab', () => ({
  default: ({ scope, id, customerId }: { scope: string; id?: string; customerId?: string }) =>
    <div data-testid="scoped-documents">{scope}:{id}:{customerId}</div>,
}))

// SOLLICITATIES-SCOPE-1: opening the new Sollicitaties sub-tab mounts
// DepartmentSollicitatiesTab, which calls a REAL react-query hook
// (useScopedVacancyIds) — only THOSE tests need a QueryClient in context, so
// this wrapper is used just there (see that describe block below); every other
// test in this file still uses plain `render`, unaffected by this feature.
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
const renderDepartmentDetail = (ui: ReactElement) =>
  render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
// CustomerApplicationsList (mounted, unstubbed, by that same sub-tab) reads the
// tenant funnel lookup via the global LookupsContext — mocked here the same way
// CustomerApplicationsList.test.tsx itself does, rather than mounting a real provider.
vi.mock('@/context/LookupsContext', () => ({
  useLookups: () => ({ funnelTypes: [{ value: 'applied', label: 'Aangemeld', color: 'var(--color-info)' }], funnelMeta: () => ({ label: '', color: 'var(--text-muted)' }) }),
}))

beforeEach(() => { vi.clearAllMocks(); mockPost.mockResolvedValue({ data: {} }); queryClient.clear(); mockUseApps.mockReturnValue({ isAppEnabled: () => false }) })

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const ct = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'customers', ...opts })

const department = (over: Partial<Department> = {}): Department => ({
  id: 'd1', helloflexLink: null, shiftmanagerLink: null,
  name: 'Zorg', description: '', locationId: 'loc-1', locationName: 'Vestiging Noord',
  contacts: [], costCenter: '', billingEmail: '', statusId: null, status: '', statusLabel: '', statusColor: '',
  customFields: {},
  ...over,
} as Department)

// Every required prop the component reads — kept minimal, only onSave is asserted.
const baseProps = {
  customerId: 'cust-1', customerName: 'Zorggroep A',
  locations: [{ id: 'loc-1', name: 'Vestiging Noord' }], departments: [], contacts: [],
  statuses, onAddContact: vi.fn(), onUpdateContact: vi.fn(), onRemoveContact: vi.fn(),
  onDelete: vi.fn(), close: vi.fn(),
}

describe('DepartmentDetail · Vacatures/Matches/Taken sub-tabs', () => {
  it('wires the department scope + id into ScopedVacanciesTab', async () => {
    const user = userEvent.setup()
    render(<DepartmentDetail department={department()} onSave={vi.fn()} {...baseProps} />)
    await user.click(screen.getByRole('tab', { name: ct('drawer.tabs.vacancies') }))
    expect(screen.getByTestId('scoped-vacancies')).toHaveTextContent('department:d1')
  })

  // Point 1 (Danny's ten-point round): "+ Vacature" needs the customer LOCK +
  // this department's own name (ScopedVacanciesTab's AddVacancyModal has no
  // cascade picker of its own — see that file's docblock).
  it('also threads customerId/customerName/scopeName into ScopedVacanciesTab (point 1)', async () => {
    const user = userEvent.setup()
    render(<DepartmentDetail department={department()} onSave={vi.fn()} {...baseProps} />)
    await user.click(screen.getByRole('tab', { name: ct('drawer.tabs.vacancies') }))
    expect(screen.getByTestId('scoped-vacancies')).toHaveTextContent('department:d1:cust-1:Zorggroep A:Zorg')
  })

  it('wires the department scope + id into ScopedMatchesTab', async () => {
    const user = userEvent.setup()
    render(<DepartmentDetail department={department()} onSave={vi.fn()} {...baseProps} />)
    await user.click(screen.getByRole('tab', { name: ct('drawer.tabs.matches') }))
    expect(screen.getByTestId('scoped-matches')).toHaveTextContent('department:d1')
  })

  // Point 1: "+ Match" needs the customer id to prefill MatchModal's cascade.
  it('also threads customerId into ScopedMatchesTab (point 1)', async () => {
    const user = userEvent.setup()
    render(<DepartmentDetail department={department()} onSave={vi.fn()} {...baseProps} />)
    await user.click(screen.getByRole('tab', { name: ct('drawer.tabs.matches') }))
    expect(screen.getByTestId('scoped-matches')).toHaveTextContent('department:d1:cust-1')
  })

  it('wires linkType="department" + this department\'s id into EntityTasksTab', async () => {
    const user = userEvent.setup()
    render(<DepartmentDetail department={department()} onSave={vi.fn()} {...baseProps} />)
    await user.click(screen.getByRole('tab', { name: ct('drawer.tabs.tasks') }))
    expect(screen.getByTestId('entity-tasks')).toHaveTextContent('department:d1')
  })
})

/**
 * NOTES-LOC-DEPT-1/DOCS-LOC-DEPT-1 — this department's own Notities/Documenten
 * sub-tabs, right after Sollicitaties, wired with the "department" scope + this
 * department's own id + the customer id (stubbed above).
 */
describe('DepartmentDetail · Notities/Documenten sub-tabs (NOTES-LOC-DEPT-1/DOCS-LOC-DEPT-1)', () => {
  it('wires the department scope + id into ScopedNotesTab', async () => {
    const user = userEvent.setup()
    render(<DepartmentDetail department={department()} onSave={vi.fn()} {...baseProps} />)
    await user.click(screen.getByRole('tab', { name: ct('drawer.tabs.notes') }))
    expect(screen.getByTestId('scoped-notes')).toHaveTextContent('department:d1:cust-1')
  })

  it('wires the department scope + id into ScopedDocumentsTab', async () => {
    const user = userEvent.setup()
    render(<DepartmentDetail department={department()} onSave={vi.fn()} {...baseProps} />)
    await user.click(screen.getByRole('tab', { name: ct('drawer.tabs.documents') }))
    expect(screen.getByTestId('scoped-documents')).toHaveTextContent('department:d1:cust-1')
  })
})

/** K-288: the linked-notes feed (NOTITIE-DOORLINK-1) moved out of ScopedNotesTab
 *  into its own sub-tab, right after Notities — wired with the customer id +
 *  the "departments" sub kind + this department's own id. */
describe('DepartmentDetail · linkedNotes sub-tab (K-288)', () => {
  it('wires entity/id/sub into LinkedNotesTab', async () => {
    const user = userEvent.setup()
    render(<DepartmentDetail department={department()} onSave={vi.fn()} {...baseProps} />)
    await user.click(screen.getByRole('tab', { name: ct('notes.linkedNotes') }))
    expect(screen.getByTestId('linked-notes-tab')).toHaveTextContent('customers:cust-1:departments:d1')
  })
})

/**
 * SOLLICITATIES-SCOPE-1 (Danny asked 3x at customer level, then again for
 * location/department) — the real two-step chain, unlike Vacatures/Matches/
 * Taken above (which stub the whole sub-component): CustomerApplicationsList
 * is NOT stubbed here, so this proves the actual honest data path end to end —
 * useScopedVacancyIds (step 1) resolves this department's own vacancies, THEN
 * useApplicationsByVacancyIds (step 2) filters by exactly those ids.
 */
describe('DepartmentDetail · Sollicitaties sub-tab (SOLLICITATIES-SCOPE-1)', () => {
  it('is lazy: no /vacancies or /applications request fires before the sub-tab is opened', () => {
    // Plain `render` here (not `renderDepartmentDetail`) is a deliberate part of
    // the proof: DepartmentSollicitatiesTab (and its react-query hook) never
    // mounts unless this sub-tab opens, so no QueryClientProvider is even needed yet.
    render(<DepartmentDetail department={department()} onSave={vi.fn()} {...baseProps} />)
    const calls = vi.mocked(api.get).mock.calls.map(([url]) => url)
    expect(calls).not.toContain('/vacancies')
    expect(calls).not.toContain('/applications')
  })

  it('opening it resolves this department\'s own vacancies, then filters applications by EXACTLY those vacancy ids', async () => {
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
    // Opening this sub-tab mounts DepartmentSollicitatiesTab's real react-query
    // hook, so THIS test (only) needs the QueryClientProvider-wrapped render.
    renderDepartmentDetail(<DepartmentDetail department={department()} onSave={vi.fn()} {...baseProps} />)

    await user.click(screen.getByRole('tab', { name: i18n.t('applications:title') }))
    // The real row rendering proves the WHOLE chain resolved, not just a callback.
    expect(await screen.findByText('Jane Doe')).toBeInTheDocument()

    const applicationsCall = vi.mocked(api.get).mock.calls.find(([url]) => url === '/applications')
    expect(applicationsCall?.[1]?.params).toMatchObject({ vacancy_id: ['vac-1', 'vac-2'] })
  })

  it('zero vacancies at this department: the empty state renders and /applications is never called', async () => {
    const user = userEvent.setup()
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/vacancies') return Promise.resolve({ data: { data: [] } })
      return Promise.resolve({ data: [] })
    })
    renderDepartmentDetail(<DepartmentDetail department={department()} onSave={vi.fn()} {...baseProps} />)

    await user.click(screen.getByRole('tab', { name: i18n.t('applications:title') }))
    expect(await screen.findByText(i18n.t('applications:empty'))).toBeInTheDocument()
    expect(vi.mocked(api.get).mock.calls.some(([url]) => url === '/applications')).toBe(false)
  })

  // Restore the file's own default GET response — the two tests above override
  // it per-URL, and vi.clearAllMocks() (the global beforeEach) clears CALLS but
  // not a mocked implementation.
  afterEach(() => { vi.mocked(api.get).mockResolvedValue({ data: [] }) })
})
