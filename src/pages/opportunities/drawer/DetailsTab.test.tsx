/**
 * DetailsTab — DRILLDOWN-VOLGORDE-CANON (Danny 21-08) block order: deal fields
 * → "Kanstekst" (OPP-DESCRIPTION-1) → Koios AI → vestiging. The "Kanstekst"
 * block's `onSave` PATCHes straight through onUpdate as `{ description }`
 * (mapped to the real API field by useOpportunitiesData — see that hook's own
 * PATCH-mapping test). The deal-fields EditableFieldTable itself already has
 * broad coverage via the shared component's own tests, so this file focuses
 * on the description wiring, the block order and the read-only branch section.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within, renderHook } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Real i18n (nl) instance so common:edit/save (OpportunityDescriptionBlock)
// resolve genuine Dutch text — mirrors OpportunityDrawer.test.tsx. Kept as a
// binding so the Koios tests below can read the shared common:ai.title copy.
import i18n from '@/i18n'
import DetailsTab from './DetailsTab'
import { useOpportunityAdvice } from '@/lib/useOpportunityAdvice'
import type { Opportunity } from '@/types/opportunity'
import type { LookupOption } from '@/types/common'

vi.mock('@/lib/useOpportunityLookups', () => ({
  useOpportunityServiceTypes: () => ({ serviceTypes: [] }),
  useOpportunityAgreementTypes: () => ({ agreementTypes: [] }),
}))
// Tiptap needs a real browser to mount — stubbed with a plain controlled textarea.
vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange }: { value?: string; onChange: (v: string) => void }) => (
    <textarea data-testid="rte" value={value ?? ''} onChange={e => onChange(e.target.value)} />
  ),
}))

const baseOpportunity = { id: 'opp-1', title: 'Deal A', description: '' } as unknown as Opportunity

// The deal-fields EditableFieldTable ALSO renders a "Bewerken" pencil (its own
// onUpdate wiring), so the description block's own pencil is scoped to its
// header row — the label span's parent — rather than a bare getByTitle.
// KANSOMSCHRIJVING-1: the block's own entity-named heading ("Kansomschrijving"),
// no longer the generic "Omschrijving" (details.groups.description stays as-is
// for the popout/other consumers — see OpportunityDescriptionBlock.tsx).
const descriptionEditButton = () =>
  within(screen.getByText('Kansomschrijving').parentElement as HTMLElement).getByTitle('Bewerken')
const descriptionSaveButton = () =>
  within(screen.getByText('Kansomschrijving').parentElement as HTMLElement).getByTitle('Opslaan')

describe('DetailsTab · Kanstekst wiring (OPP-DESCRIPTION-1)', () => {
  it('renders the description block below the deal fields (DRILLDOWN-VOLGORDE-CANON)', () => {
    render(<DetailsTab opportunity={baseOpportunity} onUpdate={() => {}} />)
    // Real nl translation for opportunities:details.groups.deal ("Deal") and
    // details.groups.opportunityDescription ("Kansomschrijving").
    const dealLabel = screen.getByText('Deal')
    const descriptionLabel = screen.getByText('Kansomschrijving')
    expect(dealLabel).toBeInTheDocument()
    expect(descriptionLabel).toBeInTheDocument()
    // DOCUMENT_POSITION_FOLLOWING: the description card comes AFTER the deal
    // card in DOM order — the canon fix, deal fields now lead.
    expect(dealLabel.compareDocumentPosition(descriptionLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('calls onUpdate with { description } — the id + PATCH-ready patch shape', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()
    render(<DetailsTab opportunity={baseOpportunity} onUpdate={onUpdate} />)

    await user.click(descriptionEditButton())
    await user.type(screen.getByTestId('rte'), '<p>Nieuwe kanstekst</p>')
    await user.click(descriptionSaveButton())

    expect(onUpdate).toHaveBeenCalledWith('opp-1', { description: '<p>Nieuwe kanstekst</p>' })
  })

  it('saves description: null when the block is cleared to empty', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()
    const filled = { ...baseOpportunity, description: '<p>Was hier</p>' } as unknown as Opportunity
    render(<DetailsTab opportunity={filled} onUpdate={onUpdate} />)

    await user.click(descriptionEditButton())
    await user.clear(screen.getByTestId('rte'))
    await user.click(descriptionSaveButton())

    expect(onUpdate).toHaveBeenCalledWith('opp-1', { description: null })
  })

  it('regression: still saves description: null when the editor emits the TipTap empty-paragraph artifact, not a bare \'\'', async () => {
    // Measured live (08-08): a real TipTap editor left empty emits '<p></p>',
    // not '' — a naive `html || null` check treats that non-empty string as
    // "has text" and PATCHes the literal markup. Typing it into the stubbed
    // textarea reproduces exactly what the real editor's onChange would emit.
    const user = userEvent.setup()
    const onUpdate = vi.fn()
    const filled = { ...baseOpportunity, description: '<p>Was hier</p>' } as unknown as Opportunity
    render(<DetailsTab opportunity={filled} onUpdate={onUpdate} />)

    await user.click(descriptionEditButton())
    await user.clear(screen.getByTestId('rte'))
    await user.type(screen.getByTestId('rte'), '<p></p>')
    await user.click(descriptionSaveButton())

    expect(onUpdate).toHaveBeenCalledWith('opp-1', { description: null })
  })
})

// KOIOS-ADVIES-OVERAL-1 + ALWAYS-VISIBLE (Danny, mirrors matches/candidates):
// the drawer's advice section shows EXACTLY the advice the opportunities
// table's Koios column derives — asserted through the SAME resolver
// (useOpportunityAdvice), never a copied literal — but the block itself now
// ALWAYS renders (honest derived default rows take over when there is no
// real advice; see OpportunityKoiosBlock.test.tsx for the block's own coverage).
describe('DetailsTab · table-identical Koios advice (KOIOS-ADVIES-OVERAL-1)', () => {
  const stages: LookupOption[] = [
    { value: 'open', label: 'Open' },
    { value: 'won', label: 'Gewonnen', isWon: true },
  ]
  // Resolve the advice through the shared hook, exactly as OpportunitiesTable does.
  const resolveVia = (o: Opportunity) => renderHook(() => useOpportunityAdvice(stages)).result.current(o)
  const overdueDeal = { ...baseOpportunity, stageValue: 'open', expectedCloseAt: '2026-01-01' } as unknown as Opportunity

  it('shows the block with the same label the table pill derives for an overdue open deal', () => {
    const expected = resolveVia(overdueDeal)?.label
    expect(expected).toBeTruthy()
    render(<DetailsTab opportunity={overdueDeal} onUpdate={vi.fn()} stages={stages} />)
    expect(screen.getByText(expected as string)).toBeInTheDocument()
    expect(screen.getByText(i18n.t('ai.title', { ns: 'opportunities' }))).toBeInTheDocument()
  })

  it('still renders the block on a clean deal (resolver returns null) — honest default rows, no fake advice', () => {
    expect(resolveVia(baseOpportunity)).toBeNull()
    render(<DetailsTab opportunity={baseOpportunity} onUpdate={vi.fn()} stages={stages} />)
    expect(screen.getByText(i18n.t('ai.title', { ns: 'opportunities' }))).toBeInTheDocument()
    // Real nl translation for opportunities:ai.dealHealthLabel — the derived
    // default row, present even though there is no resolved advice.
    expect(screen.getByText(i18n.t('ai.dealHealthLabel', { ns: 'opportunities' }))).toBeInTheDocument()
    // The specific advice label from the overdue-deal test above must be absent here.
    expect(screen.queryByText(resolveVia(overdueDeal)?.label as string)).not.toBeInTheDocument()
  })

  it('still renders the block on a WON deal — terminal close-window note, no advice row', () => {
    const wonDeal = { ...overdueDeal, stageValue: 'won' } as unknown as Opportunity
    expect(resolveVia(wonDeal)).toBeNull()
    render(<DetailsTab opportunity={wonDeal} onUpdate={vi.fn()} stages={stages} />)
    expect(screen.getByText(i18n.t('ai.title', { ns: 'opportunities' }))).toBeInTheDocument()
    expect(screen.queryByText(resolveVia(overdueDeal)?.label as string)).not.toBeInTheDocument()
  })
})

// DRILLDOWN-VOLGORDE-CANON: vestiging (C-41's tenant branch) LAST, read-only —
// mirrors matches/drawer/OverviewTab.tsx's bottom block exactly.
describe('DetailsTab · vestiging last, read-only (DRILLDOWN-VOLGORDE-CANON)', () => {
  it('shows the linked branch as a read-only chip, with no add/remove affordance', () => {
    const withBranch = { ...baseOpportunity, branch: 'Bureau Amsterdam' } as unknown as Opportunity
    render(<DetailsTab opportunity={withBranch} onUpdate={vi.fn()} />)
    // Real nl translation for candidates:matchesView.branch is "Vestiging".
    expect(screen.getByText('Vestiging')).toBeInTheDocument()
    expect(screen.getByText('Bureau Amsterdam')).toBeInTheDocument()
    // readOnly hides BranchSection's own remove (×) button.
    expect(screen.queryByLabelText('Verwijderen')).toBeNull()
  })

  it('shows the honest empty state when no branch is linked', () => {
    render(<DetailsTab opportunity={baseOpportunity} onUpdate={vi.fn()} />)
    // Real nl translation for candidates:sections.branchEmpty.
    expect(screen.getByText('Nog geen vestiging gekoppeld.')).toBeInTheDocument()
  })

  it('renders the vestiging block AFTER the Koios advice block', () => {
    const withBranch = { ...overdueDealStages(), branch: 'Bureau Amsterdam' } as unknown as Opportunity
    const stages: LookupOption[] = [{ value: 'open', label: 'Open' }]
    render(<DetailsTab opportunity={withBranch} onUpdate={vi.fn()} stages={stages} />)
    const koiosLabel = screen.getByText(i18n.t('ai.title', { ns: 'opportunities' }))
    const branchLabel = screen.getByText('Vestiging')
    expect(koiosLabel.compareDocumentPosition(branchLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

// Helper: a deal whose Koios advice block is guaranteed to render (overdue, open).
function overdueDealStages(): Opportunity {
  return { ...baseOpportunity, stageValue: 'open', expectedCloseAt: '2026-01-01' } as unknown as Opportunity
}
