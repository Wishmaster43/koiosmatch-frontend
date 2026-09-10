/**
 * MatchListBody — behaviour: the empty state and the per-row render prop.
 * Byte-identity (rule F, DRY round 11 MATCHLISTS): the shell markup (SectionCard
 * + MatchListHeaderBar + empty/populated branch) matches what the candidate/
 * customer/vacancy MatchesTab bodies rendered inline before this extraction,
 * proven via react-dom/server against the same building blocks assembled by
 * hand (never jsdom, which would not expose a hidden ordering/prop drift).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
// Side-effect import: the real i18next instance, so MatchListHeaderBar's own
// useTranslation resolves actual copy (mirrors MatchCard.test.tsx) rather than
// warning/returning raw keys.
import '@/i18n'
import SectionCard from '@/components/ui/SectionCard'
import { MatchListHeaderBar } from '@/pages/matches/shared'
import SubListEmpty from './SubListEmpty'
import MatchListBody from './MatchListBody'

interface Row { id: string }

describe('MatchListBody · behaviour', () => {
  it('renders the empty text when matches is empty', () => {
    render(<MatchListBody otherPartyLabel="Kandidaat" matches={[]} emptyText="Nog geen matches" renderRow={() => null} />)
    expect(screen.getByText('Nog geen matches')).toBeInTheDocument()
  })

  it('calls renderRow once per match with (match, index) and renders its output, never the empty text', () => {
    const matches: Row[] = [{ id: 'a' }, { id: 'b' }]
    const renderRow = vi.fn((m: Row, i: number) => <div key={m.id}>{`row-${m.id}-${i}`}</div>)
    render(<MatchListBody otherPartyLabel="Kandidaat" matches={matches} emptyText="Nog geen matches" renderRow={renderRow} />)
    // Array.prototype.map also passes the source array as a 3rd argument — assert
    // only the (match, index) pair MatchListBody's own contract promises.
    expect(renderRow).toHaveBeenCalledTimes(2)
    expect(renderRow.mock.calls[0][0]).toBe(matches[0])
    expect(renderRow.mock.calls[0][1]).toBe(0)
    expect(renderRow.mock.calls[1][0]).toBe(matches[1])
    expect(renderRow.mock.calls[1][1]).toBe(1)
    expect(screen.getByText('row-a-0')).toBeInTheDocument()
    expect(screen.getByText('row-b-1')).toBeInTheDocument()
    expect(screen.queryByText('Nog geen matches')).toBeNull()
  })
})

describe('MatchListBody · byte-identical shell (rule F)', () => {
  // Candidate tab's own shape: no leadWithOtherParty, no showVacancyColumn override.
  it('matches the HEAD SectionCard+MatchListHeaderBar+empty block (candidate shape)', () => {
    const headMarkup = renderToStaticMarkup(
      <SectionCard>
        <MatchListHeaderBar otherPartyLabel="Klant" />
        <SubListEmpty text="Nog geen matches" />
      </SectionCard>
    )
    const newMarkup = renderToStaticMarkup(
      <MatchListBody otherPartyLabel="Klant" matches={[]} emptyText="Nog geen matches" renderRow={() => null} />
    )
    expect(newMarkup).toBe(headMarkup)
  })

  // Customer tab's own shape: leadWithOtherParty (vacancy column stays visible).
  it('matches the HEAD block (customer shape: leadWithOtherParty)', () => {
    const headMarkup = renderToStaticMarkup(
      <SectionCard>
        <MatchListHeaderBar otherPartyLabel="Kandidaat" leadWithOtherParty />
        <SubListEmpty text="Nog geen matches" />
      </SectionCard>
    )
    const newMarkup = renderToStaticMarkup(
      <MatchListBody otherPartyLabel="Kandidaat" leadWithOtherParty matches={[]} emptyText="Nog geen matches" renderRow={() => null} />
    )
    expect(newMarkup).toBe(headMarkup)
  })

  // Vacancy tab's own shape: leadWithOtherParty + showVacancyColumn={false}.
  it('matches the HEAD block (vacancy shape: leadWithOtherParty + showVacancyColumn=false)', () => {
    const headMarkup = renderToStaticMarkup(
      <SectionCard>
        <MatchListHeaderBar otherPartyLabel="Kandidaat" leadWithOtherParty showVacancyColumn={false} />
        <SubListEmpty text="Nog geen matches" />
      </SectionCard>
    )
    const newMarkup = renderToStaticMarkup(
      <MatchListBody otherPartyLabel="Kandidaat" leadWithOtherParty showVacancyColumn={false}
        matches={[]} emptyText="Nog geen matches" renderRow={() => null} />
    )
    expect(newMarkup).toBe(headMarkup)
  })

  // Populated branch (matches.map(renderRow)): the map result renders exactly
  // where the HEAD's own inline map did, inside the same SectionCard+header shell.
  it('matches the HEAD block when populated (map replaces the empty branch, same shell)', () => {
    const row = <div key="1">Row content</div>
    const headMarkup = renderToStaticMarkup(
      <SectionCard>
        <MatchListHeaderBar otherPartyLabel="Kandidaat" leadWithOtherParty />
        {row}
      </SectionCard>
    )
    const newMarkup = renderToStaticMarkup(
      <MatchListBody otherPartyLabel="Kandidaat" leadWithOtherParty matches={[{ id: '1' }]} emptyText="Nog geen matches"
        renderRow={m => <div key={m.id}>Row content</div>} />
    )
    expect(newMarkup).toBe(headMarkup)
  })
})
