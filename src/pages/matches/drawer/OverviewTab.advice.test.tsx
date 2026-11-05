/** OverviewTab · Koios advice, termination read-back and renewal history (split from OverviewTab.test.tsx). */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, waitFor, renderHook } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'
import OverviewTab from './OverviewTab'
import { useMatchAdvice } from '@/lib/useMatchAdvice'
import api from '@/lib/api'
import type { MatchRow } from '@/types/match'

// Only the default axios client is stubbed — useMatchContract's own unwrap logic runs for real.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), patch: vi.fn() } }
})
const mockedGet = vi.mocked(api.get)

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

  // SCHERMWAARHEID-1 canon: drilldown field-card values are plain text, never a chip.
  it('renders the stage as plain text, never a StatusPill chip', async () => {
    mockedGet.mockResolvedValue({ data: { data: {} } })
    const withStage: MatchRow = { ...baseMatch, stage: 'Actief' }
    renderTab(withStage)
    const stage = await screen.findByText('Actief')
    // A StatusPill renders as a rounded/tinted pill span — a plain-text field
    // value has no such wrapper around the text node's own parent.
    expect(stage.tagName.toLowerCase()).not.toBe('span')
  })
})
