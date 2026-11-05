/** DepartmentDetail · merge, primary contact, integrations and billing email (split from DepartmentDetail.test.tsx; same mock header, own tests). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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

describe('DepartmentDetail · merge (AFDELING-SAMENVOEGEN-1)', () => {
  const others: Department[] = [department(), department({ id: 'd2', name: 'Dagbesteding' })]

  it('hides the merge icon with only one department at this customer', () => {
    render(<DepartmentDetail department={department()} onSave={vi.fn()} {...baseProps} departments={[department()]} />)
    expect(screen.queryByTitle(ct('departments.detail.mergeDepartment'))).toBeNull()
  })

  it('posts target_id with the SURVIVOR and calls onMerged with it (keeping the open record)', async () => {
    const user = userEvent.setup()
    const onMerged = vi.fn()
    render(<DepartmentDetail department={department()} onSave={vi.fn()} {...baseProps} departments={others} onMerged={onMerged} />)

    await user.click(screen.getByTitle(ct('departments.detail.mergeDepartment')))
    await user.type(screen.getByPlaceholderText(ct('departments.merge.searchPlaceholder')), 'Dagbesteding')
    await user.click(screen.getByRole('button', { name: /Dagbesteding/ }))
    // Default survivor = the currently open record ('d1') — confirm the merge as-is.
    await user.click(screen.getByRole('button', { name: ct('departments.merge.confirm') }))

    expect(mockPost).toHaveBeenCalledWith('/customers/cust-1/departments/d2/merge', { target_id: 'd1' })
    await waitFor(() => expect(onMerged).toHaveBeenCalledWith('d1'))
  })
})

/**
 * CONTACT-DEPARTMENT-PRIMARY-1 — the department half of the primary-contact flow (the
 * location half already works via ContactsPanel/ContactsPanelColumns). Verifies
 * DepartmentDetail actually renders the real ContactsPanel in `scope="department"` on
 * its Contacts sub-tab, so the "make primary here" star shows and PUTs the verified
 * route (routes/api/tenant/customers.php:181, CustomerContactController::primaryDepartment
 * — the exact mirror of the location route this component already exercised at :178).
 */
describe('DepartmentDetail · Contacts sub-tab renders the department-scoped primary control (CONTACT-DEPARTMENT-PRIMARY-1)', () => {
  // A contact linked to this department, carrying the shape useCustomerContacts'
  // mapContactRow produces (locations/departments arrays; the id passthrough is what
  // ContactsPanel's `inScope` and the star column key off).
  const deptContact = {
    id: 'c1', helloflexLink: null, shiftmanagerLink: null,
    firstName: 'Eva', middleName: '', lastName: 'Bos', name: 'Eva Bos', role: 'HR Manager',
    email: 'eva@klant.test', phone: '', mobile: '', isPrimary: false,
    locationId: null, locationName: '', departmentId: 'd1', departmentName: 'Zorg',
    locations: [], departments: [{ id: 'd1', name: 'Zorg' }], statusId: null, status: '', statusLabel: '', statusColor: '',
    customerId: 'cust-1', gender: '',
    lastContactAt: null, lastContactType: null, customFields: {},
  }

  it('shows the "Contacts" sub-tab with the primary-here star for a contact in this department', async () => {
    const user = userEvent.setup()
    render(<DepartmentDetail department={department()} onSave={vi.fn()} {...baseProps} contacts={[deptContact] as never} />)

    await user.click(screen.getByRole('tab', { name: ct('drawer.tabs.contacts') }))

    expect(screen.getByText('Eva Bos')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: ct('departments.detail.setPrimaryContact') })).toBeInTheDocument()
  })

  it('PUTs the measured per-department route when the star is clicked', async () => {
    const user = userEvent.setup()
    vi.mocked(api.put).mockResolvedValue({ data: { id: 'c1', departments: [{ id: 'd1', name: 'Zorg', is_primary: true }] } })
    render(<DepartmentDetail department={department()} onSave={vi.fn()} {...baseProps} contacts={[deptContact] as never} />)

    await user.click(screen.getByRole('tab', { name: ct('drawer.tabs.contacts') }))
    await user.click(screen.getByRole('button', { name: ct('departments.detail.setPrimaryContact') }))

    expect(api.put).toHaveBeenCalledTimes(1)
    expect(api.put).toHaveBeenCalledWith('/customers/cust-1/contacts/c1/departments/d1/primary')
  })

  it('marks the department primary and offers no un-set once the flag is set', async () => {
    const user = userEvent.setup()
    render(<DepartmentDetail department={department()} onSave={vi.fn()} {...baseProps}
      contacts={[{ ...deptContact, primaryDepartmentIds: ['d1'] }] as never} />)

    await user.click(screen.getByRole('tab', { name: ct('drawer.tabs.contacts') }))

    expect(screen.getByLabelText(ct('departments.detail.isPrimaryContact'))).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: ct('departments.detail.setPrimaryContact') })).toBeNull()
  })
})

/**
 * DD-FE-6 ("no empty tabs" — 08-08): this file passes no extra children into
 * the shared BackofficeLinksTab, so with both connector apps off its body
 * would render nothing (no card, no "Koppelen" button) — the sub-tab must not
 * even be listed. useBackofficeLinksVisible drives the gate.
 */
describe('DepartmentDetail · Koppelingen sub-tab hidden when empty (DD-FE-6)', () => {
  it('drops the Koppelingen sub-tab when no connector app is enabled', () => {
    render(<DepartmentDetail department={department()} onSave={vi.fn()} {...baseProps} />)
    expect(screen.queryByRole('tab', { name: cm('backofficeLinks.tabLabel') })).not.toBeInTheDocument()
  })

  it('lists Koppelingen once a connector app (Shiftmanager) is enabled', () => {
    mockUseApps.mockReturnValue({ isAppEnabled: (id: string) => id === 'shiftmanager' })
    render(<DepartmentDetail department={department()} onSave={vi.fn()} {...baseProps} />)
    expect(screen.getByRole('tab', { name: cm('backofficeLinks.tabLabel') })).toBeInTheDocument()
  })
})

// K-249 C.4 (31-08): billingEmail joins costCenter as the middle cascade level's
// own editable fields — the match billing resolver (department → location →
// customer) reads a department's own billing_email too.
describe('DepartmentDetail · billing email field (K-249 C.4)', () => {
  it('renders a billingEmail field row in the field table', () => {
    render(<DepartmentDetail department={department()} onSave={vi.fn()} {...baseProps} />)
    expect(screen.getByText(ct('departments.detail.billingEmail'))).toBeInTheDocument()
  })

  it('edits and saves billingEmail through the same PATCH onSave as costCenter/name', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<DepartmentDetail department={department()} onSave={onSave} {...baseProps} />)
    // The field-table card's own pencil renders FIRST (DepartmentDataTab: field
    // table, THEN description, THEN Koios advice — K5a, 02-08).
    const editButtons = screen.getAllByTitle(cm('edit'))
    await user.click(editButtons[0])
    // Locate the input via its own label sibling — EditableFieldTable rows have
    // no real <label>/htmlFor, mirrors OverviewTab.test.tsx's own convention.
    const label = screen.getByText(ct('departments.detail.billingEmail'))
    const input = label.nextElementSibling?.querySelector('input') as HTMLInputElement
    expect(input).toBeTruthy()
    await user.type(input, 'facturen@zorg.nl')
    await user.click(screen.getByTitle(cm('save')))
    expect(onSave).toHaveBeenCalledWith('d1', expect.objectContaining({ billingEmail: 'facturen@zorg.nl' }))
  })
})
