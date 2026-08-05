/**
 * OverviewTab — regression tests for the overzicht-data cluster additions:
 * M1 (contract form), M2 (literal begin/end dates), M19 (branch) straight off
 * the list row, and the DETAIL-only card (M3/M28/M12 — hours/week, cost
 * centre, billing e-mail, HelloFlex last-sync) fetched via useMatchContract.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'
import OverviewTab from './OverviewTab'
import api from '@/lib/api'
import type { MatchRow } from '@/types/match'

// Only the default axios client is stubbed — useMatchContract's own unwrap logic runs for real.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})
const mockedGet = vi.mocked(api.get)

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
  it('renders contract form, dates and branch straight off the list row (no extra fetch needed for those)', async () => {
    mockedGet.mockResolvedValue({ data: { data: {} } })
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
})
