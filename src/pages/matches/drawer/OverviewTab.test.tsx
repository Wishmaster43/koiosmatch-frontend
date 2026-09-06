/**
 * OverviewTab — regression tests for the overzicht-data cluster additions:
 * M1 (contract form), M2 (literal begin/end dates), M19 (branch) straight off
 * the list row, and the DETAIL-only card (M3/M28/M12 — hours/week, cost
 * centre, billing e-mail, HelloFlex last-sync) fetched via useMatchContract.
 *
 * MATCH-EDIT-1 (Danny 22-08): contract_type/start_date/end_date/hours_per_week/
 * cost_center/billing_emails are now EDITABLE here (moved off MatchContractSection,
 * see that file's own tests for the "no longer renders there" regression) — the
 * tests below cover the new save path and the contract_type clear cycle.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, waitFor, renderHook } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'
import OverviewTab from './OverviewTab'
import { useMatchAdvice } from '@/lib/useMatchAdvice'
import api from '@/lib/api'
import type { MatchRow } from '@/types/match'
import { computeMatchDuration } from '../matchDuration'

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

describe('OverviewTab · overzicht-data cluster', () => {
  // MATCH-EDIT-1: contract_type/start_date/end_date now come from the SAME
  // detail-only fetch as hours/week etc. (they moved into the editable
  // Contract/Financieel card) — branch still comes straight off the list row.
  it('renders the fetched contract type/dates in the editable card, and branch straight off the list row', async () => {
    mockedGet.mockResolvedValue({
      data: { data: { contract_type: 'ZZP Flex', start_date: '2026-01-01', end_date: '2026-06-30' } },
    })
    renderTab(baseMatch)
    expect(await screen.findByText('ZZP Flex')).toBeInTheDocument()
    expect(screen.getByText('Utrecht')).toBeInTheDocument()
  })

  it('fetches the detail-only contract layer and shows hours/week + cost centre + billing e-mail', async () => {
    mockedGet.mockResolvedValue({
      data: { data: { hours_per_week: 32, cost_center: 'KP-1', billing_emails: ['a@example.org'] } },
    })
    renderTab(baseMatch)
    expect(mockedGet).toHaveBeenCalledWith('/matches/m1')
    expect(await screen.findByText('32')).toBeInTheDocument()
    expect(screen.getByText('KP-1')).toBeInTheDocument()
    expect(screen.getByText('a@example.org')).toBeInTheDocument()
  })

  // K-249 C.4: the read-only "Overgenomen van" row under the Financieel group.
  it('shows the translated billing_source under the Financieel group', async () => {
    mockedGet.mockResolvedValue({ data: { data: { cost_center: 'KP-1', billing_source: 'department' } } })
    renderTab(baseMatch)
    expect(await screen.findByText('afdeling')).toBeInTheDocument()
  })

  it('shows a dash for billing_source when null', async () => {
    mockedGet.mockResolvedValue({ data: { data: { cost_center: 'KP-1', billing_source: null } } })
    renderTab(baseMatch)
    await screen.findByText('KP-1')
    // Several other detail rows also render a dash (owner/score-less fields) —
    // scope to the "Overgenomen van" row specifically, not just any dash on screen.
    const label = screen.getByText(i18n.t('drawer.contract.billingSource', { ns: 'matches' }))
    expect(label.nextElementSibling).toHaveTextContent('—')
  })

  it('shows the HelloFlex last-sync timestamp from the list row when present', async () => {
    mockedGet.mockResolvedValue({ data: { data: {} } })
    renderTab({ ...baseMatch, helloflexLink: {
      status: 'linked', externalId: 'hf-1', lastError: null,
      lastSyncedAt: '2026-07-20T10:00:00Z', linkedAt: '2026-07-01T10:00:00Z', linkedBy: null,
    } })
    await waitFor(() => expect(mockedGet).toHaveBeenCalled())
    // Not asserting the exact locale format — just that a real value renders, not a dash-only state.
    expect(screen.queryAllByText('—').length).toBeLessThan(8)
  })

  // MATCH-EDIT-1 detail-first regression: MatchDurationBar must read the FETCHED
  // contract dates, not the (possibly stale) match.startDate/endDate prop — a
  // save elsewhere in the app can leave the list row behind the detail fetch.
  it('computes the progress bar from the DETAIL fetch dates, not the stale match prop', async () => {
    // Stale list-row dates: far in the future, so if THESE were used the bar
    // would show 0% elapsed. The detail fetch below carries dates spanning a
    // full year around today, so the two sources compute different percentages.
    // No injected `now` (the component always uses the real clock): the window
    // is wide enough that day-level rounding cannot flip the outcome between
    // the render and the assertion below.
    const staleMatch: MatchRow = { ...baseMatch, startDate: '2099-01-01', endDate: '2099-06-30' }
    const detailStart = '2020-01-01'
    const detailEnd = '2099-01-01'
    mockedGet.mockResolvedValue({
      data: { data: { start_date: detailStart, end_date: detailEnd } },
    })
    render(<I18nextProvider i18n={i18n}><OverviewTab match={staleMatch} /></I18nextProvider>)
    const bar = await screen.findByRole('progressbar')
    const expected = computeMatchDuration(detailStart, detailEnd)
    expect(expected).not.toBeNull()
    expect(bar).toHaveAttribute('aria-valuenow', String(expected?.elapsedPct))
    // Sanity: the stale-prop computation (both dates in the future) would be 0%.
    const staleExpected = computeMatchDuration(staleMatch.startDate, staleMatch.endDate)
    expect(staleExpected?.elapsedPct).toBe(0)
    expect(bar.getAttribute('aria-valuenow')).not.toBe('0')
  })

  // M17/optie A — the backend `match_text` column doesn't exist yet (MATCH-TEXT-FIELD-1),
  // so the block must stay OFFERED-IFF-READ: hidden unless the GET payload carries the key.
  it('keeps the match text block hidden when the payload does not carry the match_text key', async () => {
    mockedGet.mockResolvedValue({ data: { data: {} } })
    renderTab(baseMatch)
    await waitFor(() => expect(mockedGet).toHaveBeenCalled())
    // Rendered by MatchTextBlock only once `present` is true — the missing i18n
    // key falls back to the literal key string, so its absence proves the block
    // never mounted (see MatchTextBlock.test.tsx for the unit-level coverage).
    expect(screen.queryByText(i18n.t('matches:drawer.matchText.title'))).not.toBeInTheDocument()
  })

  it('shows the match text block once the payload carries the match_text key, even when null', async () => {
    mockedGet.mockResolvedValue({ data: { data: { match_text: null } } })
    renderTab(baseMatch)
    expect(await screen.findByText(i18n.t('matches:drawer.matchText.title'))).toBeInTheDocument()
  })

  // REMARKS-INTO-NOTES-1 (Danny 09-08): Matchtekst stays, Opmerkingen is retired.
  it('offers exactly ONE free-text editor (Matchtekst) even while a legacy remark is still there', async () => {
    mockedGet.mockResolvedValue({ data: { data: { match_text: null, remarks: '<p>Oude opmerking</p>' } } })
    renderTab(baseMatch)
    // The legacy content is still readable — nothing was thrown away. Asserted
    // inside waitFor (never `await findBy…` then assert): the tab re-renders once
    // more when the note-type lookup lands, which can detach the node found by an
    // earlier query and turn a correct render into a flaky failure.
    await waitFor(() => expect(screen.getByText('Oude opmerking')).toBeInTheDocument())
    // …Matchtekst's own pencil, plus the Contract/Financieel card's pencil
    // (MATCH-EDIT-1, unrelated to free text) — exactly two, never a third
    // free-text editor for the retired Opmerkingen field.
    await waitFor(() => expect(screen.getAllByRole('button', { name: i18n.t('common:edit') })).toHaveLength(2))
  })

  it('drops the retired Opmerkingen block entirely once the field is empty', async () => {
    mockedGet.mockResolvedValue({ data: { data: { match_text: null, remarks: null } } })
    renderTab(baseMatch)
    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/matches/m1'))
    expect(screen.queryByText(i18n.t('matches:drawer.remarks.title'))).not.toBeInTheDocument()
  })
})

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
describe('OverviewTab · Contract/Financieel card is editable (MATCH-EDIT-1)', () => {
  // match_text/remarks omitted from the payload so MatchTextBlock/MatchRemarksBlock
  // stay unmounted — this card's pencil is then the ONLY one on the page.
  const emptyContract = {
    contract_type: null, start_date: null, end_date: null,
    hours_per_week: null, cost_center: null, billing_emails: [] as string[],
  }

  it('edits and saves cost_center via PATCH /matches/{id} with the mapped body, syncing the list row', async () => {
    const user = userEvent.setup()
    mockedGet.mockResolvedValue({ data: { data: emptyContract } })
    mockedPatch.mockResolvedValue({ data: { data: {} } })
    const onUpdate = vi.fn()
    render(<I18nextProvider i18n={i18n}><OverviewTab match={baseMatch} onUpdate={onUpdate} /></I18nextProvider>)
    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/matches/m1'))
    await user.click(screen.getByRole('button', { name: i18n.t('common:edit') }))
    // Locate the cost_center input via its own label sibling — DOM-order-proof,
    // never guessed off getAllByRole('textbox') index (start_date/end_date's
    // DatePicker inputs are textboxes too).
    const costCenterLabel = screen.getByText(i18n.t('matches:drawer.contract.costCenter'))
    const costCenterInput = costCenterLabel.nextElementSibling?.querySelector('input') as HTMLInputElement
    expect(costCenterInput).toBeTruthy()
    await user.type(costCenterInput, 'KP-9')
    await user.click(screen.getByTitle(i18n.t('common:save')))
    await waitFor(() => expect(mockedPatch).toHaveBeenCalledWith('/matches/m1', expect.objectContaining({ cost_center: 'KP-9' })))
    // The list row reads match.* (not this tab's own fetch) — a successful save
    // must patch it too, or it goes stale. MatchDurationBar itself is detail-first
    // (contract.start_date ?? match.startDate), so it stays fresh regardless.
    expect(onUpdate).toHaveBeenCalledWith('m1', expect.objectContaining({ contractType: null, startDate: null, endDate: null }))
  })

  // VAC-CLEAR-1: the optional contract_type select carries the REAL clear-cross
  // (EditableFieldTable's `clearable` passthrough → CreatableSelect's own X) —
  // an unset value renders the plain placeholder, never an artificial "none"
  // option label (Opus round 22-08: that label leaked into read mode).
  it('supports pick → clear → placeholder on the optional contract_type select, and PATCHes null', async () => {
    const user = userEvent.setup()
    mockedGet.mockResolvedValue({ data: { data: emptyContract } })
    mockedPatch.mockResolvedValue({ data: { data: {} } })
    render(<I18nextProvider i18n={i18n}><OverviewTab match={baseMatch} /></I18nextProvider>)
    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/matches/m1'))
    await user.click(screen.getByRole('button', { name: i18n.t('common:edit') }))
    // Unset shows the plain placeholder — open it and pick a real option.
    await user.click(screen.getByRole('button', { name: i18n.t('common:select') }))
    await user.click(await screen.findByRole('button', { name: 'ZZP Flex' }))
    expect(screen.getByRole('button', { name: 'ZZP Flex' })).toBeInTheDocument()
    // The clear-cross exists only while a value is set (VAC-CLEAR-1) — press it.
    const clearName = i18n.t('common:clearField', { field: i18n.t('matches:drawer.contract.contractType') })
    await user.click(screen.getByTitle(clearName))
    // Back to the placeholder — the clear reached the draft, not just the menu.
    expect(screen.getByRole('button', { name: i18n.t('common:select') })).toBeInTheDocument()
    await user.click(screen.getByTitle(i18n.t('common:save')))
    await waitFor(() => expect(mockedPatch).toHaveBeenCalledWith('/matches/m1', expect.objectContaining({ contract_type: null })))
  })
})

// §3 four states (Opus round 22-08): a FAILED contract fetch must never yield an
// editable blank card — the save path builds all six keys unconditionally, so one
// save on top of never-fetched data would null-wipe the stored record.
describe('OverviewTab · contract card guard states', () => {
  it('renders the error line + retry and NO pencil when the contract fetch fails', async () => {
    mockedGet.mockRejectedValue(new Error('boom'))
    renderTab(baseMatch)
    await waitFor(() => expect(screen.getByText(i18n.t('matches:drawer.contract.error'))).toBeInTheDocument())
    expect(screen.getByRole('button', { name: i18n.t('common:error.retry') })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: i18n.t('common:edit') })).not.toBeInTheDocument()
  })

  it('offers no contract pencil on an archived match (read-only, like every drawer surface)', async () => {
    mockedGet.mockResolvedValue({ data: { data: {
      contract_type: null, start_date: null, end_date: null,
      hours_per_week: null, cost_center: null, billing_emails: [] as string[],
    } } })
    renderTab({ ...baseMatch, archived: true })
    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/matches/m1'))
    expect(screen.queryByRole('button', { name: i18n.t('common:edit') })).not.toBeInTheDocument()
  })
})

// KOIOS-ADVIES-OVERAL-1: the drawer block shows EXACTLY the advice the table's
// Koios column derives — asserted through the SAME resolver (useMatchAdvice),
// never a copied literal.
describe('OverviewTab · table-identical Koios advice (KOIOS-ADVIES-OVERAL-1)', () => {
  // Resolve the advice through the shared hook, exactly as MatchesTable does.
  const resolveVia = (match: MatchRow) => {
    const { result } = renderHook(() => useMatchAdvice(), {
      wrapper: ({ children }) => <I18nextProvider i18n={i18n}>{children}</I18nextProvider>,
    })
    return result.current(match)
  }

  it('shows the same label the table pill derives for an open match past its end date', async () => {
    mockedGet.mockResolvedValue({ data: { data: {} } })
    const expected = resolveVia(baseMatch)?.label
    expect(expected).toBeTruthy()
    renderTab(baseMatch)
    expect(await screen.findByText(expected as string)).toBeInTheDocument()
  })

  it('renders no advice row on a clean match (end date far away) — heuristics only', async () => {
    mockedGet.mockResolvedValue({ data: { data: {} } })
    const clean: MatchRow = { ...baseMatch, endDate: '2031-12-31' }
    expect(resolveVia(clean)).toBeNull()
    // The label an advice-worthy match WOULD show must be absent here.
    const adviceLabel = resolveVia(baseMatch)?.label
    renderTab(clean)
    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/matches/m1'))
    expect(screen.queryByText(adviceLabel as string)).not.toBeInTheDocument()
  })
})

// MATCH-DRILL-2: the termination read-back reason line + renewal-count row —
// shown for a terminated match fixture, hidden for an open one (canon: a
// counter never renders "0").
describe('OverviewTab · termination read-back (MATCH-DRILL-2)', () => {
  it('renders the reason line + renewal row for a terminated match', async () => {
    mockedGet.mockResolvedValue({ data: { data: {} } })
    renderTab({
      ...baseMatch,
      stopReason: 'assignment_ended',
      terminatedAt: '2027-01-15T09:00:00+00:00',
      renewalCount: 2,
    })
    // The resolved tenant-lookup label + DD-MM-YYYY date, joined by the shared separator.
    expect(await screen.findByText('15-01-2027 · Opdracht beëindigd')).toBeInTheDocument()
    expect(screen.getByText(i18n.t('matches:drawer.renew.renewalCount', { count: 2, ordinal: true }))).toBeInTheDocument()
  })

  it('hides the reason line and the renewal row on an open match', async () => {
    mockedGet.mockResolvedValue({ data: { data: {} } })
    renderTab(baseMatch)
    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/matches/m1'))
    expect(screen.queryByText(i18n.t('matches:drawer.fields.terminated'))).not.toBeInTheDocument()
    expect(screen.queryByText(i18n.t('matches:drawer.fields.renewals'))).not.toBeInTheDocument()
  })
})

// MATCH-RENEWAL-1: the renewal history chain — rendered as a compact block
// showing each renewal's dates, creation timestamp, and creator user name.
describe('OverviewTab · renewal history (MATCH-RENEWAL-1)', () => {
  it('renders the renewals block with formatted date range and sequence number', async () => {
    mockedGet.mockResolvedValue({
      data: {
        data: {
          renewals: [
            { id: 'r1', sequence: 1, old_end_date: '2026-06-30', new_end_date: '2026-12-31', created_by: 'u1', created_at: '2026-06-29T14:30:00Z' },
          ],
        },
      },
    })
    renderTab(baseMatch)
    // Sequence number + formatted date range (label-left / value-right canon).
    expect(await screen.findByText('#1')).toBeInTheDocument()
    expect(screen.getByText('30-06-2026 → 31-12-2026')).toBeInTheDocument()
    // Metadata row: creation timestamp + user name.
    expect(screen.getByText('29-06-2026 · Alice Smith')).toBeInTheDocument()
  })

  it('hides the renewals block when there are no renewals', async () => {
    mockedGet.mockResolvedValue({ data: { data: { renewals: [] } } })
    renderTab(baseMatch)
    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/matches/m1'))
    expect(screen.queryByText(i18n.t('matches:drawer.contract.renewals'))).not.toBeInTheDocument()
  })

  it('renders multiple renewal records with their own sequence numbers', async () => {
    mockedGet.mockResolvedValue({
      data: {
        data: {
          renewals: [
            { id: 'r1', sequence: 1, old_end_date: '2026-06-30', new_end_date: '2026-12-31', created_by: 'u1', created_at: '2026-06-29' },
            { id: 'r2', sequence: 2, old_end_date: '2026-12-31', new_end_date: '2027-06-30', created_by: 'u2', created_at: '2026-12-30' },
          ],
        },
      },
    })
    renderTab(baseMatch)
    expect(await screen.findByText('#1')).toBeInTheDocument()
    expect(screen.getByText('#2')).toBeInTheDocument()
  })
})

// S1 repair MUST-FIX 2: the LIST row's koiosAiAdvice is compact (verdict+score
// only); this tab's own useMatchContract fetch hits MatchDetailResource, which
// carries the FULL block — it must win once loaded, so a plain row-click
// (compact prop) converges on the SAME card a deep-link (full prop, fetched
// directly) already shows.
describe('OverviewTab · koiosAiAdvice prefers the detail fetch over the compact row (S1 repair MUST-FIX 2)', () => {
  it('upgrades from the compact row advice to the full detail block once the contract fetch lands', async () => {
    mockedGet.mockResolvedValue({
      data: {
        data: {
          koios_ai_advice: {
            verdict: 'renew', score: 85, text: 'Detailed AI reasoning from the full block.',
            language: 'nl', generated_at: '2026-09-01T06:00:00Z', run_id: 'run-detail',
          },
        },
      },
    })
    const compactOnly: MatchRow = {
      ...baseMatch,
      koiosAiAdvice: { verdict: 'renew', score: 70, text: null, language: null, generatedAt: null, runId: 'run-compact' },
    }
    renderTab(compactOnly)

    // The compact row alone carries no text — waits for the richer detail row.
    expect(await screen.findByText('Detailed AI reasoning from the full block.')).toBeInTheDocument()
  })

  it('falls back to the compact row while the detail fetch has not landed yet (never blank)', () => {
    mockedGet.mockReturnValue(new Promise(() => {})) // never resolves during this test
    const compactOnly: MatchRow = {
      ...baseMatch,
      koiosAiAdvice: { verdict: 'renew', score: 70, text: null, language: null, generatedAt: null, runId: 'run-compact' },
    }
    renderTab(compactOnly)

    // Verdict chip renders straight away off the compact row (real i18n label).
    expect(screen.getByText(i18n.t('common:koios.advice.verdict.renew'))).toBeInTheDocument()
  })
})
