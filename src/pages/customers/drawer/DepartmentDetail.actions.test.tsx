/** DepartmentDetail · delete, archive, changelog and timeline (split from DepartmentDetail.test.tsx; same mock header, own tests). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
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

// The funnel lookup the Sollicitaties tests need (see DepartmentDetail.subtabs.test.tsx) —
// mocked identically in every split file so all render under the same lookups.
vi.mock('@/context/LookupsContext', () => ({
  useLookups: () => ({ funnelTypes: [{ value: 'applied', label: 'Aangemeld', color: 'var(--color-info)' }], funnelMeta: () => ({ label: '', color: 'var(--text-muted)' }) }),
}))

beforeEach(() => { vi.clearAllMocks(); mockPost.mockResolvedValue({ data: {} }); mockUseApps.mockReturnValue({ isAppEnabled: () => false }) })

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const ct = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'customers', ...opts })
const cm = (key: string) => i18n.t(key, { ns: 'common' })

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

    await user.click(within(dialog).getAllByRole('button', { name: ct('inUse.close') }).at(-1)!)
    expect(screen.queryByRole('dialog', { name: ct('inUse.title') })).not.toBeInTheDocument()
  })

  /**
   * ARCHIVE-SUBENTITY-1: the dead end now has a way out — the 409-race dialog
   * offers "Archiveren" beside Close, no second confirm.
   */
  it('offers Archiveren inside the 409 dialog, and clicking it archives without a second confirm', async () => {
    const user = userEvent.setup()
    const close = vi.fn()
    const onDelete = vi.fn().mockResolvedValue({ ok: false, blocked: { counts: { contacts: 1 } } })
    render(<DepartmentDetail department={department()} onSave={vi.fn()} {...baseProps} onDelete={onDelete} close={close} />)

    await user.click(screen.getByTitle(cm('delete')))
    await user.click(screen.getByRole('button', { name: cm('confirm') }))
    const dialog = await screen.findByRole('dialog', { name: ct('inUse.title') })

    await user.click(within(dialog).getByRole('button', { name: ct('inUse.archive') }))

    expect(mockPost).toHaveBeenCalledWith('/customers/cust-1/departments/d1/archive', undefined, expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) }))
    await waitFor(() => expect(close).toHaveBeenCalled())
  })
})

/**
 * ARCHIVE-SUBENTITY-1 — mirrors LocationDetail's identical wiring: own action
 * button + the in-body ArchivedBanner + restore. Assert the REQUEST (§13).
 */
describe('DepartmentDetail · archive/restore (ARCHIVE-SUBENTITY-1)', () => {
  it('confirms, then POSTs the archive route and closes the panel on success', async () => {
    const user = userEvent.setup()
    const close = vi.fn()
    render(<DepartmentDetail department={department()} onSave={vi.fn()} {...baseProps} close={close} />)

    await user.click(screen.getByTitle(ct('departments.detail.archiveDepartment')))
    await user.click(screen.getByRole('button', { name: cm('confirm') }))

    expect(mockPost).toHaveBeenCalledWith('/customers/cust-1/departments/d1/archive', undefined, expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) }))
    await waitFor(() => expect(close).toHaveBeenCalled())
  })

  it('renders no archive button once the department is already archived — the ArchivedBanner offers restore instead', () => {
    render(<DepartmentDetail department={department({ archived: true })} onSave={vi.fn()} {...baseProps} />)
    expect(screen.queryByTitle(ct('departments.detail.archiveDepartment'))).toBeNull()
    expect(screen.getByText(ct('departments.archivedBanner.flag'))).toBeInTheDocument()
  })

  it('restore round-trip: the banner\'s restore button POSTs the restore route and closes the panel', async () => {
    const user = userEvent.setup()
    const close = vi.fn()
    render(<DepartmentDetail department={department({ archived: true })} onSave={vi.fn()} {...baseProps} close={close} />)

    await user.click(screen.getByRole('button', { name: ct('departments.archivedBanner.restore') }))

    expect(mockPost).toHaveBeenCalledWith('/customers/cust-1/departments/d1/restore', undefined, expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) }))
    await waitFor(() => expect(close).toHaveBeenCalled())
  })
})

/** LOC-DEPT-CHANGELOG-1 — mirrors LocationDetail: proves the actual GET. */
describe('DepartmentDetail · changelog (LOC-DEPT-CHANGELOG-1)', () => {
  it('fetches this department\'s own activity endpoint once the popover opens', async () => {
    const user = userEvent.setup()
    render(<DepartmentDetail department={department()} onSave={vi.fn()} {...baseProps} />)

    await user.click(screen.getByRole('button', { name: cm('changelog') }))
    await waitFor(() => expect(vi.mocked(api.get)).toHaveBeenCalledWith('/customers/cust-1/departments/d1/activity', expect.anything()))
  })
})

/**
 * TIJDLIJN-SUBDRILL-1 — the timeline tab shows this department's own activity log
 * (LOC-DEPT-CHANGELOG-1). Proves the tab renders and GETs the correct endpoint.
 */
describe('DepartmentDetail · timeline tab (TIJDLIJN-SUBDRILL-1)', () => {
  it('renders the timeline tab and opens it via the sub-tab bar', async () => {
    const user = userEvent.setup()
    render(<DepartmentDetail department={department()} onSave={vi.fn()} {...baseProps} />)

    // Find and click the timeline tab.
    const timelineTab = screen.getByRole('tab', { name: ct('drawer.tabs.timeline') })
    expect(timelineTab).toBeInTheDocument()
    await user.click(timelineTab)

    // Verify the endpoint is called when the tab opens.
    await waitFor(() => expect(vi.mocked(api.get)).toHaveBeenCalledWith('/customers/cust-1/departments/d1/activity', expect.anything()))
  })
})
