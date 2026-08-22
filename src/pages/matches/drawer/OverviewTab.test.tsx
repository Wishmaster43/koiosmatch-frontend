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
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, renderHook } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
const mockedPatch = vi.mocked(api.patch)

// MATCH-EDIT-1: a fixed tenant lookup, decoupling these tests from the real
// useCachedLookup network/caching behaviour (mirrors MatchContractSection.test.tsx).
vi.mock('@/lib/useContractTypes', () => ({ useContractTypes: () => ({ types: ['ZZP Flex', 'Fase 1-2 z.u.b. (Works)'] }) }))

afterEach(() => vi.clearAllMocks())

// Minimal valid MatchRow fixture — only the fields this tab actually reads.
const baseMatch: MatchRow = {
  id: 'm1', candidate: 'Sam de Vries', initials: 'SV', vacancy: 'Verpleegkundige', client: 'Zorggroep Noord',
  candidateId: 'c1', vacancyId: 'v1', clientId: 'cl1', score: 80, stage: '', status: 'open', stageColor: '#000',
  owner: '', ownerId: null, ownerInitials: '', ownerColor: null, date: '2026-01-01',
  helloflexLink: null, shiftmanagerLink: null,
  contractType: 'ZZP Flex', startDate: '2026-01-01', endDate: '2026-06-30', branchName: 'Utrecht',
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
    // MatchDurationBar + the list row read match.* (not this tab's own fetch) —
    // a successful save must patch them too, or they go stale (measured gap).
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
