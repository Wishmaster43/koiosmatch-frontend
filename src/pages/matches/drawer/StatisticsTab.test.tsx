/**
 * StatisticsTab — MOVED-FROM-OVERVIEW-1 regression tests: the ordinal
 * footnote's phrasing survives verbatim (drawer.ordinal.*), an axis with no id
 * on this match renders nothing, an axis whose only match IS this one shows
 * the italic empty note, and a real "other match" renders as a clickable row
 * (other party + vacancy + StatusPill + period) that navigates via openEntity.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'
import StatisticsTab from './StatisticsTab'
import { computeMatchOrdinals } from '../matchOrdinals'
import type { MatchRow } from '@/types/match'

// Real (nl) lookup values so the row's StatusPill resolves genuine copy.
vi.mock('@/lib/useMatchStatuses', () => ({
  useMatchStatuses: () => ({
    statuses: [{ value: 'open', label: 'Open' }],
    // eslint-disable-next-line no-restricted-syntax -- seed DATA fixture hex mirroring useMatchStatuses' own DEFAULT_MATCH_STATUSES, not UI styling
    metaOf: (v?: string | null) => (v === 'open' ? { value: 'open', label: 'Open', color: '#6FA8C4' } : undefined),
  }),
}))

// Spy on the shared cross-entity navigation (mirrors ScopedMatchesTab's own use).
const mockOpenEntity = vi.fn()
vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity: mockOpenEntity }) }))

function row(overrides: Partial<MatchRow>): MatchRow {
  return {
    id: overrides.id ?? '1',
    candidate: 'Sam de Vries', initials: 'SV', vacancy: 'Verpleegkundige', client: 'Zorggroep Noord',
    candidateId: null, vacancyId: null, clientId: null,
    score: null, stage: '', status: 'open', stageColor: '#000',
    owner: '', ownerId: null, ownerInitials: '', ownerColor: null,
    date: '2026-01-01',
    helloflexLink: null, shiftmanagerLink: null,
    ...overrides,
  }
}

function renderTab(match: MatchRow, allRows: MatchRow[]) {
  const ordinals = computeMatchOrdinals(allRows, match)
  return render(
    <I18nextProvider i18n={i18n}>
      <StatisticsTab match={match} allRows={allRows} ordinals={ordinals} />
    </I18nextProvider>,
  )
}

describe('StatisticsTab · axis presence (MATCH-ORDINAL-1 rule)', () => {
  it('renders nothing for an axis this match has no id for (never a fake "1/1")', () => {
    const match = row({ id: 'm1', candidateId: 'c1', clientId: null, customerLocationId: null, customerDepartmentId: null })
    renderTab(match, [match])
    expect(screen.queryByText(/deze klant/)).not.toBeInTheDocument()
    expect(screen.queryByText(/deze locatie/)).not.toBeInTheDocument()
    expect(screen.queryByText(/deze afdeling/)).not.toBeInTheDocument()
  })

  it('shows the honest empty state when this match carries no axis id at all', () => {
    const match = row({ id: 'm1', candidateId: null, clientId: null, customerLocationId: null, customerDepartmentId: null })
    renderTab(match, [match])
    expect(screen.getByText(i18n.t('matches:drawer.statistics.empty'))).toBeInTheDocument()
  })
})

describe('StatisticsTab · exact ordinal phrasing (drawer.ordinal.* unchanged)', () => {
  it('titles the candidate axis card with the same phrase the old footnote used', () => {
    const match = row({ id: 'm1', candidateId: 'c1' })
    renderTab(match, [match])
    expect(screen.getByText(i18n.t('matches:drawer.ordinal.candidate', { position: 1, total: 1 }))).toBeInTheDocument()
  })
})

describe('StatisticsTab · empty other-list (total 1)', () => {
  it('shows the italic muted empty note when this is the only match on the axis', () => {
    const match = row({ id: 'm1', candidateId: 'c1' })
    renderTab(match, [match])
    const note = screen.getByText(i18n.t('matches:drawer.statistics.onlyMatch'))
    expect(note).toBeInTheDocument()
    expect(note).toHaveStyle({ fontStyle: 'italic' })
  })
})

describe('StatisticsTab · other matches list (compact clickable rows)', () => {
  it('renders the other party, vacancy, status and period, oldest-first, excluding this match', async () => {
    const user = userEvent.setup()
    const match = row({
      id: 'm2', candidateId: 'c1', client: 'Zorggroep Noord', vacancy: 'Verpleegkundige', date: '2026-02-01',
    })
    const other = row({
      id: 'm1', candidateId: 'c1', client: 'Acme Zorg', vacancy: 'Verzorgende IG', date: '2026-01-01',
      startDate: '2026-01-01', endDate: '2026-06-30', status: 'open',
    })
    renderTab(match, [match, other])

    // Position 2 of 2 — the SAME phrasing the old ordinal footnote used.
    expect(screen.getByText(i18n.t('matches:drawer.ordinal.candidate', { position: 2, total: 2 }))).toBeInTheDocument()
    // The other match's own client (the "other party" on the candidate axis) + vacancy.
    expect(screen.getByText('Acme Zorg')).toBeInTheDocument()
    expect(screen.getByText('Verzorgende IG')).toBeInTheDocument()
    expect(screen.getByText('Open')).toBeInTheDocument()
    // Eindcontrole 22-08: the title promised PERIOD and OLDEST-FIRST — assert both.
    expect(screen.getByText(/01-01-2026/)).toBeInTheDocument()
    expect(screen.getByText(/30-06-2026/)).toBeInTheDocument()

    await user.click(screen.getByText('Acme Zorg'))
    expect(mockOpenEntity).toHaveBeenCalledWith('matches', 'm1')
  })

  it('orders the other matches oldest-first', () => {
    const match = row({ id: 'm3', candidateId: 'c1', date: '2026-03-01' })
    const older = row({ id: 'm1', candidateId: 'c1', client: 'Oudste BV', date: '2026-01-01' })
    const newer = row({ id: 'm2', candidateId: 'c1', client: 'Nieuwer BV', date: '2026-02-01' })
    renderTab(match, [newer, match, older])
    const oldest = screen.getByText('Oudste BV')
    const middle = screen.getByText('Nieuwer BV')
    expect(oldest.compareDocumentPosition(middle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
