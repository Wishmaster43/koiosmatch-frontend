/**
 * MatchListBody — the shared header+empty+map shell for a flat MatchCard list
 * (KLANTEN 4, Danny 21-08 "Weergeven zoals bij de kandidaat" — "Display it like
 * on the candidate"): the SectionCard wrapper, the column-header bar
 * (MatchListHeaderBar) and the empty/populated branch were repeated verbatim
 * across the candidate, customer and vacancy drawer Matches tabs (DRY round 11,
 * MATCHLISTS). The per-row card body stays with each consumer as the `renderRow`
 * render prop — the three tabs pass different MatchCard prop lists (candidate:
 * onEdit/vacancyUrl/helloflexGuid; customer/vacancy: helloflexLink/
 * shiftmanagerLink/contractForm), so unifying that part would collapse real
 * per-entity differences into one copy (rule B never applies here).
 * Column header bar: Danny 09-08 ("Match heeft geen titelbalk en sollicitaties wel") —
 * promoted to the shared MatchListHeaderBar (KLANTEN 4, 21-08); this shell renders it once
 * for every matches tab so the header can never drift per entity again.
 */
import type { ReactNode } from 'react'
import SectionCard from '@/components/ui/SectionCard'
import SubListEmpty from './SubListEmpty'
import { MatchListHeaderBar } from '@/pages/matches/shared'

interface MatchListBodyProps<M> {
  /** The "other side" column label (Klant/Kandidaat) — same prop MatchListHeaderBar takes. */
  otherPartyLabel: string
  /** DRAWER-UX-1: swaps which column leads (customer/vacancy tabs lead with the candidate). */
  leadWithOtherParty?: boolean
  /** Vacancy tab hides its own (redundant) vacancy column. */
  showVacancyColumn?: boolean
  matches: M[]
  /** Resolved by the caller's own t() (rule C) — shown only when `matches` is empty. */
  emptyText: string
  /** Per-row card body — stays with the consumer so each entity's own MatchCard prop list is untouched. */
  renderRow: (match: M, index: number) => ReactNode
}

// Shared shell (SectionCard + column header + empty/populated branch) for a flat
// MatchCard list — the per-row render stays a caller-supplied render prop (see file header).
export default function MatchListBody<M>({
  otherPartyLabel, leadWithOtherParty, showVacancyColumn, matches, emptyText, renderRow,
}: MatchListBodyProps<M>) {
  return (
    <SectionCard>
      <MatchListHeaderBar otherPartyLabel={otherPartyLabel} leadWithOtherParty={leadWithOtherParty} showVacancyColumn={showVacancyColumn} />
      {matches.length === 0 ? (
        <SubListEmpty text={emptyText} />
      ) : matches.map(renderRow)}
    </SectionCard>
  )
}
