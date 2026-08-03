/**
 * DepartmentDetail · house-style parity with LocationDetail (PARITY-DEPARTMENT-1,
 * Danny 2026-08-02: "Afdeling loopt achter — zorg ervoor dat de huisstijl klopt").
 * Guards the three things this pass fixed and that are easy to regress again:
 *
 *  1. The status badge is a colour-coded TitleBadge next to the name (JOB-STATUS-1,
 *     mirrors LocationDetail), not a select row buried in the field table.
 *  2. The reference-number chip (NUMMER-1) renders when the record has one, and
 *     stays silent when it doesn't (never an empty chip).
 *  3. Section order mirrors LocationDetail: Omschrijving → the titled field card →
 *     Koios advice.
 *
 * EditableFieldTable pulls in `@/lib/datetime`, which side-effect-imports the real
 * i18n instance — so (like LocationDetail.test.tsx) this file resolves assertions
 * through the ACTIVE locale's own copy instead of guessing/hardcoding a language.
 */
import type { ReactElement } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import DepartmentDetail from './DepartmentDetail'
import type { Department } from '@/types/customer'
import type { LookupOption } from '@/types/common'

// useCustomFields hits the API in an effect — stub it so the Extra sub-tab stays
// hidden (no custom fields defined) and no network call happens under test.
vi.mock('@/lib/useCustomFields', () => ({
  useCustomFields: () => ({ fields: [], allFields: [], loading: false, invalidate: () => {} }),
}))
vi.mock('@/lib/notify', () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }))
// SOLLICITATIES-SCOPE-1: DepartmentDetail now calls a REAL react-query hook
// (useScopedVacancyIds, step 1 of the Sollicitaties chain) — this file previously
// needed no api mock at all (every other query-touching child was stubbed).
// Default GET resolves empty for any URL not overridden per-test.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn().mockResolvedValue({ data: [] }), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }
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

beforeEach(() => { vi.clearAllMocks(); queryClient.clear() })

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const ct = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'customers', ...opts })
const cm = (key: string) => i18n.t(key, { ns: 'common' })

const department = (over: Partial<Department> = {}): Department => ({
  id: 'd1', helloflexLink: null, shiftmanagerLink: null,
  name: 'Zorg', description: '', locationId: 'loc-1', locationName: 'Vestiging Noord',
  contacts: [], costCenter: '', statusId: null, status: '', statusLabel: '', statusColor: '',
  customFields: {},
  ...over,
} as Department)

// Hex values here are DATA — fixture colours for a tenant lookup, not UI styling.
const statuses: LookupOption[] = [
  // eslint-disable-next-line no-restricted-syntax -- DATA fixture, mirrors a tenant lookup colour
  { value: 'status-active', label: 'Actief', color: '#22C55E', id: 'status-active' },
  // eslint-disable-next-line no-restricted-syntax -- DATA fixture, mirrors a tenant lookup colour
  { value: 'status-inactive', label: 'Inactief', color: '#9CA3AF', id: 'status-inactive' },
]

// Every required prop the component reads — kept minimal, only onSave is asserted.
const baseProps = {
  customerId: 'cust-1', customerName: 'Zorggroep A',
  locations: [{ id: 'loc-1', name: 'Vestiging Noord' }], departments: [], contacts: [],
  statuses, onAddContact: vi.fn(), onUpdateContact: vi.fn(), onRemoveContact: vi.fn(),
  onDelete: vi.fn(), close: vi.fn(),
}

// A department carrying the "active" status lookup above — reuses its colour so
// the hex literal lives in exactly one place (the `statuses` fixture).
const activeDepartment = (over: Partial<Department> = {}) =>
  department({ statusId: 'status-active', statusLabel: 'Actief', statusColor: statuses[0].color, ...over })

describe('DepartmentDetail · title-row status badge (JOB-STATUS-1)', () => {
  it('renders the status as a read-only badge next to the name, not a field-table row', () => {
    render(<DepartmentDetail department={activeDepartment()} onSave={vi.fn()} {...baseProps} />)
    expect(screen.getByText('Actief')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: ct('locations.detail.changeStatus') })).toBeInTheDocument()
    // Only ONE "Actief" on screen — the title badge — not a second one inside a field row.
    expect(screen.getAllByText('Actief')).toHaveLength(1)
  })

  it('colours the badge with the lookup\'s own colour, not a fixed brand colour', () => {
    render(<DepartmentDetail department={activeDepartment()} onSave={vi.fn()} {...baseProps} />)
    expect(screen.getByText('Actief')).toHaveStyle({ color: statuses[0].color })
  })

  it('renders no badge (but still an edit affordance) when the department carries no status yet', () => {
    render(<DepartmentDetail department={department()} onSave={vi.fn()} {...baseProps} />)
    expect(screen.queryByText('Actief')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: ct('locations.detail.changeStatus') })).toBeInTheDocument()
  })

  it('pencil reveals a picker seeded with the current status; picking another value + save PATCHes statusId', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<DepartmentDetail department={activeDepartment()} onSave={onSave} {...baseProps} />)

    await user.click(screen.getByRole('button', { name: ct('locations.detail.changeStatus') }))
    // Seeded with the current value — the trigger shows "Actief" (closed dropdown, one match).
    await user.click(screen.getByRole('button', { name: 'Actief' }))
    await user.click(screen.getByRole('button', { name: 'Inactief' }))
    await user.click(screen.getByRole('button', { name: cm('save') }))

    expect(onSave).toHaveBeenCalledWith('d1', { statusId: 'status-inactive' })
    // Back to read-only badge display — the local edit state must have closed.
    expect(screen.queryByRole('button', { name: cm('save') })).not.toBeInTheDocument()
  })

  it('cancel discards the draft without calling onSave', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<DepartmentDetail department={activeDepartment()} onSave={onSave} {...baseProps} />)

    await user.click(screen.getByRole('button', { name: ct('locations.detail.changeStatus') }))
    await user.click(screen.getByRole('button', { name: cm('cancel') }))

    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText('Actief')).toBeInTheDocument()
  })

  it('the field table no longer has its own status row (moved to the title)', () => {
    render(<DepartmentDetail department={activeDepartment()} onSave={vi.fn()} {...baseProps} />)
    // Only ONE "Actief" on screen — the title badge — not a second one inside a field row.
    expect(screen.getAllByText('Actief')).toHaveLength(1)
  })
})

describe('DepartmentDetail · reference-number chip (NUMMER-1)', () => {
  it('renders the reference number next to the name when the department has one', () => {
    render(<DepartmentDetail department={department({ referenceNumber: 'A-012' })} onSave={vi.fn()} {...baseProps} />)
    expect(screen.getByText('A-012')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: cm('referenceNumber.copy') })).toBeInTheDocument()
  })

  it('renders no chip when the department has no reference number yet', () => {
    render(<DepartmentDetail department={department({ referenceNumber: '' })} onSave={vi.fn()} {...baseProps} />)
    expect(screen.queryByText(/^[A-Z]-\d+$/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: cm('referenceNumber.copy') })).toBeNull()
  })
})

/**
 * PARITY-DEPARTMENT-1: pins the Bedrijf-tab section order (Danny 02-08: "bij locatie
 * en afdelingen moet de txt dezelfde volgorde hebben zoals tabje Bedrijf bij de
 * klant") — the field table first, then Omschrijving, then Koios advice.
 *
 * The field card is deliberately NOT given a title here (unlike LocationDetail's
 * group cards) — see DepartmentDetail.tsx's own comment: this sub-tab's label
 * already IS "Gegevens"/"Details" in three of five locales, so titling the card
 * would duplicate it and collide with DepartmentsPanel.test.tsx's getByText on
 * that same sub-tab label (a file out of scope for this change).
 */
describe('DepartmentDetail · section order mirrors the customer Bedrijf tab', () => {
  it('renders the field table first, then Omschrijving, then Koios advice', () => {
    render(<DepartmentDetail department={department()} onSave={vi.fn()} {...baseProps} />)
    const description = screen.getByText(ct('departments.detail.description'))
    // "Cost center" only ever renders inside the field table — a stable, unambiguous
    // marker for "the field card has rendered".
    const costCenterLabel = screen.getByText(ct('departments.detail.costCenter'))
    const koios = screen.getByText(ct('ai.title'))
    expect(costCenterLabel.compareDocumentPosition(description) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(description.compareDocumentPosition(koios) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('does not duplicate the sub-tab label onto the field card (verified collision, see file header)', () => {
    render(<DepartmentDetail department={department()} onSave={vi.fn()} {...baseProps} />)
    // Exactly ONE "Gegevens"/"Details" on screen — the sub-tab button — not a
    // second one from a card title that would repeat the same text.
    expect(screen.getAllByText(ct('overview.details'))).toHaveLength(1)
  })
})

/**
 * SCOPED-LIST-TAB-1 / TAKEN-OP-AFDELING-1 — the three new read-only sub-tabs
 * pass this department's own id + the right scope token through to the shared
 * children (stubbed above; their own fetch/columns are covered elsewhere).
 */
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

/**
 * SUBENTITEIT-DELETE-1 — the honest disabled-trash (no fake affordance, §3) and
 * the shared counts dialog for a 409 RACE (the row's own `in_use` was stale).
 */
describe('DepartmentDetail · honest delete (SUBENTITEIT-DELETE-1)', () => {
  it('disables the trash and names the reason when the department is still in use', () => {
    render(<DepartmentDetail department={department({ inUse: true })} onSave={vi.fn()} {...baseProps} />)
    const trash = screen.getByTitle(ct('departments.deleteInUse'))
    expect(trash).toBeDisabled()
  })

  it('keeps the trash enabled with the normal label when nothing blocks it', () => {
    render(<DepartmentDetail department={department({ inUse: false })} onSave={vi.fn()} {...baseProps} />)
    const trash = screen.getByTitle(cm('delete'))
    expect(trash).not.toBeDisabled()
  })

  it('closes the panel on a real delete success', async () => {
    const user = userEvent.setup()
    const close = vi.fn()
    const onDelete = vi.fn().mockResolvedValue({ ok: true })
    render(<DepartmentDetail department={department()} onSave={vi.fn()} {...baseProps} onDelete={onDelete} close={close} />)

    await user.click(screen.getByTitle(cm('delete')))
    await user.click(screen.getByRole('button', { name: cm('confirm') }))
    expect(onDelete).toHaveBeenCalledWith('d1')
    await waitFor(() => expect(close).toHaveBeenCalled())
  })

  it('opens the shared counts dialog on a 409 race instead of closing', async () => {
    const user = userEvent.setup()
    const close = vi.fn()
    const onDelete = vi.fn().mockResolvedValue({ ok: false, blocked: { counts: { vacancies: 2, tasks: 1 } } })
    render(<DepartmentDetail department={department()} onSave={vi.fn()} {...baseProps} onDelete={onDelete} close={close} />)

    await user.click(screen.getByTitle(cm('delete')))
    await user.click(screen.getByRole('button', { name: cm('confirm') }))

    // Scoped to the dialog: "Vacatures"/"Taken" also label the (unrelated) sub-tab
    // strip underneath, so an unscoped query would match twice.
    const dialog = await screen.findByRole('dialog', { name: ct('inUse.title') })
    expect(within(dialog).getByText(ct('drawer.tabs.vacancies'))).toBeInTheDocument()
    expect(within(dialog).getByText('2')).toBeInTheDocument()
    expect(within(dialog).getByText(ct('drawer.tabs.tasks'))).toBeInTheDocument()
    expect(within(dialog).getByText('1')).toBeInTheDocument()
    // The panel itself never closed — the delete did not actually go through.
    expect(close).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: ct('inUse.close') }))
    expect(screen.queryByRole('dialog', { name: ct('inUse.title') })).not.toBeInTheDocument()
  })
})
