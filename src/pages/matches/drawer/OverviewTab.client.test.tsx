/** OverviewTab · client-locked notice and client reassign flow (split from OverviewTab.test.tsx; MATCH-CLIENT-EDIT, K-281). */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'
import OverviewTab from './OverviewTab'
import api from '@/lib/api'
import type { MatchRow } from '@/types/match'

// Only the default axios client is stubbed — useMatchContract's own unwrap logic runs for real.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), patch: vi.fn() } }
})
const mockedGet = vi.mocked(api.get)
const mockedPatch = vi.mocked(api.patch)

// MATCH-EDIT-1: a fixed tenant lookup, decoupling these tests from the real
// useCachedLookup network/caching behaviour (mirrors MatchContractSection.test.tsx).
vi.mock('@/lib/useContractTypes', () => ({ useContractTypes: () => ({ types: ['ZZP Flex', 'Fase 1-2 z.u.b. (Works)'] }) }))
// MATCH-DRILL-2: a fixed tenant stop-reason lookup, so the reason-line test
// asserts against a known label without hitting useCachedLookup's real fetch.
vi.mock('@/hooks/useMatchStopReasons', () => ({
  useMatchStopReasons: () => ({ reasons: [{ value: 'assignment_ended', label: 'Opdracht beëindigd' }], loading: false }),
}))
// MATCH-RENEWAL-1: user lookups for resolving created_by user IDs in the renewals block.
vi.mock('@/lib/queries', () => ({
  useUsers: () => ({ data: [{ id: 'u1', name: 'Alice Smith' }, { id: 'u2', name: 'Bob Jones' }] }),
}))

// MATCH-CLIENT-EDIT (K-281): matches.update permission gate for MatchClientRow's
// pencil — a LOCAL useAuth() check (mirrors MatchContractSection.test.tsx's own
// pattern), default granted; individual tests flip it to prove the pencil hides.
const mockHasPermission = vi.fn(() => true)
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: mockHasPermission }) }))
beforeEach(() => { mockHasPermission.mockImplementation(() => true) })

// MATCH-CLIENT-EDIT: the SAME shared customer/cascade hooks the + Match modal
// uses (useCustomerOptions/useCustomerCascade, both in src/hooks/) — fixed
// fixtures so the reassign flow's pickers/confirm text are deterministic,
// never a live fetch. 'cl1'/'Zorggroep Noord' matches baseMatch's own client.
vi.mock('@/hooks/useCustomerOptions', () => ({
  useCustomerOptions: () => [
    { value: 'cl1', label: 'Zorggroep Noord' },
    { value: 'cl2', label: 'Andere Zorg BV' },
  ],
}))
vi.mock('@/hooks/useCustomerCascade', () => ({
  useCustomerCascade: () => ({
    locations: [{ id: 'loc1', name: 'Hoofdvestiging', departments: [{ id: 'dep1', name: 'IC' }] }],
    contacts: [], detail: null, refetch: vi.fn(),
  }),
}))
// K-281 repair NOTE (d): the customer_not_applicable Contractvorm flag lives on
// the tenant's candidateTypes lookup (LookupsContext) — tolerant read (null
// outside a Provider) so every OTHER test here, none of which wrap one,
// resolves the flag as absent/false exactly like the real app outside tests.
const lookupsState: { typeMeta: ((v?: string | null) => { customer_not_applicable?: boolean }) | null } = { typeMeta: null }
vi.mock('@/context/LookupsContext', () => ({
  useLookupsOptional: () => (lookupsState.typeMeta ? { typeMeta: lookupsState.typeMeta } : null),
}))
beforeEach(() => { lookupsState.typeMeta = null })

afterEach(() => vi.clearAllMocks())

// Minimal valid MatchRow fixture — only the fields this tab actually reads.
const baseMatch: MatchRow = {
  id: 'm1', candidate: 'Sam de Vries', initials: 'SV', vacancy: 'Verpleegkundige', client: 'Zorggroep Noord',
  candidateId: 'c1', vacancyId: 'v1', clientId: 'cl1', score: 80, stage: '', status: 'open', stageColor: '#000',
  owner: '', ownerId: null, ownerInitials: '', ownerColor: null, date: '2026-01-01',
  helloflexLink: null, shiftmanagerLink: null,
  contractType: 'ZZP Flex', startDate: '2026-01-01', endDate: '2026-06-30', branchName: 'Utrecht',
  // S1 K-266/K-267: now a required MatchRow field (unrelated concurrent lane) — unused by this tab's own reassign-flow logic.
  koiosAiAdvice: null,
}

function renderTab(match: MatchRow) {
  return render(<I18nextProvider i18n={i18n}><OverviewTab match={match} /></I18nextProvider>)
}

// MATCH-CLIENT-EDIT (K-281): a live HelloFlex contract surfaces a locked-state
// notice under the client row (and hides its pencil, see the reassign-flow
// describe block below) — mirrors MatchClientGuard::isClientLocked exactly.
describe('OverviewTab · client-locked notice (MATCH-CLIENT-EDIT, K-281)', () => {
  it('shows the locked notice once contractStatus is beyond the seeded default', async () => {
    mockedGet.mockResolvedValue({ data: { data: {} } })
    renderTab({ ...baseMatch, contractStatus: 'active' })
    expect(await screen.findByText(i18n.t('matches:drawer.clientLocked'))).toBeInTheDocument()
  })

  it('shows the locked notice once a HelloFlex contract GUID is set, even with contractStatus "none"', async () => {
    mockedGet.mockResolvedValue({ data: { data: {} } })
    renderTab({ ...baseMatch, contractStatus: 'none', helloflexContractGuid: 'hf-guid-1' })
    expect(await screen.findByText(i18n.t('matches:drawer.clientLocked'))).toBeInTheDocument()
  })

  it('hides the notice when contractStatus is the seeded "none" default and no GUID is set', async () => {
    mockedGet.mockResolvedValue({ data: { data: {} } })
    renderTab({ ...baseMatch, contractStatus: 'none', helloflexContractGuid: null })
    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/matches/m1'))
    expect(screen.queryByText(i18n.t('matches:drawer.clientLocked'))).not.toBeInTheDocument()
  })

  it('hides the notice when the payload predates the field (undefined never reads as locked)', async () => {
    mockedGet.mockResolvedValue({ data: { data: {} } })
    renderTab(baseMatch)
    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/matches/m1'))
    expect(screen.queryByText(i18n.t('matches:drawer.clientLocked'))).not.toBeInTheDocument()
  })
})

// MATCH-CLIENT-EDIT (K-281, DECISIONS + CMBE GO 05-09): the reassign flow —
// pencil -> customer/location/department cascade -> ConfirmDialog -> PATCH.
// Asserts the actual request body (§13), never just that a callback fired.
describe('OverviewTab · client reassign flow (MATCH-CLIENT-EDIT, K-281)', () => {
  // K-281 repair pass 3 (Opus find): match.client is the VACANCY's customer —
  // the row must show the match's OWN customer (customerName, the new
  // `customer` key) when present, under the plain "Klant" label.
  it('shows the match\'s OWN customer name when customerName is present, under the plain Klant label', async () => {
    mockedGet.mockResolvedValue({ data: { data: {} } })
    renderTab({ ...baseMatch, customerName: 'Andere Zorg BV' })
    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/matches/m1'))
    expect(screen.getByText('Andere Zorg BV')).toBeInTheDocument()
    expect(screen.getByText(i18n.t('matches:drawer.fields.client'))).toBeInTheDocument()
    expect(screen.queryByText(i18n.t('matches:drawer.fields.clientViaVacancy'))).not.toBeInTheDocument()
  })

  it('falls back to the vacancy\'s customer under the honest clientViaVacancy label when customerName is absent', async () => {
    mockedGet.mockResolvedValue({ data: { data: {} } })
    renderTab({ ...baseMatch, customerName: null }) // baseMatch.client = 'Zorggroep Noord' (the vacancy's customer)
    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/matches/m1'))
    expect(screen.getByText('Zorggroep Noord')).toBeInTheDocument()
    expect(screen.getByText(i18n.t('matches:drawer.fields.clientViaVacancy'))).toBeInTheDocument()
    expect(screen.queryByText(i18n.t('matches:drawer.fields.client'))).not.toBeInTheDocument()
  })

  it('hides the client pencil once a HelloFlex contract locks it', async () => {
    mockedGet.mockResolvedValue({ data: { data: {} } })
    renderTab({ ...baseMatch, contractStatus: 'active' })
    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/matches/m1'))
    expect(screen.queryByRole('button', { name: i18n.t('matches:drawer.editClient') })).not.toBeInTheDocument()
  })

  it('hides the client pencil without matches.update permission', async () => {
    mockHasPermission.mockImplementation(() => false)
    mockedGet.mockResolvedValue({ data: { data: {} } })
    renderTab(baseMatch)
    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/matches/m1'))
    expect(screen.queryByRole('button', { name: i18n.t('matches:drawer.editClient') })).not.toBeInTheDocument()
  })

  it('pencil opens the customer/location/department pickers, seeded with the current client', async () => {
    const user = userEvent.setup()
    mockedGet.mockResolvedValue({ data: { data: {} } })
    renderTab(baseMatch)
    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/matches/m1'))
    await user.click(screen.getByRole('button', { name: i18n.t('matches:drawer.editClient') }))
    // Seeded with the match's current customer (cl1 -> Zorggroep Noord); the
    // location/department pickers now render alongside it.
    expect(screen.getByRole('button', { name: 'Zorggroep Noord' })).toBeInTheDocument()
    expect(screen.getByText(i18n.t('matches:drawer.fields.customerLocation'))).toBeInTheDocument()
    expect(screen.getByText(i18n.t('matches:drawer.fields.customerDepartment'))).toBeInTheDocument()
  })

  it('save opens the confirm dialog naming the newly picked customer', async () => {
    const user = userEvent.setup()
    mockedGet.mockResolvedValue({ data: { data: {} } })
    renderTab(baseMatch)
    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/matches/m1'))
    await user.click(screen.getByRole('button', { name: i18n.t('matches:drawer.editClient') }))
    // Switch the customer to the other tenant option — location/department reset.
    await user.click(screen.getByRole('button', { name: 'Zorggroep Noord' }))
    await user.click(await screen.findByRole('button', { name: 'Andere Zorg BV' }))
    await user.click(screen.getByTitle(i18n.t('common:save')))
    const expectedBody = i18n.t('matches:drawer.clientChange.body', {
      customer: 'Andere Zorg BV',
      location: i18n.t('matches:drawer.clientChange.none'),
      department: i18n.t('matches:drawer.clientChange.none'),
    })
    expect(await screen.findByText(expectedBody)).toBeInTheDocument()
    // Nothing sent yet — only the confirm step opened.
    expect(mockedPatch).not.toHaveBeenCalled()
  })

  it('confirm PATCHes customer_id/customer_location_id/customer_department_id and syncs the row', async () => {
    const user = userEvent.setup()
    mockedGet.mockResolvedValue({ data: { data: {} } })
    mockedPatch.mockResolvedValue({ data: { data: {} } })
    const onUpdate = vi.fn()
    render(<I18nextProvider i18n={i18n}><OverviewTab match={baseMatch} onUpdate={onUpdate} /></I18nextProvider>)
    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/matches/m1'))
    await user.click(screen.getByRole('button', { name: i18n.t('matches:drawer.editClient') }))
    await user.click(screen.getByRole('button', { name: 'Zorggroep Noord' }))
    await user.click(await screen.findByRole('button', { name: 'Andere Zorg BV' }))
    await user.click(screen.getByTitle(i18n.t('common:save')))
    await user.click(await screen.findByRole('button', { name: i18n.t('common:confirm') }))
    await waitFor(() => expect(mockedPatch).toHaveBeenCalledWith('/matches/m1', {
      customer_id: 'cl2', customer_location_id: null, customer_department_id: null,
    }))
    // K-281 repair pass 3 (Opus find): `client` is the VACANCY's customer and
    // this PATCH never touches it — the optimistic patch updates `customerName`
    // (this match's OWN customer) instead, never `client`.
    expect(onUpdate).toHaveBeenCalledWith('m1', expect.objectContaining({
      clientId: 'cl2', customerName: 'Andere Zorg BV', customerLocationId: null, customerDepartmentId: null,
    }))
    expect(onUpdate).not.toHaveBeenCalledWith('m1', expect.objectContaining({ client: expect.anything() }))
  })

  it('shows the server error and restores the previous customer on a failed save', async () => {
    const user = userEvent.setup()
    mockedGet.mockResolvedValue({ data: { data: {} } })
    mockedPatch.mockRejectedValue({ response: { data: { message: 'Klant kan niet gewijzigd worden: er loopt een contract.' } } })
    renderTab(baseMatch)
    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/matches/m1'))
    await user.click(screen.getByRole('button', { name: i18n.t('matches:drawer.editClient') }))
    await user.click(screen.getByRole('button', { name: 'Zorggroep Noord' }))
    await user.click(await screen.findByRole('button', { name: 'Andere Zorg BV' }))
    await user.click(screen.getByTitle(i18n.t('common:save')))
    await user.click(await screen.findByRole('button', { name: i18n.t('common:confirm') }))
    // The server's message renders as the field notice…
    expect(await screen.findByText('Klant kan niet gewijzigd worden: er loopt een contract.')).toBeInTheDocument()
    // …and the picker reverts to the match's ORIGINAL customer, not the failed attempt.
    expect(screen.getByRole('button', { name: 'Zorggroep Noord' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Andere Zorg BV' })).not.toBeInTheDocument()
  })

  it('cancel discards the draft without sending anything', async () => {
    const user = userEvent.setup()
    mockedGet.mockResolvedValue({ data: { data: {} } })
    renderTab(baseMatch)
    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/matches/m1'))
    await user.click(screen.getByRole('button', { name: i18n.t('matches:drawer.editClient') }))
    await user.click(screen.getByRole('button', { name: 'Zorggroep Noord' }))
    await user.click(await screen.findByRole('button', { name: 'Andere Zorg BV' }))
    await user.click(screen.getByTitle(i18n.t('common:cancel')))
    // Back to read mode showing the ORIGINAL client — nothing sent.
    expect(screen.getByText('Zorggroep Noord')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Andere Zorg BV' })).not.toBeInTheDocument()
    expect(mockedPatch).not.toHaveBeenCalled()
  })

  // K-281 repair NOTE (a): save with an UNCHANGED pick is a no-op — proven at
  // the rendered level too (not just the hook), since Opus checks the RENDER.
  it('save with an UNCHANGED customer just closes the editor — no confirm, no PATCH', async () => {
    const user = userEvent.setup()
    mockedGet.mockResolvedValue({ data: { data: {} } })
    renderTab(baseMatch)
    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/matches/m1'))
    await user.click(screen.getByRole('button', { name: i18n.t('matches:drawer.editClient') }))
    await user.click(screen.getByTitle(i18n.t('common:save')))
    expect(screen.queryByText(i18n.t('matches:drawer.clientChange.title'))).not.toBeInTheDocument()
    expect(mockedPatch).not.toHaveBeenCalled()
    // Back to read mode.
    expect(screen.getByText('Zorggroep Noord')).toBeInTheDocument()
  })

  // K-281 repair MUST-FIX 1: the confirm dialog states the TRUTH (billing is
  // re-derived; owner/own branch/vacancy do NOT follow) and shows what to verify.
  it('confirm dialog shows the current owner/vacancy/branch and a mismatch warning once the customer differs', async () => {
    const user = userEvent.setup()
    mockedGet.mockResolvedValue({ data: { data: {} } })
    renderTab({ ...baseMatch, owner: 'Piet de Vries' })
    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/matches/m1'))
    await user.click(screen.getByRole('button', { name: i18n.t('matches:drawer.editClient') }))
    await user.click(screen.getByRole('button', { name: 'Zorggroep Noord' }))
    await user.click(await screen.findByRole('button', { name: 'Andere Zorg BV' }))
    await user.click(screen.getByTitle(i18n.t('common:save')))
    expect(await screen.findByText(i18n.t('matches:drawer.clientChange.currentOwner', { owner: 'Piet de Vries' }))).toBeInTheDocument()
    expect(screen.getByText(i18n.t('matches:drawer.clientChange.currentVacancy', { vacancy: 'Verpleegkundige · Zorggroep Noord' }))).toBeInTheDocument()
    expect(screen.getByText(i18n.t('matches:drawer.clientChange.vacancyMismatch', { title: 'Verpleegkundige', vacancyCustomer: 'Zorggroep Noord' }))).toBeInTheDocument()
    expect(screen.getByText(i18n.t('matches:drawer.clientChange.currentBranch', { branch: 'Utrecht' }))).toBeInTheDocument()
  })

  it('omits every caption line the match row carries no data for', async () => {
    const user = userEvent.setup()
    mockedGet.mockResolvedValue({ data: { data: {} } })
    renderTab({ ...baseMatch, owner: '', vacancy: '—', client: '—', clientId: null, branchName: null })
    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/matches/m1'))
    await user.click(screen.getByRole('button', { name: i18n.t('matches:drawer.editClient') }))
    await user.click(screen.getByRole('button', { name: i18n.t('candidates:placement.pickCustomer') }))
    await user.click(await screen.findByRole('button', { name: 'Andere Zorg BV' }))
    await user.click(screen.getByTitle(i18n.t('common:save')))
    expect(await screen.findByText(i18n.t('matches:drawer.clientChange.title'))).toBeInTheDocument()
    expect(screen.queryByText(/^Eigenaar:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^Vacature:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^Vestiging:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/hangt aan/)).not.toBeInTheDocument()
  })

  // K-281 repair NOTE (d): a customer_not_applicable Contractvorm (MATCH-KLANTLOOS-1)
  // has no customer/location/department to reassign at all.
  it('hides the pencil for a customer_not_applicable Contractvorm', async () => {
    lookupsState.typeMeta = (v) => (v === 'klantloos' ? { customer_not_applicable: true } : {})
    mockedGet.mockResolvedValue({ data: { data: {} } })
    renderTab({ ...baseMatch, contractForm: { value: 'klantloos', label: 'Klantloos', color: '#000' } })
    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/matches/m1'))
    expect(screen.queryByRole('button', { name: i18n.t('matches:drawer.editClient') })).not.toBeInTheDocument()
  })
})

// MATCH-EDIT-1 (Danny 22-08, "waar is het potlootje bij een match?"): the
// Contract/Financieel card is now editable — asserts the actual PATCH request
// (route + mapped body), never just that a callback fired (§13).
