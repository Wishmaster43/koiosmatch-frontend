/**
 * PriceAgreementForm · K11d (13-08) regression: the remarks RichTextEditor now
 * receives `expanded`/`onToggleExpand` (the Maximize2 button only renders when
 * `onToggleExpand` is passed — RichTextEditor.tsx:186) — Genereer/pop-out stay
 * out per KD9, only the expand toggle ships. RichTextEditor itself is mocked
 * (mirrors CollapsibleRichText.test.tsx) so this test asserts the PROP wiring,
 * not RichTextEditor's own internals.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PriceAgreementForm, { emptyDraft, isDraftValid } from './PriceAgreementForm'

vi.mock('@/lib/useFunctions', () => ({ useFunctions: () => ({ functions: [] }) }))
vi.mock('@/lib/useCao', () => ({ useCao: () => ({ types: [] }) }))
// MATCH-FIN-GATE-1: purchase rate is gated on matches.financial.view; every
// existing test in this file renders as a permitted viewer.
const mockHasPermission = vi.fn()
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: mockHasPermission }) }))
beforeEach(() => { mockHasPermission.mockImplementation(() => true) })
vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ expanded, onToggleExpand }: { expanded?: boolean; onToggleExpand?: () => void }) => (
    <div data-testid="rte">
      <span data-testid="expanded-state">{String(!!expanded)}</span>
      {onToggleExpand && <button onClick={onToggleExpand}>toggle-expand</button>}
    </div>
  ),
}))

describe('PriceAgreementForm · K11d remarks expand toggle', () => {
  it('wires onToggleExpand/expanded into the remarks RichTextEditor', async () => {
    const user = userEvent.setup()
    render(
      <PriceAgreementForm draft={emptyDraft()} onChange={vi.fn()} onSave={vi.fn()} onCancel={vi.fn()}
        saveLabel="save" />
    )
    expect(screen.getByTestId('expanded-state')).toHaveTextContent('false')
    await user.click(screen.getByText('toggle-expand'))
    expect(screen.getByTestId('expanded-state')).toHaveTextContent('true')
  })
})

// MATCH-FIN-GATE-1 (Danny 14-08, "de marge op een plaatsing, autorisatie").
describe('PriceAgreementForm · financial permission gate', () => {
  it('shows the purchase rate field alongside the sale rate with the permission', () => {
    render(<PriceAgreementForm draft={emptyDraft()} onChange={vi.fn()} onSave={vi.fn()} onCancel={vi.fn()} saveLabel="save" />)
    expect(screen.getByText('priceAgreements.purchaseRate')).toBeInTheDocument()
    expect(screen.getByText('priceAgreements.saleRate')).toBeInTheDocument()
  })

  it('hides the purchase rate field without the permission, keeping the sale rate', () => {
    mockHasPermission.mockImplementation(() => false)
    render(<PriceAgreementForm draft={emptyDraft()} onChange={vi.fn()} onSave={vi.fn()} onCancel={vi.fn()} saveLabel="save" />)
    expect(screen.queryByText('priceAgreements.purchaseRate')).toBeNull()
    expect(screen.getByText('priceAgreements.saleRate')).toBeInTheDocument()
  })

  it('asks for exactly matches.financial.view, not a neighbouring permission', () => {
    render(<PriceAgreementForm draft={emptyDraft()} onChange={vi.fn()} onSave={vi.fn()} onCancel={vi.fn()} saveLabel="save" />)
    expect(mockHasPermission).toHaveBeenCalledWith('matches.financial.view')
  })

  it('no longer requires purchaseRate for a valid draft once the field is hidden', () => {
    const draft = { ...emptyDraft(), validFrom: '2026-01-01' }
    expect(isDraftValid(draft, true)).toBe(false)
    expect(isDraftValid(draft, false)).toBe(true)
  })
})
