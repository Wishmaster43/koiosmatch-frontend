/**
 * DetailsTab — OPP-DESCRIPTION-1 wiring: the "Kanstekst" block sits above the
 * deal fields and its `onSave` PATCHes straight through onUpdate as
 * `{ description }` (mapped to the real API field by useOpportunitiesData —
 * see that hook's own PATCH-mapping test). The deal-fields EditableFieldTable
 * itself already has broad coverage via the shared component's own tests, so
 * this file focuses on the new description wiring only.
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
const descriptionEditButton = () =>
  within(screen.getByText('Omschrijving').parentElement as HTMLElement).getByTitle('Bewerken')
const descriptionSaveButton = () =>
  within(screen.getByText('Omschrijving').parentElement as HTMLElement).getByTitle('Opslaan')

describe('DetailsTab · Kanstekst wiring (OPP-DESCRIPTION-1)', () => {
  it('renders the description block above the deal fields', () => {
    render(<DetailsTab opportunity={baseOpportunity} onUpdate={() => {}} />)
    // Real nl translation for opportunities:details.groups.description; 'deal'
    // resolves to "Deal".
    expect(screen.getByText('Omschrijving')).toBeInTheDocument()
    expect(screen.getByText('Deal')).toBeInTheDocument()
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

// KOIOS-ADVIES-OVERAL-1: the drawer's advice section shows EXACTLY the advice
// the opportunities table's Koios column derives — asserted through the SAME
// resolver (useOpportunityAdvice), never a copied literal. With no advice the
// whole section stays unmounted (no empty shell).
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
    expect(screen.getByText(i18n.t('ai.title', { ns: 'common' }))).toBeInTheDocument()
  })

  it('renders NO advice block at all on a clean deal (resolver returns null)', () => {
    expect(resolveVia(baseOpportunity)).toBeNull()
    render(<DetailsTab opportunity={baseOpportunity} onUpdate={vi.fn()} stages={stages} />)
    expect(screen.queryByText(i18n.t('ai.title', { ns: 'common' }))).not.toBeInTheDocument()
  })

  it('renders NO advice block on a WON deal even when its close date has passed', () => {
    const wonDeal = { ...overdueDeal, stageValue: 'won' } as unknown as Opportunity
    expect(resolveVia(wonDeal)).toBeNull()
    render(<DetailsTab opportunity={wonDeal} onUpdate={vi.fn()} stages={stages} />)
    expect(screen.queryByText(i18n.t('ai.title', { ns: 'common' }))).not.toBeInTheDocument()
  })
})
