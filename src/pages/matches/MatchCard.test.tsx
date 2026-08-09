/**
 * MatchCard — the ONE shared match card body (Danny's ten-point round, points
 * 2/4/5/6). Covers: the title merges vacancy + fase on one line with no
 * separate Fase row, the Periode row formats/falls back, Functie/Vestiging/
 * Eigenaar render off the new fields, and the expiry chip appears within 30
 * days (warning) / past due (danger) / never on a closed match.
 *
 * Real i18n is loaded here (side-effect import, mirrors customers/drawer/
 * MatchesTab.test.tsx's own `ct()` helper): MatchCard uses `useDateFormat`
 * (lib/datetime), which itself imports `@/i18n` for its locale map, so a raw-
 * key stub would be dishonest about what actually renders — real copy is the
 * only assertion that can't quietly rot.
 *
 * The system clock is frozen (vi.setSystemTime) rather than computed inline,
 * per §13 — MatchCard itself never takes a `now` override, so this is the
 * only way to pin the expiry-chip assertions to a fixed date.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import i18n from '@/i18n'
import MatchCard from './MatchCard'
import { MATCH_COL_STATUS, MATCH_COL_OTHER_PARTY, MATCH_COL_SCORE, MATCH_COL_ACTIONS } from './matchRowColumns'

const ct = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'candidates', ...opts })
const cm = (key: string) => i18n.t(key, { ns: 'common' })

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-08-03T10:00:00'))
})
afterEach(() => { vi.useRealTimers() })

const base = {
  id: 'm-1', vacancyId: 'vac-1', vacancyTitle: 'Verpleegkundige',
  otherPartyLabel: 'Kandidaat', otherPartyValue: 'Jane Doe',
}

describe('MatchCard · title (point 2)', () => {
  it('renders vacancy + fase on one line, no separate Fase/Stage row', () => {
    // eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
    render(<MatchCard {...base} stageLabel="Voorgesteld" stageColor="#123456" />)
    expect(screen.getByText('Verpleegkundige')).toBeInTheDocument()
    expect(screen.getByText('Voorgesteld')).toBeInTheDocument()
    // The dedicated "Fase" row label is no longer rendered anywhere on the card.
    expect(screen.queryByText(ct('matchesView.stage'))).toBeNull()
  })

  it('renders no fase suffix at all when the match carries no stage', () => {
    render(<MatchCard {...base} />)
    expect(screen.getByText('Verpleegkundige')).toBeInTheDocument()
  })
})

describe('MatchCard · Periode row (point 4)', () => {
  it('formats a full start–end range as DD-MM-YYYY', () => {
    render(<MatchCard {...base} startDate="2026-01-01" endDate="2026-12-31" />)
    expect(screen.getByText('01-01-2026 – 31-12-2026')).toBeInTheDocument()
  })

  it('renders a single em-dash when neither date is known', () => {
    render(<MatchCard {...base} startDate={null} endDate={null} />)
    // Contract rows all default to '—' too — assert at least one exists (the
    // Periode row specifically is covered by the absence of any date text).
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    expect(screen.queryByText(/–/)).toBeNull()
  })
})

describe('MatchCard · Functie/Vestiging/Eigenaar rows (point 5)', () => {
  it('renders the three new rows off the row\'s own fields', () => {
    render(<MatchCard {...base} functionTitle="Verzorgende IG" branchName="Hoofdkantoor" ownerName="Piet Recruiter" />)
    expect(screen.getByText('Verzorgende IG')).toBeInTheDocument()
    expect(screen.getByText('Hoofdkantoor')).toBeInTheDocument()
    expect(screen.getByText('Piet Recruiter')).toBeInTheDocument()
  })

  it('falls back to em-dash when a field is absent (e.g. the candidate-embedded resource has no branch/owner)', () => {
    render(<MatchCard {...base} functionTitle={null} branchName={null} ownerName={null} />)
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3)
  })
})

describe('MatchCard · expiry chip (point 6)', () => {
  it('shows a warning chip within 30 days of the end date', () => {
    render(<MatchCard {...base} endDate="2026-08-20" />)
    expect(screen.getByText(ct('matchesView.expiresOn', { date: '20-08-2026' }))).toBeInTheDocument()
  })

  it('does not show a chip more than 30 days out', () => {
    render(<MatchCard {...base} endDate="2026-12-31" />)
    expect(screen.queryByText(/Loopt af op|Afgelopen op/)).toBeNull()
  })

  it('shows a danger chip once the end date has passed', () => {
    render(<MatchCard {...base} endDate="2026-07-01" />)
    expect(screen.getByText(ct('matchesView.expiredOn', { date: '01-07-2026' }))).toBeInTheDocument()
  })

  it('never shows a chip for a closed match, even within the window', () => {
    render(<MatchCard {...base} endDate="2026-08-10" isClosed />)
    expect(screen.queryByText(/Loopt af op/)).toBeNull()
  })

  it('never shows a chip for an archived match', () => {
    render(<MatchCard {...base} endDate="2026-08-10" archived />)
    expect(screen.queryByText(/Loopt af op/)).toBeNull()
  })
})

describe('MatchCard · header affordances', () => {
  it('renders the "Open match" anchor with the deep-link href', () => {
    render(<MatchCard {...base} />)
    const link = screen.getByTitle(ct('matchesView.openMatch'))
    expect(link.tagName).toBe('A')
    expect(link.getAttribute('href')).toContain('?open=m-1')
    expect(link.getAttribute('target')).toBe('_blank')
  })

  it('renders no "Open match" anchor when id is absent', () => {
    render(<MatchCard {...base} id={null} />)
    expect(screen.queryByTitle(ct('matchesView.openMatch'))).toBeNull()
  })

  it('renders the edit pencil only when onEdit is provided', () => {
    const onEdit = vi.fn()
    const { rerender } = render(<MatchCard {...base} onEdit={onEdit} />)
    expect(screen.getByTitle(cm('edit'))).toBeInTheDocument()
    rerender(<MatchCard {...base} />)
    expect(screen.queryByTitle(cm('edit'))).toBeNull()
  })
})

/**
 * flatRow (Danny 09-08, candidate drawer consistency sweep: "achtergrondkleur
 * van Match en sollicitatie kloppen niet"). Opt-in and OFF by default so the
 * customer drawer's own MatchesTab (never passes `flatRow`) renders exactly
 * the tinted header it always has — only a caller that explicitly opts in
 * gets the flat surface background.
 */
describe('MatchCard · flatRow (Danny 09-08)', () => {
  it('defaults to the tinted --bg header (every OTHER caller stays unchanged)', () => {
    render(<MatchCard {...base} />)
    expect(screen.getByTestId('match-card-header')).toHaveStyle({ background: 'var(--bg)' })
  })

  it('renders the plain surface background when flatRow is set', () => {
    render(<MatchCard {...base} flatRow />)
    expect(screen.getByTestId('match-card-header')).toHaveStyle({ background: 'var(--surface)' })
  })
})

/**
 * COLUMN SPLIT (Danny 09-08, second look — "Open heeft geen kopje??"): the
 * flatRow variant used to glue the stage onto the title behind an em-dash and
 * show the score as an unlabeled dash between the client name and the icon
 * cluster — two headerless columns. Both now render in their own fixed-width
 * cell, reading the SAME widths candidates/drawer/MatchesTab.tsx's header bar
 * reads from matchRowColumns.ts (never two loose numbers).
 */
describe('MatchCard · flatRow column split (Danny 09-08 second look)', () => {
  // eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
  const flat = { ...base, stageLabel: 'Voorgesteld', stageColor: '#123456', score: 82, collapsible: true, flatRow: true }

  it('drops the merged "— {fase}" title suffix — the stage renders in its own Status column instead', () => {
    const { container } = render(<MatchCard {...flat} />)
    expect(screen.getByRole('button', { name: 'Verpleegkundige' })).toBeInTheDocument()
    // The old merged form ("Verpleegkundige — Voorgesteld") is gone from the title...
    expect(container.textContent).not.toContain('— Voorgesteld')
    // ...the stage now lives in its own labeled column.
    expect(screen.getByTestId('match-col-status')).toHaveTextContent('Voorgesteld')
  })

  it('renders the score in its own column, not inline with the icon cluster', () => {
    render(<MatchCard {...flat} />)
    expect(screen.getByTestId('match-col-score')).toHaveTextContent('82%')
    expect(screen.getByTestId('match-col-actions')).not.toHaveTextContent('82%')
  })

  it('reads the Status/Client/Score/Actions cell widths from the SAME matchRowColumns constants the header reads', () => {
    render(<MatchCard {...flat} />)
    expect(screen.getByTestId('match-col-status')).toHaveStyle({ width: `${Number(MATCH_COL_STATUS.width)}px` })
    expect(screen.getByTestId('match-col-client')).toHaveStyle({ width: `${Number(MATCH_COL_OTHER_PARTY.width)}px` })
    expect(screen.getByTestId('match-col-score')).toHaveStyle({ width: `${Number(MATCH_COL_SCORE.width)}px` })
    expect(screen.getByTestId('match-col-actions')).toHaveStyle({ width: `${Number(MATCH_COL_ACTIONS.width)}px` })
  })

  it('keeps the merged title and renders no separate Status/Score columns when collapsible without flatRow (no current caller, kept for compatibility)', () => {
    render(<MatchCard {...flat} flatRow={false} />)
    expect(screen.queryByTestId('match-col-status')).toBeNull()
    expect(screen.queryByTestId('match-col-score')).toBeNull()
    expect(screen.getByText('Voorgesteld')).toBeInTheDocument()
  })
})
