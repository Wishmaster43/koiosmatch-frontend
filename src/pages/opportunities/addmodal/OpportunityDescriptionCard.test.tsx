/**
 * OpportunityDescriptionCard · Koios assist modes (TASK-ASSIST-ACTIONS-1,
 * Danny 14-08). Mirrors AddTaskModal's DescriptionCard: opts INTO the third
 * 'actions' mode rather than inheriting CollapsibleRichText's/RichTextAssist-
 * Bar's shared improve+summarize-only default.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@/i18n'
import OpportunityDescriptionCard from './OpportunityDescriptionCard'

// Stand-in for the Tiptap editor — `assistModes` surfaced as a data attribute,
// same convention as AttachmentsCard.test.tsx / DescriptionCard.test.tsx.
vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange, assistModes }: { value?: string; onChange: (v: string) => void; assistModes?: string[] }) => (
    <textarea data-testid="rte" value={value ?? ''} onChange={e => onChange(e.target.value)}
      data-assist-modes={assistModes ? assistModes.join(',') : ''} />
  ),
}))

describe('OpportunityDescriptionCard · Koios assist (TASK-ASSIST-ACTIONS-1)', () => {
  it('offers all three assist modes, including Actiepunten, once the collapsed ghost is opened', async () => {
    const user = userEvent.setup()
    render(<OpportunityDescriptionCard value="" onChange={() => {}} />)

    // Starts collapsed (CollapsibleRichText ghost) — reveal the editor first.
    expect(screen.queryByTestId('rte')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Omschrijving' }))

    expect(screen.getByTestId('rte')).toHaveAttribute('data-assist-modes', 'improve,summarize,actions')
  })
})
