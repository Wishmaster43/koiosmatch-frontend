/** LocationDetail · field sections, pager, Vestiging and branch (split from LocationDetail.test.tsx; resolves copy through the active locale's own i18n). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
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
 * LOCATIE-SECTIE-VOLGORDE-1 (Danny 02-08, same day as KOIOS-ADVICE-POSITION-1, then
 * overruled again). The customer's own Bedrijf tab (OverviewTab.tsx) renders, top to
 * bottom: field tables (Gegevens → Adres) → Contact → Bedrijfstekst → Koios advice →
 * Vestiging — OverviewTab.tsx:162 puts its description directly under Contact. The
 * location used to put Omschrijving FIRST (ahead of the field tables); Danny overruled
 * that placement the same day, so this pins the WHOLE sequence, not just Koios-vs-
 * Vestiging, so a future drift on any one block fails here.
 */
describe('LocationDetail · Adres & gegevens section order (mirrors the Bedrijf tab)', () => {
  it('renders field tables → Contact → Omschrijving → Koios advice → Vestiging, in that order', () => {
    render(<LocationDetail location={location()} onSave={vi.fn()} {...baseProps} />)

    const gegevens = screen.getByText(ct('overview.details'))
    // "Adres" legitimately appears twice: the field table's own title, THEN (further
    // down, still inside that same table) the address composite row's label, which
    // reuses the exact same translation key. The table's title always renders first.
    const adres = screen.getAllByText(ct('subModal.groups.address'))[0]
    const contact = screen.getByText(ct('locations.detail.contactTitle'))
    const omschrijving = screen.getByText(ct('locations.detail.description'))
    const koios = screen.getByText(ct('ai.title'))
    // K-283 added a SECOND "Vestiging" label right after this one (the location's own
    // single-branch field, LocationBranchField) — same translated word, different
    // field/concept (see that test's own describe block). The multi-branch section
    // title below is still the first of the two in DOM order.
    const branchSection = screen.getAllByText(ct('locations.detail.branchTitle'))[0]

    // DOCUMENT_POSITION_FOLLOWING on `b` relative to `a` means `a` sits first in DOM order.
    const isBefore = (a: HTMLElement, b: HTMLElement) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

    expect(isBefore(gegevens, adres)).toBe(true)
    expect(isBefore(adres, contact)).toBe(true)
    expect(isBefore(contact, omschrijving)).toBe(true)
    expect(isBefore(omschrijving, koios)).toBe(true)
    expect(isBefore(koios, branchSection)).toBe(true)
  })
})

/**
 * DRILL-PAGER-1 (Danny 02-08) — LocationDetail only RENDERS the pager the caller
 * (LocationsTab) hands it; the caller-side scoping/navigation is covered in
 * LocationsTab.test.tsx. This proves the wiring: no `pager` prop → no pager on
 * screen (today's behaviour, unaffected); a `pager` prop renders it in the title
 * row, before the delete button, and its buttons call exactly what was passed in.
 */
describe('LocationDetail · pager wiring', () => {
  it('renders no pager when the caller passes none', () => {
    render(<LocationDetail location={location()} onSave={vi.fn()} {...baseProps} />)
    expect(screen.queryByLabelText(cm('drillPager.next'))).toBeNull()
  })

  it('renders the pager before the delete button, wired to the caller\'s own handlers', async () => {
    const user = userEvent.setup()
    const onPrev = vi.fn()
    const onNext = vi.fn()
    render(<LocationDetail location={location()} onSave={vi.fn()} {...baseProps}
      pager={{ index: 2, total: 4, onPrev, onNext }} />)

    expect(screen.getByTitle(cm('drillPager.nextAt', { index: 2, total: 4 }))).toBeInTheDocument()
    // The delete button carries only a `title`, no aria-label — matched the same way
    // the save/cancel buttons elsewhere in this file already are (getByTitle).
    const deleteBtn = screen.getByTitle(ct('locations.detail.deleteLocation'))
    const nextBtn = screen.getByRole('button', { name: cm('drillPager.next') })
    // The pager sits BEFORE the delete button in the same title-row corner.
    expect(nextBtn.compareDocumentPosition(deleteBtn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    await user.click(nextBtn)
    expect(onNext).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: cm('drillPager.prev') }))
    expect(onPrev).toHaveBeenCalledTimes(1)
  })
})

/** VESTIGING-HINT-1 (Danny: "Weg die txt toch?") — the inherited/deviate explainer
 *  paragraph under Vestiging was noise Danny asked removed; the state badge (Volgt de
 *  klant / Afwijkend ingesteld) already says the same thing in three words. */
describe('LocationDetail · Vestiging helper text removed', () => {
  it('no longer renders the inherited/deviate explainer paragraph under Vestiging', () => {
    render(<LocationDetail location={location()} onSave={vi.fn()} {...baseProps} />)
    expect(screen.queryByText(ct('locations.detail.branchHint'))).not.toBeInTheDocument()
  })
})

/**
 * K-283 — this location's OWN single branch (branchId/branch), a DIFFERENT field
 * than the multi-branch LocationBranchSection above (LOCATIE-VESTIGING-1's
 * visibility set). Immediate onChange PATCH, local optimistic value reverted on
 * failure, and an inline notice specifically for the 403 (missing grant on the
 * old/new branch) the backend contract calls out.
 */
describe('LocationDetail · own branch field (K-283)', () => {
  it('renders the current branch name in the picker trigger', () => {
    render(<LocationDetail location={location({ branchId: 'br-1', branch: { id: 'br-1', name: 'Vestiging Noord' } })}
      onSave={vi.fn()} {...baseProps} />)
    expect(screen.getByRole('button', { name: /Vestiging Noord/ })).toBeInTheDocument()
  })

  it('shows the placeholder when the location has no branch of its own yet', () => {
    render(<LocationDetail location={location({ branchId: null, branch: null })} onSave={vi.fn()} {...baseProps} />)
    expect(screen.getByRole('button', { name: new RegExp(ct('location.noBranch')) })).toBeInTheDocument()
  })

  it('picking another branch calls onSave with the new branchId, through this location\'s own id', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<LocationDetail location={location({ branchId: 'br-1', branch: { id: 'br-1', name: 'Vestiging Noord' } })}
      onSave={onSave} {...baseProps} />)

    await user.click(screen.getByRole('button', { name: /Vestiging Noord/ }))
    await user.click(screen.getByRole('button', { name: 'Vestiging Zuid' }))

    expect(onSave).toHaveBeenCalledWith('loc-1', { branchId: 'br-2' })
  })

  it('clearing sends branchId null', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<LocationDetail location={location({ branchId: 'br-1', branch: { id: 'br-1', name: 'Vestiging Noord' } })}
      onSave={onSave} {...baseProps} />)

    // The clear affordance's accessible name is composed via common:clearField (VAC-CLEAR-1).
    await user.click(screen.getByRole('button', { name: cm('clearField', { field: ct('location.branch') }) }))

    expect(onSave).toHaveBeenCalledWith('loc-1', { branchId: null })
  })

  it('a 403 (missing grant on the old/new branch) reverts the optimistic pick and shows the server message', async () => {
    const user = userEvent.setup()
    const err = { response: { status: 403, data: { message: 'Je hebt geen rechten op deze vestiging.' } } }
    const onSave = vi.fn().mockResolvedValue({ ok: false, status: 403, error: err })
    render(<LocationDetail location={location({ branchId: 'br-1', branch: { id: 'br-1', name: 'Vestiging Noord' } })}
      onSave={onSave} {...baseProps} />)

    await user.click(screen.getByRole('button', { name: /Vestiging Noord/ }))
    await user.click(screen.getByRole('button', { name: 'Vestiging Zuid' }))

    expect(onSave).toHaveBeenCalledWith('loc-1', { branchId: 'br-2' })
    // Reverted: the trigger shows the OLD branch again, and the server's own message renders.
    await waitFor(() => expect(screen.getByRole('button', { name: /Vestiging Noord/ })).toBeInTheDocument())
    expect(screen.getByText('Je hebt geen rechten op deze vestiging.')).toBeInTheDocument()
  })

  it('a non-403 failure reverts silently (the hook\'s own generic toast already covers it) — no notice', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue({ ok: false, status: 500, error: { response: { status: 500 } } })
    render(<LocationDetail location={location({ branchId: 'br-1', branch: { id: 'br-1', name: 'Vestiging Noord' } })}
      onSave={onSave} {...baseProps} />)

    await user.click(screen.getByRole('button', { name: /Vestiging Noord/ }))
    await user.click(screen.getByRole('button', { name: 'Vestiging Zuid' }))

    await waitFor(() => expect(screen.getByRole('button', { name: /Vestiging Noord/ })).toBeInTheDocument())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
