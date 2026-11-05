/**
 * LocationDetail · title-row status badge (Danny 28-07: "Status van locatie moet
 * hier!!") — status moved OUT of the Algemeen field table into a read-only
 * TitleBadge next to the location name (§3A(c)), with its own pencil → picker →
 * save/cancel cycle so changing it is still possible. Assert the onSave PATCH
 * shape (§13), never only that a callback fired.
 *
 * EditableFieldTable pulls in `@/lib/datetime`, which side-effect-imports the
 * real i18n instance — so (like AddCustomerModal.test.tsx) this file resolves
 * assertions through the ACTIVE locale's own copy instead of guessing/hardcoding
 * a language.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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

describe('LocationDetail · title-row status badge', () => {
  it('renders the status as a read-only badge next to the name, not a field-table row', () => {
    render(<LocationDetail location={location()} onSave={vi.fn()} {...baseProps} />)
    // The badge shows the resolved label.
    expect(screen.getByText('Actief')).toBeInTheDocument()
    // The pencil to change it sits right there in the title row.
    expect(screen.getByRole('button', { name: ct('locations.detail.changeStatus') })).toBeInTheDocument()
  })

  it('renders no badge (but still an edit affordance) when the location carries no status yet', () => {
    render(<LocationDetail location={location({ statusId: null, status: '', statusLabel: '', statusColor: '' })} onSave={vi.fn()} {...baseProps} />)
    expect(screen.queryByText('Actief')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: ct('locations.detail.changeStatus') })).toBeInTheDocument()
  })

  it('pencil reveals a picker seeded with the current status; picking another value + save PATCHes statusId', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<LocationDetail location={location()} onSave={onSave} {...baseProps} />)

    await user.click(screen.getByRole('button', { name: ct('locations.detail.changeStatus') }))
    // Seeded with the current value — the trigger shows "Actief" (closed dropdown, one match).
    await user.click(screen.getByRole('button', { name: 'Actief' }))
    await user.click(screen.getByRole('button', { name: 'Inactief' }))
    await user.click(screen.getByRole('button', { name: cm('save') }))

    expect(onSave).toHaveBeenCalledWith('loc-1', { statusId: 'status-inactive' })
    // Back to read-only badge display — the local edit state must have closed.
    expect(screen.queryByRole('button', { name: cm('save') })).not.toBeInTheDocument()
  })

  it('cancel discards the draft without calling onSave', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<LocationDetail location={location()} onSave={onSave} {...baseProps} />)

    await user.click(screen.getByRole('button', { name: ct('locations.detail.changeStatus') }))
    await user.click(screen.getByRole('button', { name: cm('cancel') }))

    expect(onSave).not.toHaveBeenCalled()
    // The badge is back.
    expect(screen.getByText('Actief')).toBeInTheDocument()
  })

  it('the Algemeen field table no longer has its own status row (moved to the title)', () => {
    render(<LocationDetail location={location()} onSave={vi.fn()} {...baseProps} />)
    // Only ONE "Actief" on screen — the title badge — not a second one inside a field row.
    expect(screen.getAllByText('Actief')).toHaveLength(1)
  })
})

/**
 * KLANTLOCATIE-GEOCODE-1 (backend 2026-08-01) — until today the customer LOCATION was the
 * only geocodable record without a per-record re-geocode route, so its PDOK card could
 * only read. The route now exists and the card acts, mirroring the customer's own card.
 * Assert the REQUEST (§13): a card that renders a button which POSTs the wrong URL is a
 * 404 nobody sees, which is exactly the failure this test exists to catch.
 */
const openKoppelingen = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('tab', { name: cm('backofficeLinks.tabLabel') }))

describe('LocationDetail · geocode card in Koppelingen', () => {
  it('POSTs the per-location geocode route, addressed through its customer', async () => {
    const user = userEvent.setup()
    render(<LocationDetail location={location({ city: 'Gorinchem' })} onSave={vi.fn()} {...baseProps} />)
    await openKoppelingen(user)

    await user.click(screen.getByRole('button', { name: cm('geocode.refresh') }))
    expect(mockPost).toHaveBeenCalledTimes(1)
    expect(mockPost).toHaveBeenCalledWith('/customers/cust-1/locations/loc-1/geocode')
  })

  it('renders the coordinates it already has instead of "not geocoded"', async () => {
    const user = userEvent.setup()
    render(<LocationDetail location={location({ city: 'Gorinchem', lat: 51.8367, lng: 4.9705 })} onSave={vi.fn()} {...baseProps} />)
    await openKoppelingen(user)
    expect(screen.getByText('51.83670, 4.97050')).toBeInTheDocument()
    expect(screen.queryByText(cm('backofficeLinks.pdok.notGeocoded'))).not.toBeInTheDocument()
  })

  it('disables the trigger and fires nothing while the site has no address worth geocoding', async () => {
    const user = userEvent.setup()
    render(<LocationDetail location={location({ city: '' })} onSave={vi.fn()} {...baseProps} />)
    await openKoppelingen(user)

    const btn = screen.getByRole('button', { name: cm('geocode.refresh') })
    expect(btn).toBeDisabled()
    await user.click(btn)
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('stays honestly read-only (no trigger at all) when there is no customer to address the route through', async () => {
    const user = userEvent.setup()
    render(<LocationDetail location={location({ city: 'Gorinchem' })} onSave={vi.fn()} {...baseProps} customerId={undefined} />)
    await openKoppelingen(user)

    expect(screen.queryByRole('button', { name: cm('geocode.refresh') })).toBeNull()
    expect(screen.getByText(cm('backofficeLinks.geocode.readOnly'))).toBeInTheDocument()
  })

  it('never fires the geocode POST on mount — only on an explicit click', async () => {
    const user = userEvent.setup()
    render(<LocationDetail location={location({ city: 'Gorinchem' })} onSave={vi.fn()} {...baseProps} />)
    await openKoppelingen(user)
    expect(mockPost).not.toHaveBeenCalled()
  })
})

/**
 * LOCATIE-OMSCHRIJVING-1 (Danny 02-08: "bij locatie en afdeling moeten we ook een
 * beschrijving hebben") — the location never had a description surface at all
 * (unlike the department, which already had EditableRichTextField). Placed FIRST
 * on the Adres & gegevens sub-tab (identity-field-adjacent, not buried) — see the
 * component's own comment for why it sits ahead of the field tables rather than after.
 */
describe('LocationDetail · description (LOCATIE-OMSCHRIJVING-1)', () => {
  it('renders the stored description as sanitised HTML', () => {
    render(<LocationDetail location={location({ description: '<p>Grootste vestiging</p>' })} onSave={vi.fn()} {...baseProps} />)
    expect(screen.getByText('Grootste vestiging')).toBeInTheDocument()
  })

  it('shows the italic empty state when there is none yet', () => {
    render(<LocationDetail location={location({ description: '' })} onSave={vi.fn()} {...baseProps} />)
    expect(screen.getByText(ct('richText.empty'))).toBeInTheDocument()
  })

  it('pencil → edit → save PATCHes description only, through this location\'s own id', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<LocationDetail location={location({ description: '<p>Oud</p>' })} onSave={onSave} {...baseProps} />)

    // The description block's OWN pencil (Edit2, title="edit") now comes LAST in DOM
    // order — Danny 02-08 moved Omschrijving to mirror the Bedrijf tab's field-tables →
    // Contact → Omschrijving sequence, trailing the two field-table pencils (Gegevens/Adres)
    // instead of leading them (see the full-order test below).
    const pencils = screen.getAllByRole('button', { name: cm('edit') })
    await user.click(pencils[2])
    const rte = screen.getByTestId('rte')
    await user.clear(rte)
    await user.type(rte, '<p>Nieuw</p>')
    await user.click(screen.getByTitle(cm('save')))

    expect(onSave).toHaveBeenCalledWith('loc-1', { description: '<p>Nieuw</p>' })
  })
})
