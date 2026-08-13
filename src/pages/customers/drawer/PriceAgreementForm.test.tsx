/**
 * PriceAgreementForm · K11d (13-08) regression: the remarks RichTextEditor now
 * receives `expanded`/`onToggleExpand` (the Maximize2 button only renders when
 * `onToggleExpand` is passed — RichTextEditor.tsx:186) — Genereer/pop-out stay
 * out per KD9, only the expand toggle ships. RichTextEditor itself is mocked
 * (mirrors CollapsibleRichText.test.tsx) so this test asserts the PROP wiring,
 * not RichTextEditor's own internals.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PriceAgreementForm, { emptyDraft } from './PriceAgreementForm'

vi.mock('@/lib/useFunctions', () => ({ useFunctions: () => ({ functions: [] }) }))
vi.mock('@/lib/useCao', () => ({ useCao: () => ({ types: [] }) }))
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
