/** LocationDetail · delete, archive, changelog and merge (split from LocationDetail.test.tsx; resolves copy through the active locale's own i18n). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
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

// CustomerApplicationsList (mounted, unstubbed, by that same sub-tab) reads the
// tenant funnel lookup via the global LookupsContext — mocked here the same way
// CustomerApplicationsList.test.tsx itself does, rather than mounting a real provider.
vi.mock('@/context/LookupsContext', () => ({
  useLookups: () => ({ funnelTypes: [{ value: 'applied', label: 'Aangemeld', color: 'var(--color-info)' }], funnelMeta: () => ({ label: '', color: 'var(--text-muted)' }) }),
}))

beforeEach(() => { vi.clearAllMocks(); mockPost.mockResolvedValue({ status: 202, data: {} }) })

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const ct = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'customers', ...opts })
const cm = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'common', ...opts })

// Every required prop the component reads — kept minimal, only onSave is asserted.
const baseProps = {
  customerId: 'cust-1', customerName: 'Zorggroep A', locations: [], departments: [], contacts: [],
  statuses, departmentStatuses: [] as LookupOption[], contactStatuses: [] as LookupOption[],
  onDelete: vi.fn(), onAddDepartment: vi.fn(), onUpdateDepartment: vi.fn(), onRemoveDepartment: vi.fn(),
  onAddContact: vi.fn(), onUpdateContact: vi.fn(), onRemoveContact: vi.fn(), close: vi.fn(),
}


/**
 * SUBENTITEIT-DELETE-1 — the honest disabled-trash (no fake affordance, §3) and
 * the shared counts dialog for a 409 RACE (the row's own `in_use` was stale).
 */
describe('LocationDetail · honest delete (SUBENTITEIT-DELETE-1)', () => {
  it('disables the trash and names the reason when the location is still in use', () => {
    render(<LocationDetail location={location({ inUse: true })} onSave={vi.fn()} {...baseProps} />)
    expect(screen.getByTitle(ct('locations.deleteInUse'))).toBeDisabled()
  })

  it('keeps the trash enabled with the normal label when nothing blocks it', () => {
    render(<LocationDetail location={location({ inUse: false })} onSave={vi.fn()} {...baseProps} />)
    expect(screen.getByTitle(ct('locations.detail.deleteLocation'))).not.toBeDisabled()
  })

  it('closes the panel on a real delete success', async () => {
    const user = userEvent.setup()
    const close = vi.fn()
    const onDelete = vi.fn().mockResolvedValue({ ok: true })
    render(<LocationDetail location={location()} onSave={vi.fn()} {...baseProps} onDelete={onDelete} close={close} />)

    await user.click(screen.getByTitle(ct('locations.detail.deleteLocation')))
    await user.click(screen.getByRole('button', { name: cm('confirm') }))
    expect(onDelete).toHaveBeenCalledWith('loc-1')
    await waitFor(() => expect(close).toHaveBeenCalled())
  })

  it('opens the shared counts dialog on a 409 race instead of closing', async () => {
    const user = userEvent.setup()
    const close = vi.fn()
    const onDelete = vi.fn().mockResolvedValue({ ok: false, blocked: { counts: { departments: 3, contacts: 1 } } })
    render(<LocationDetail location={location()} onSave={vi.fn()} {...baseProps} onDelete={onDelete} close={close} />)

    await user.click(screen.getByTitle(ct('locations.detail.deleteLocation')))
    await user.click(screen.getByRole('button', { name: cm('confirm') }))

    // Scoped to the dialog: "Afdelingen"/"Contactpersonen" also label other tabs
    // on this same panel, so an unscoped query would match more than once.
    const dialog = await screen.findByRole('dialog', { name: ct('inUse.title') })
    expect(within(dialog).getByText(ct('drawer.tabs.departments'))).toBeInTheDocument()
    expect(within(dialog).getByText('3')).toBeInTheDocument()
    expect(within(dialog).getByText(ct('drawer.tabs.contacts'))).toBeInTheDocument()
    expect(within(dialog).getByText('1')).toBeInTheDocument()
    expect(close).not.toHaveBeenCalled()

    await user.click(within(dialog).getAllByRole('button', { name: ct('inUse.close') }).at(-1)!)
    expect(screen.queryByRole('dialog', { name: ct('inUse.title') })).not.toBeInTheDocument()
  })

  /**
   * ARCHIVE-SUBENTITY-1: the dead end now has a way out — the 409-race dialog
   * offers "Archiveren" beside Close, and clicking it archives WITHOUT a second
   * confirm (the user already explicitly chose this path).
   */
  it('offers Archiveren inside the 409 dialog, and clicking it archives without a second confirm', async () => {
    const user = userEvent.setup()
    const close = vi.fn()
    const onDelete = vi.fn().mockResolvedValue({ ok: false, blocked: { counts: { departments: 1 } } })
    render(<LocationDetail location={location()} onSave={vi.fn()} {...baseProps} onDelete={onDelete} close={close} />)

    await user.click(screen.getByTitle(ct('locations.detail.deleteLocation')))
    await user.click(screen.getByRole('button', { name: cm('confirm') }))
    const dialog = await screen.findByRole('dialog', { name: ct('inUse.title') })

    await user.click(within(dialog).getByRole('button', { name: ct('inUse.archive') }))

    expect(mockPost).toHaveBeenCalledWith('/customers/cust-1/locations/loc-1/archive', undefined, expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) }))
    await waitFor(() => expect(close).toHaveBeenCalled())
  })
})

/**
 * ARCHIVE-SUBENTITY-1 — the reversible soft-delete pair, own action button
 * (beside the disabled/enabled trash) + the in-body ArchivedBanner + restore.
 * Assert the REQUEST (§13), never only that a callback fired.
 */
describe('LocationDetail · archive/restore (ARCHIVE-SUBENTITY-1)', () => {
  it('confirms, then POSTs the archive route and closes the panel on success', async () => {
    const user = userEvent.setup()
    const close = vi.fn()
    render(<LocationDetail location={location()} onSave={vi.fn()} {...baseProps} close={close} />)

    await user.click(screen.getByTitle(ct('locations.detail.archiveLocation')))
    await user.click(screen.getByRole('button', { name: cm('confirm') }))

    expect(mockPost).toHaveBeenCalledWith('/customers/cust-1/locations/loc-1/archive', undefined, expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) }))
    await waitFor(() => expect(close).toHaveBeenCalled())
  })

  it('renders no archive button once the location is already archived — the ArchivedBanner offers restore instead', () => {
    render(<LocationDetail location={location({ archived: true })} onSave={vi.fn()} {...baseProps} />)
    expect(screen.queryByTitle(ct('locations.detail.archiveLocation'))).toBeNull()
    expect(screen.getByText(ct('locations.archivedBanner.flag'))).toBeInTheDocument()
  })

  it('restore round-trip: the banner\'s restore button POSTs the restore route and closes the panel', async () => {
    const user = userEvent.setup()
    const close = vi.fn()
    render(<LocationDetail location={location({ archived: true })} onSave={vi.fn()} {...baseProps} close={close} />)

    await user.click(screen.getByRole('button', { name: ct('locations.archivedBanner.restore') }))

    expect(mockPost).toHaveBeenCalledWith('/customers/cust-1/locations/loc-1/restore', undefined, expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) }))
    await waitFor(() => expect(close).toHaveBeenCalled())
  })
})

/**
 * LOC-DEPT-CHANGELOG-1 — record history is an icon-popover in the title row
 * (§3A(d)), reusing the shared customer ChangelogTab content with its own
 * one-level-deeper endpoint. Proves the actual GET, not just that a popover opened.
 */
describe('LocationDetail · changelog (LOC-DEPT-CHANGELOG-1)', () => {
  it('fetches this location\'s own activity endpoint once the popover opens', async () => {
    const user = userEvent.setup()
    render(<LocationDetail location={location()} onSave={vi.fn()} {...baseProps} />)

    expect(vi.mocked(api.get).mock.calls.some(([url]) => url === '/customers/cust-1/locations/loc-1/activity')).toBe(false)
    await user.click(screen.getByRole('button', { name: cm('changelog') }))
    await waitFor(() => expect(vi.mocked(api.get)).toHaveBeenCalledWith('/customers/cust-1/locations/loc-1/activity', expect.anything()))
  })
})

/**
 * TIJDLIJN-SUBDRILL-1 — the timeline tab shows this location's own activity log
 * (LOC-DEPT-CHANGELOG-1). Proves the tab renders and GETs the correct endpoint.
 */

/**
 * LOCATIE-SAMENVOEGEN-1 — mirrors MergeContactModal's contract: the DUPLICATE
 * sits in the path, the SURVIVOR travels as `target_id` in the body. Proves the
 * request, the refetch dispatch and the survivor-switch callback.
 */
describe('LocationDetail · merge (LOCATIE-SAMENVOEGEN-1)', () => {
  const others = [{ id: 'loc-1', name: 'Hoofdlocatie' }, { id: 'loc-2', name: 'Filiaal Zuid' }]

  it('hides the merge icon with only one location at this customer', () => {
    render(<LocationDetail location={location()} onSave={vi.fn()} {...baseProps} locations={[{ id: 'loc-1', name: 'Hoofdlocatie' }]} />)
    expect(screen.queryByTitle(ct('locations.detail.mergeLocation'))).toBeNull()
  })

  it('posts target_id with the SURVIVOR and calls onMerged with it (keeping the open record)', async () => {
    const user = userEvent.setup()
    const onMerged = vi.fn()
    mockPost.mockResolvedValueOnce({ data: { data: {} } }) // the merge POST itself
    render(<LocationDetail location={location()} onSave={vi.fn()} {...baseProps} locations={others} onMerged={onMerged} />)

    await user.click(screen.getByTitle(ct('locations.detail.mergeLocation')))
    await user.type(screen.getByPlaceholderText(ct('locations.merge.searchPlaceholder')), 'Zuid')
    await user.click(screen.getByRole('button', { name: /Filiaal Zuid/ }))
    // Default survivor = the currently open record ('loc-1') — confirm the merge as-is.
    await user.click(screen.getByRole('button', { name: ct('locations.merge.confirm') }))

    expect(mockPost).toHaveBeenCalledWith('/customers/cust-1/locations/loc-2/merge', { target_id: 'loc-1' })
    await waitFor(() => expect(onMerged).toHaveBeenCalledWith('loc-1'))
  })
})
