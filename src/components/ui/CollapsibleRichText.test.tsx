/**
 * CollapsibleRichText — covers the MATCH-REMARKS-POPOUT `onPopout` prop
 * (control round, MODAL34-REPAIR): this component shipped with zero tests,
 * so the pop-out button's conditional render was unverified. Pins both
 * branches — omitted (every pre-existing caller: customer/location/department
 * text) vs. supplied (MatchModal's Opmerkingen card) — and that clicking it
 * calls the caller's own handler, never a dead icon.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CollapsibleRichText from './CollapsibleRichText'
import type { TFunction } from 'i18next'

// Real component is heavy (Tiptap) — irrelevant to the pop-out button under
// test, which lives in the shared header row above the editor.
vi.mock('./RichTextEditor', () => ({ default: () => <div data-testid="rte" /> }))

// Minimal t() stub — the pop-out button's title/aria-label is the only string this test reads.
const t = ((key: string) => key) as unknown as TFunction

describe('CollapsibleRichText · pop-out button', () => {
  it('renders NO pop-out button while editing when onPopout is not passed', () => {
    render(
      <CollapsibleRichText t={t} value="<p>hi</p>" onChange={vi.fn()}
        expanded={false} setExpanded={vi.fn()} editing setEditing={vi.fn()}
        placeholder="add text" />,
    )
    expect(screen.queryByLabelText('common:openSecondScreen')).not.toBeInTheDocument()
  })

  it('renders the pop-out button while editing when onPopout IS passed, and calls it on click', async () => {
    const onPopout = vi.fn()
    const user = userEvent.setup()
    render(
      <CollapsibleRichText t={t} value="<p>hi</p>" onChange={vi.fn()}
        expanded={false} setExpanded={vi.fn()} editing setEditing={vi.fn()}
        placeholder="add text" onPopout={onPopout} />,
    )
    const button = screen.getByLabelText('common:openSecondScreen')
    expect(button).toBeInTheDocument()
    await user.click(button)
    expect(onPopout).toHaveBeenCalledTimes(1)
  })

  it('never renders the pop-out button in the collapsed (non-editing) state, with or without onPopout', () => {
    render(
      <CollapsibleRichText t={t} value="" onChange={vi.fn()}
        expanded={false} setExpanded={vi.fn()} editing={false} setEditing={vi.fn()}
        placeholder="add text" onPopout={vi.fn()} />,
    )
    expect(screen.queryByLabelText('common:openSecondScreen')).not.toBeInTheDocument()
  })
})
