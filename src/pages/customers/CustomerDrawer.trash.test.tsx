/** CustomerDrawer · trash lifecycle and Timeline tab (split from CustomerDrawer.test.tsx; mocks and helpers are duplicated per file because hoisted vi.mock blocks cannot be shared). */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import CustomerDrawer from './CustomerDrawer'
import type { Customer } from '@/types/customer'
import { customerPhasesValue } from './CustomerDrawer.testKit'

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
// Tenant-renamed phases — the badge/convert button can only read these from the lookup (fixtures live in the kit).
const mockUseCustomerPhases = vi.fn(() => customerPhasesValue())
vi.mock('@/lib/useCustomerPhases', () => ({
  useCustomerPhases: () => mockUseCustomerPhases(),
}))
// CUSTOMER-DEFAULT-STATUS-1: the tenant settings blob doConvertPhase reads for
// its default-status-on-convert key. Defaults to {} (no setting configured) so
// existing tests below are unaffected; individual tests override per case.
const mockUseAllSettings = vi.fn((): Record<string, unknown> => ({}))
// KLANT-BLACKLIST-PROMPT-1: useCustomerDrawerActions now also reads getBoolSetting
// from this module — re-export the real (pure) helper alongside the mocked hook.
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual<typeof import('@/lib/settings/useAllSettings')>('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => mockUseAllSettings() }
})
// Session + tenant plumbing the shell reads; no module/permission is needed by
// default. Wrapped in vi.fn() (mirrors mockUseCustomerPhases below) so the
// DELETE-ICON-1 tests can override hasPermission per case. Explicit return type
// (mirrors the `: boolean` note in CustomerDrawer.testKit.ts) — without it TS
// narrows `hasPermission` to the literal `() => false` from this first call site.
interface MockAuthValue { user: { name: string }; hasModule: () => boolean; hasPermission: (p: string) => boolean }
const mockUseAuth = vi.fn((): MockAuthValue => ({ user: { name: 'Test User' }, hasModule: () => false, hasPermission: () => false }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))
vi.mock('@/lib/useCustomFields', () => ({ useCustomFields: () => ({ fields: [] }) }))
// Sub-entity CRUD hooks fire their own GETs — stub them to empty, static results.
vi.mock('./hooks/useCustomerLocations', () => ({ useCustomerLocations: () => ({ locations: [] }), LOCATIONS_CHANGED_EVENT: 'km:locations-changed' }))
vi.mock('./hooks/useCustomerDepartments', () => ({ useCustomerDepartments: () => ({ departments: [] }), DEPARTMENTS_CHANGED_EVENT: 'km:departments-changed' }))
vi.mock('./hooks/useCustomerContacts', () => ({ useCustomerContacts: () => ({ contacts: [] }), CONTACTS_CHANGED_EVENT: 'km:contacts-changed' }))
// Only the ACTIVE tab renders (EntityDrawer) — stub it so this stays a header test.
vi.mock('./drawer/OverviewTab', () => ({ default: () => <div>overview stub</div> }))

const ct = (key: string) => i18n.t(key, { ns: 'customers' })

// 'vaste_klant' (NOT the entry phase) — the entry-phase Status-hiding rule
// (Danny 02-08) is covered by its own describe block in CustomerDrawer.test.tsx; this fixture keeps
// testing the "normal" case where the Status picker shows.
const customer = { id: 1, name: 'Zorgpartners', initials: 'ZP', phase: 'vaste_klant', status: 'active',
  tags: [], notes: [], created: '', referenceNumber: 'D-1', city: 'Utrecht', industry: 'Zorg' } as unknown as Customer

const statuses = [{ value: 'active', label: 'Actief' }]

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

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/customers/1/unmark-deletion', undefined,
      expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) })))
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

// TIJDLIJN-OVERAL (27-08): the new tab mounts second-to-last (Statistics stays
// last) and reuses the same ChangelogTab content the title-row popover renders.
describe('CustomerDrawer · Timeline tab (TIJDLIJN-OVERAL)', () => {
  it('renders the Timeline tab right before Statistics, as the second-to-last tab', () => {
    render(<CustomerDrawer customer={customer} onClose={() => {}} statuses={statuses} />)
    const tabs = screen.getAllByRole('tab').map(el => el.textContent)
    // Literal label: a raw-key render (missing i18n) must FAIL, never round-trip.
    const timelineIdx = tabs.findIndex(label => label === 'Tijdlijn')
    const statisticsIdx = tabs.findIndex(label => label === ct('drawer.tabs.statistics'))
    expect(timelineIdx).toBeGreaterThan(-1)
    expect(timelineIdx).toBe(statisticsIdx - 1)
    expect(timelineIdx).toBe(tabs.length - 2)
  })

  it('fetches the customer activity feed (the same request the changelog popover uses) when the tab opens', async () => {
    const user = userEvent.setup()
    render(<CustomerDrawer customer={customer} onClose={() => {}} statuses={statuses} />)

    await user.click(screen.getByRole('tab', { name: ct('drawer.tabs.timeline') }))

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/customers/1/activity', expect.anything()))
  })
})
