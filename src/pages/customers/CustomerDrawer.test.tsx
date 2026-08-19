/**
 * CustomerDrawer — KLANT-FASE-1 header lifecycle phase.
 *
 * "Done = clicked" (§13): the header shows the TENANT's phase label as a
 * read-only badge (never a picker, §3A(c) — mirrors the candidate drawer's
 * CandidateTitle) and, while the customer sits in the entry phase, a single
 * "convert" button that hands the isCustomer-flagged phase SLUG to onUpdate —
 * which useCustomerRecord then maps onto PATCH /customers/{id} (covered by its
 * own request-level test). The tab bodies are stubbed; this file is about the
 * header, not the tabs.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import CustomerDrawer from './CustomerDrawer'
import type { Customer } from '@/types/customer'

// DELETE-ICON-1: api.delete is the trash icon's real persistence path (§3 — no
// fake affordance); api.get is only here so any accidental stray call resolves.
// TRASH-OVERAL-2: post + unwrap serve the shared TrashLifecycleSection
// (deletion-preview GET, mark/unmark POSTs) rendered via the `trash` prop.
vi.mock('@/lib/api', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: {} })),
    delete: vi.fn(() => Promise.resolve({})),
    post: vi.fn(() => Promise.resolve({ data: { data: { lifecycle: 'pending_erase' } } })),
  },
  unwrap: (res: { data?: unknown }) => {
    const body = res?.data
    return body && typeof body === 'object' && 'data' in body ? (body as { data: unknown }).data : body
  },
}))
// The tenant grace window read by useDeletionLifecycle's session cache.
vi.mock('@/pages/settings/lib/settingsApi', () => ({
  loadSettings: () => Promise.resolve({ deletion_grace_days: '30' }),
}))
// MatchesTab fires its own GET (proven in its own test file) — stubbed here so
// this file stays about the drawer shell (header icons + tab wiring), not the
// tab's internals.
vi.mock('./drawer/MatchesTab', () => ({ default: () => <div>matches stub</div> }))

// Tenant-renamed phases — the badge/convert button can only read these from the lookup.
/* eslint-disable no-restricted-syntax -- DATA: fixture colours as the API returns them, not UI styling */
const phasesWithCustomer = [
  { value: 'interesse', label: 'Interesse', color: '#1B60A9', isCustomer: false, isDefault: true },
  { value: 'vaste_klant', label: 'Vaste klant', color: '#16A34A', isCustomer: true, isDefault: false },
]
const mockUseCustomerPhases = vi.fn(() => ({
  phases: phasesWithCustomer,
  phaseMeta: (v?: string | null) => phasesWithCustomer.find(p => p.value === v)
    ?? { value: v ?? '', label: v ?? '', color: '#9CA3AF', isCustomer: false, isDefault: false },
  defaultPhase: 'interesse',
  // Explicit `: boolean` return type — without it TS 5.5+ infers a narrowing type
  // predicate from the `=== 'vaste_klant'` check, which then rejects the plain
  // `() => false` passed to mockReturnValueOnce below (not a type predicate).
  isCustomerPhase: (v?: string | null): boolean => v === 'vaste_klant',
  loading: false,
}))
vi.mock('@/lib/useCustomerPhases', () => ({
  useCustomerPhases: () => mockUseCustomerPhases(),
}))
/* eslint-enable no-restricted-syntax */
// CUSTOMER-DEFAULT-STATUS-1: the tenant settings blob doConvertPhase reads for
// its default-status-on-convert key. Defaults to {} (no setting configured) so
// existing tests below are unaffected; individual tests override per case.
const mockUseAllSettings = vi.fn((): Record<string, unknown> => ({}))
vi.mock('@/lib/settings/useAllSettings', () => ({ useAllSettings: () => mockUseAllSettings() }))
// Session + tenant plumbing the shell reads; no module/permission is needed by
// default. Wrapped in vi.fn() (mirrors mockUseCustomerPhases below) so the
// DELETE-ICON-1 tests can override hasPermission per case. Explicit return type
// (mirrors mockUseCustomerPhases' own `: boolean` note above it) — without it TS
// narrows `hasPermission` to the literal `() => false` from this first call site.
interface MockAuthValue { user: { name: string }; hasModule: () => boolean; hasPermission: (p: string) => boolean }
const mockUseAuth = vi.fn((): MockAuthValue => ({ user: { name: 'Test User' }, hasModule: () => false, hasPermission: () => false }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))
vi.mock('@/lib/useCustomFields', () => ({ useCustomFields: () => ({ fields: [] }) }))
// Sub-entity CRUD hooks fire their own GETs — stub them to empty, static results.
vi.mock('./hooks/useCustomerLocations', () => ({ useCustomerLocations: () => ({ locations: [] }) }))
vi.mock('./hooks/useCustomerDepartments', () => ({ useCustomerDepartments: () => ({ departments: [] }) }))
vi.mock('./hooks/useCustomerContacts', () => ({ useCustomerContacts: () => ({ contacts: [] }) }))
// Only the ACTIVE tab renders (EntityDrawer) — stub it so this stays a header test.
vi.mock('./drawer/OverviewTab', () => ({ default: () => <div>overview stub</div> }))

const ct = (key: string) => i18n.t(key, { ns: 'customers' })
// The convert button's label is an interpolated key — build the expected text
// the same way the component does, rather than guessing at placeholder syntax.
const convertLabel = (phase: string) => i18n.t('drawer.convertTo', { phase, ns: 'customers' })

// 'vaste_klant' (NOT the entry phase) — the entry-phase Status-hiding rule
// (Danny 02-08) is covered by its own describe block below; this fixture keeps
// testing the "normal" case where the Status picker shows.
const customer = { id: 1, name: 'Zorgpartners', initials: 'ZP', phase: 'vaste_klant', status: 'active',
  tags: [], notes: [], created: '', referenceNumber: 'D-1', city: 'Utrecht', industry: 'Zorg' } as unknown as Customer

const statuses = [{ value: 'active', label: 'Actief' }]

describe('CustomerDrawer · lifecycle phase badge (KLANT-FASE-1)', () => {
  it('shows the phase as a READ-ONLY badge in the header, next to the name — no picker', () => {
    render(<CustomerDrawer customer={customer} onClose={() => {}} statuses={statuses} />)

    expect(screen.getByText('Vaste klant')).toBeInTheDocument()
    // Never a dropdown button for phase — the picker is gone (§3A(c): calm header).
    expect(screen.queryByRole('button', { name: 'Vaste klant' })).toBeNull()
    expect(screen.getByText(ct('drawer.status'))).toBeInTheDocument()
  })
})

describe('CustomerDrawer · Status picker hidden in the entry phase (Danny 02-08)', () => {
  it('hides the Status meta picker for a customer still in the ENTRY phase — mirrors the candidate: not deployable yet', () => {
    const entryCustomer = { ...customer, phase: 'interesse' } as Customer
    render(<CustomerDrawer customer={entryCustomer} onClose={() => {}} statuses={statuses} />)

    expect(screen.getByText('Interesse')).toBeInTheDocument()
    expect(screen.queryByText(ct('drawer.status'))).toBeNull()
  })

  it('shows the Status meta picker again once past the entry phase', () => {
    const pastEntry = { ...customer, phase: 'vaste_klant' } as Customer
    render(<CustomerDrawer customer={pastEntry} onClose={() => {}} statuses={statuses} />)

    expect(screen.getByText(ct('drawer.status'))).toBeInTheDocument()
  })
})

describe('CustomerDrawer · convert-to-customer button (KLANT-FASE-CONVERT-1)', () => {
  it('renders the convert button ONLY while the customer is in the entry (Prospect) phase', () => {
    const entryCustomer = { ...customer, phase: 'interesse' } as Customer
    render(<CustomerDrawer customer={entryCustomer} onClose={() => {}} statuses={statuses} />)

    expect(screen.getByRole('button', { name: convertLabel('Vaste klant') })).toBeInTheDocument()
  })

  it('does NOT render the convert button once past the entry phase', () => {
    const pastEntry = { ...customer, phase: 'vaste_klant' } as Customer
    render(<CustomerDrawer customer={pastEntry} onClose={() => {}} statuses={statuses} />)

    expect(screen.queryByRole('button', { name: /Vaste klant/ })).toBeNull()
  })

  it('clicking it PATCHes onUpdate with the isCustomer-flagged phase value, not an array index guess', async () => {
    const onUpdate = vi.fn()
    const user = userEvent.setup()
    const entryCustomer = { ...customer, phase: 'interesse' } as Customer
    render(<CustomerDrawer customer={entryCustomer} onClose={() => {}} statuses={statuses} onUpdate={onUpdate} />)

    await user.click(screen.getByRole('button', { name: convertLabel('Vaste klant') }))

    expect(onUpdate).toHaveBeenCalledWith(1, { phase: 'vaste_klant' })
  })

  it('renders NO button at all when the tenant lookup has no isCustomer option', () => {
    /* eslint-disable no-restricted-syntax -- DATA: fixture colours, not UI styling */
    mockUseCustomerPhases.mockReturnValueOnce({
      phases: [{ value: 'interesse', label: 'Interesse', color: '#1B60A9', isCustomer: false, isDefault: true }],
      phaseMeta: (v?: string | null) => ({ value: v ?? '', label: v ?? '', color: '#9CA3AF', isCustomer: false, isDefault: false }),
      defaultPhase: 'interesse',
      isCustomerPhase: () => false,
      loading: false,
    })
    /* eslint-enable no-restricted-syntax */
    const entryCustomer = { ...customer, phase: 'interesse' } as Customer
    render(<CustomerDrawer customer={entryCustomer} onClose={() => {}} statuses={statuses} />)

    // Only the edit-pencil action remains — no button carries a phase label at all
    // (a convert button is the only header action that would ever render one).
    expect(screen.getByTitle(ct('drawer.edit'))).toBeInTheDocument()
    expect(screen.queryAllByRole('button').some(b => b.textContent?.includes('Interesse'))).toBe(false)
  })
})

// CUSTOMER-DEFAULT-STATUS-1: mirrors useCandidateStatus.test.ts's DEFAULT-STATUS-1
// coverage — convert must apply the tenant's configured default status in the SAME
// patch as the phase, but only onto a customer with no status yet, and an absent
// setting must leave today's phase-only behaviour untouched.
describe('CustomerDrawer · convert default status (CUSTOMER-DEFAULT-STATUS-1)', () => {
  const withStatuses = [{ value: 'active', label: 'Actief' }, { value: 'inactive', label: 'Inactief' }]

  it('convert WITH a configured default and no current status → PATCH carries phase + status', async () => {
    mockUseAllSettings.mockReturnValueOnce({ customer_default_status_on_convert: 'inactive' })
    const onUpdate = vi.fn()
    const user = userEvent.setup()
    const entryCustomer = { ...customer, phase: 'interesse', status: null } as unknown as Customer
    render(<CustomerDrawer customer={entryCustomer} onClose={() => {}} statuses={withStatuses} onUpdate={onUpdate} />)

    await user.click(screen.getByRole('button', { name: convertLabel('Vaste klant') }))

    expect(onUpdate).toHaveBeenCalledWith(1, { phase: 'vaste_klant', status: 'inactive' })
  })

  it('convert with a status ALREADY set leaves the status untouched', async () => {
    mockUseAllSettings.mockReturnValueOnce({ customer_default_status_on_convert: 'inactive' })
    const onUpdate = vi.fn()
    const user = userEvent.setup()
    const entryCustomer = { ...customer, phase: 'interesse', status: 'active' } as Customer
    render(<CustomerDrawer customer={entryCustomer} onClose={() => {}} statuses={withStatuses} onUpdate={onUpdate} />)

    await user.click(screen.getByRole('button', { name: convertLabel('Vaste klant') }))

    expect(onUpdate).toHaveBeenCalledWith(1, { phase: 'vaste_klant' })
  })

  it('convert with NO setting configured → PATCH carries only the phase (today\'s behaviour)', async () => {
    mockUseAllSettings.mockReturnValueOnce({})
    const onUpdate = vi.fn()
    const user = userEvent.setup()
    const entryCustomer = { ...customer, phase: 'interesse', status: null } as unknown as Customer
    render(<CustomerDrawer customer={entryCustomer} onClose={() => {}} statuses={withStatuses} onUpdate={onUpdate} />)

    await user.click(screen.getByRole('button', { name: convertLabel('Vaste klant') }))

    expect(onUpdate).toHaveBeenCalledWith(1, { phase: 'vaste_klant' })
  })
})

describe('CustomerDrawer · delete icon (DELETE-ICON-1)', () => {
  const grantDelete = () => mockUseAuth.mockReturnValue({ user: { name: 'Test User' }, hasModule: () => false, hasPermission: (p: string) => p === 'customers.delete' })

  it('renders NO delete icon without the customers.delete permission', () => {
    mockUseAuth.mockReturnValue({ user: { name: 'Test User' }, hasModule: () => false, hasPermission: () => false })
    render(<CustomerDrawer customer={customer} onClose={() => {}} statuses={statuses} />)
    expect(screen.queryByTitle(ct('drawer.delete'))).toBeNull()
  })

  it('renders the delete icon in the title row once customers.delete is granted', () => {
    grantDelete()
    render(<CustomerDrawer customer={customer} onClose={() => {}} statuses={statuses} />)
    expect(screen.getByTitle(ct('drawer.delete'))).toBeInTheDocument()
  })

  it('hides the delete icon once the customer is already archived', () => {
    grantDelete()
    render(<CustomerDrawer customer={{ ...customer, archived: true } as Customer} onClose={() => {}} statuses={statuses} />)
    expect(screen.queryByTitle(ct('drawer.delete'))).toBeNull()
  })

  it('does NOT call DELETE until the confirm dialog is accepted — cancel leaves it untouched', async () => {
    grantDelete()
    const user = userEvent.setup()
    render(<CustomerDrawer customer={customer} onClose={() => {}} statuses={statuses} />)

    await user.click(screen.getByTitle(ct('drawer.delete')))
    expect(api.delete).not.toHaveBeenCalled()

    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: i18n.t('cancel', { ns: 'common' }) }))
    expect(api.delete).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('calls DELETE /customers/{id} after confirming, flags it archived and closes the drawer', async () => {
    grantDelete()
    const onClose = vi.fn()
    const onUpdate = vi.fn()
    const user = userEvent.setup()
    render(<CustomerDrawer customer={customer} onClose={onClose} onUpdate={onUpdate} statuses={statuses} />)

    await user.click(screen.getByTitle(ct('drawer.delete')))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: i18n.t('confirm', { ns: 'common' }) }))

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/customers/1'))
    // 'archived' isn't in useCustomerRecord's FIELD_MAP — this is a pure local
    // flag, never a second PATCH riding on top of the DELETE that already ran.
    expect(onUpdate).toHaveBeenCalledWith(1, { archived: true })
    expect(onClose).toHaveBeenCalled()
  })

  it('maps a 409 conflict to an i18n message, never the raw server text, and keeps the drawer open', async () => {
    grantDelete()
    vi.mocked(api.delete).mockRejectedValueOnce({ response: { status: 409, data: { message: 'SQLSTATE[23000]: raw server text' } } })
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<CustomerDrawer customer={customer} onClose={onClose} statuses={statuses} />)

    await user.click(screen.getByTitle(ct('drawer.delete')))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: i18n.t('confirm', { ns: 'common' }) }))

    await waitFor(() => expect(api.delete).toHaveBeenCalled())
    expect(screen.queryByText(/SQLSTATE/)).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
  })
})

// KLANT-SAMENVOEGEN-1: the merge icon gates on customers.update (the route's own
// permission — CustomerController::merge), same slot/style convention as the trash
// icon above but a DIFFERENT permission, so it is tested on its own rather than folded
// into the delete-icon block. Clicking is not exercised here (that renders
// MergeCustomerModal, which needs a QueryClientProvider — covered by its own test file).
describe('CustomerDrawer · merge icon (KLANT-SAMENVOEGEN-1)', () => {
  const grantMerge = () => mockUseAuth.mockReturnValue({ user: { name: 'Test User' }, hasModule: () => false, hasPermission: (p: string) => p === 'customers.update' })

  it('renders NO merge icon without the customers.update permission', () => {
    mockUseAuth.mockReturnValue({ user: { name: 'Test User' }, hasModule: () => false, hasPermission: () => false })
    render(<CustomerDrawer customer={customer} onClose={() => {}} statuses={statuses} />)
    expect(screen.queryByTitle(ct('merge.title'))).toBeNull()
  })

  it('renders the merge icon in the title row once customers.update is granted', () => {
    grantMerge()
    render(<CustomerDrawer customer={customer} onClose={() => {}} statuses={statuses} />)
    expect(screen.getByTitle(ct('merge.title'))).toBeInTheDocument()
  })

  it('hides the merge icon once the customer is already archived', () => {
    grantMerge()
    render(<CustomerDrawer customer={{ ...customer, archived: true } as Customer} onClose={() => {}} statuses={statuses} />)
    expect(screen.queryByTitle(ct('merge.title'))).toBeNull()
  })
})

describe('CustomerDrawer · Matches tab (MATCHES-TAB-1)', () => {
  it('renders a Matches tab, wired to the customer-scoped MatchesTab component', async () => {
    const user = userEvent.setup()
    render(<CustomerDrawer customer={customer} onClose={() => {}} statuses={statuses} />)

    await user.click(screen.getByRole('tab', { name: ct('drawer.tabs.matches') }))
    expect(screen.getByText('matches stub')).toBeInTheDocument()
  })
})

// TRASH-OVERAL-2: the drawer's trash surface — REQUEST-asserting (§13): the mark
// flow's exact POST with and without transfer_to_owner_id, the unmark POST, the
// permission-hidden mark action, and the NEW restore banner (customers.update).
describe('CustomerDrawer · trash lifecycle (TRASH-OVERAL-2)', () => {
  const tc = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'common', ...opts })
  const PREVIEW = { blocking: [], transferable: null, can_mark: true, lifecycle: 'archived' }
  const trashWiring = (over: Partial<Record<string, unknown>> = {}) => ({
    canMark: true, canUnmark: true,
    users: [{ value: 'u-1', label: 'Anna de Vries' }],
    onMarked: vi.fn(), onUnmarked: vi.fn(), ...over,
  })

  it('mark flow: preview GET + confirm POSTs /customers/{id}/mark-deletion with an EMPTY body', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: PREVIEW } })
    const wiring = trashWiring()
    const user = userEvent.setup()
    // TRASH-ARCHIEF-EERST-1: hard delete only exists on an ARCHIVED record now.
    render(<CustomerDrawer customer={{ ...customer, archived: true, lifecycle: 'archived' }} onClose={() => {}} statuses={statuses} trash={wiring} />)

    await user.click(screen.getByRole('button', { name: tc('trash.markAction') as string }))
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/customers/1/deletion-preview'))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: tc('trash.modal.confirm') as string }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/customers/1/mark-deletion', {}, { quietStatuses: [409] }))
    expect(wiring.onMarked).toHaveBeenCalledWith(1)
  })

  it('mark flow with a picked transfer owner sends {transfer_to_owner_id}', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { ...PREVIEW, transferable: { attribute: 'owner_id', current_owner_id: null } } } })
    const user = userEvent.setup()
    render(<CustomerDrawer customer={{ ...customer, archived: true, lifecycle: 'archived' }} onClose={() => {}} statuses={statuses} trash={trashWiring()} />)

    await user.click(screen.getByRole('button', { name: tc('trash.markAction') as string }))
    await user.click(await screen.findByText(tc('trash.modal.transferPlaceholder') as string))
    await user.click(screen.getByText('Anna de Vries'))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: tc('trash.modal.confirm') as string }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/customers/1/mark-deletion',
      { transfer_to_owner_id: 'u-1' }, { quietStatuses: [409] }))
  })

  it('hides the mark action without customers.delete (no fake affordances)', () => {
    render(<CustomerDrawer customer={customer} onClose={() => {}} statuses={statuses} trash={trashWiring({ canMark: false })} />)
    expect(screen.queryByRole('button', { name: tc('trash.markAction') as string })).toBeNull()
  })

  it('unmark on a pending_erase record POSTs /customers/{id}/unmark-deletion', async () => {
    const wiring = trashWiring()
    const pending = { ...customer, archived: true, lifecycle: 'pending_erase', pendingEraseAt: '2026-08-01T10:00:00Z' } as Customer
    const user = userEvent.setup()
    render(<CustomerDrawer customer={pending} onClose={() => {}} statuses={statuses} trash={wiring} />)

    await user.click(screen.getByRole('button', { name: tc('trash.unmarkAction') as string }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/customers/1/unmark-deletion'))
    expect(wiring.onUnmarked).toHaveBeenCalledWith(1)
  })

  it('archived record shows the NEW restore banner button and calls onRestore (customers.update)', async () => {
    const onRestore = vi.fn()
    const archived = { ...customer, archived: true, archivedAt: '2026-08-01T10:00:00Z', lifecycle: 'archived' } as Customer
    const user = userEvent.setup()
    render(<CustomerDrawer customer={archived} onClose={() => {}} statuses={statuses} onRestore={onRestore} />)

    await user.click(screen.getByRole('button', { name: ct('locations.archivedBanner.restore') }))
    expect(onRestore).toHaveBeenCalledWith(1)
  })
})
