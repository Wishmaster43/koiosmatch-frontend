/**
 * CollapsibleRichText — ACTIONS-SCOPE-DEFAULT-FLIP (Danny 09-08): this component
 * itself had NO way to distinguish a description caller from a conversation
 * caller, so flipping RichTextAssistBar's shared default would have silently
 * dropped Actiepunten from the two conversation-like callers (+Match's
 * Opmerkingen, the vacancy attachments note). This file proves the fix: the
 * `assistModes` prop reaches RichTextEditor unchanged when a caller sets it, and
 * stays `undefined` (inherit the shared default) when a caller does not.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { TFunction } from 'i18next'
import CollapsibleRichText from './CollapsibleRichText'

// Minimal stand-in for the Tiptap-backed editor — surfaces `assistModes` as a
// data attribute so it can be asserted without mounting the real assist bar.
vi.mock('./RichTextEditor', () => ({
  default: ({ assistModes }: { assistModes?: string[] }) => (
    <div data-testid="rte" data-assist-modes={assistModes ? assistModes.join(',') : ''} />
  ),
}))

// Raw-key stand-in — this suite never asserts translated text.
const t = ((k: string) => k) as TFunction

describe('CollapsibleRichText · assistModes passthrough', () => {
  it('forwards no assistModes to RichTextEditor when the caller sets none (inherits the shared default)', () => {
    render(
      <CollapsibleRichText t={t} value="" onChange={vi.fn()} expanded={false} setExpanded={vi.fn()}
        editing setEditing={vi.fn()} placeholder="Add" />,
    )
    expect(screen.getByTestId('rte')).toHaveAttribute('data-assist-modes', '')
  })

  it('forwards an explicit assistModes override to RichTextEditor unchanged (a conversation-like caller)', () => {
    render(
      <CollapsibleRichText t={t} value="" onChange={vi.fn()} expanded={false} setExpanded={vi.fn()}
        editing setEditing={vi.fn()} placeholder="Add" assistModes={['improve', 'summarize', 'actions']} />,
    )
    expect(screen.getByTestId('rte')).toHaveAttribute('data-assist-modes', 'improve,summarize,actions')
  })

  it('never auto-opens — the collapsed ghost stays until clicked, regardless of assistModes', () => {
    render(
      <CollapsibleRichText t={t} value="" onChange={vi.fn()} expanded={false} setExpanded={vi.fn()}
        editing={false} setEditing={vi.fn()} placeholder="Add" assistModes={['improve', 'summarize', 'actions']} />,
    )
    expect(screen.queryByTestId('rte')).toBeNull()
  })
})
