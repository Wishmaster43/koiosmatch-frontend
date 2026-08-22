/**
 * OpportunityKoiosBlock — ALWAYS renders (Danny: mirrors matches/candidates,
 * the Koios AI block must never disappear). With no real advice it still
 * shows the honest derived default rows (buildOpportunityAdviceInsights); with
 * real advice (an overdue, still-open deal) the table-identical advice row
 * (KOIOS-ADVIES-OVERAL-1) leads, followed by the same default rows.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
// Real i18n (nl) side-effect init so opportunities:ai.* and common:koios.* resolve genuine Dutch text.
import '@/i18n'
import OpportunityKoiosBlock from './OpportunityKoiosBlock'
import type { Opportunity } from '@/types/opportunity'
import type { LookupOption } from '@/types/common'

const stages: LookupOption[] = [
  { value: 'open', label: 'Open' },
  { value: 'won', label: 'Gewonnen', isWon: true },
]

const clean = {
  id: 'o1', title: 'Deal A', description: '', initials: 'DA', client: 'Acme', clientId: 'c1',
  stage: 'Open', stageValue: 'open', value: null, hours: null, expectedCloseAt: null,
} as unknown as Opportunity

describe('OpportunityKoiosBlock · always visible', () => {
  it('renders the Koios AI heading even with a clean deal (no advice)', () => {
    render(<OpportunityKoiosBlock opportunity={clean} stages={stages} />)
    // Real nl translation for opportunities:ai.title.
    expect(screen.getByText('Koios AI adviseert')).toBeInTheDocument()
  })

  it('shows the honest derived default rows (deal health + close window) with no advice', () => {
    render(<OpportunityKoiosBlock opportunity={clean} stages={stages} />)
    // Real nl translations for opportunities:ai.dealHealthLabel / ai.closeWindowLabel.
    expect(screen.getByText('Dealomvang')).toBeInTheDocument()
    expect(screen.getByText('Sluitingsdatum')).toBeInTheDocument()
  })

  it('still leads with the table-identical advice row for an overdue, still-open deal', () => {
    const overdue = { ...clean, expectedCloseAt: '2000-01-01' }
    render(<OpportunityKoiosBlock opportunity={overdue} stages={stages} />)
    // Real nl translation for common:koios.actions.follow_up — same label the
    // table's Koios column shows for the identical row (OpportunitiesTable.test.tsx).
    expect(screen.getByText('Opvolgen')).toBeInTheDocument()
    // The default rows still follow — the block never swaps one for the other.
    expect(screen.getByText('Dealomvang')).toBeInTheDocument()
    expect(screen.getByText('Sluitingsdatum')).toBeInTheDocument()
  })

  it('shows the terminal close-window note for a won deal, even with an overdue close date', () => {
    const won = { ...clean, stageValue: 'won', expectedCloseAt: '2000-01-01' }
    render(<OpportunityKoiosBlock opportunity={won} stages={stages} />)
    // No advice row (won is terminal — the table never flags a closed deal either).
    expect(screen.queryByText('Opvolgen')).not.toBeInTheDocument()
  })
})
