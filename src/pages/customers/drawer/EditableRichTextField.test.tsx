/**
 * EditableRichTextField — the pencil → save/cancel/clear cycle, the SafeHtml read
 * display, and the italic-muted empty state (§4: italic reserved for placeholder
 * text, house rule Danny 2026-07-14: every prose field is a rich-text block with
 * its own edit dance). RichTextEditor itself is stubbed (its own Tiptap internals
 * are out of scope here — this file only tests EditableRichTextField's wiring);
 * SafeHtml renders for real so the sanitised-HTML display path is genuinely covered.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import EditableRichTextField from './EditableRichTextField'

// Minimal stand-in for the Tiptap editor — a plain textarea wired to value/onChange,
// so tests can drive the draft without pulling in real ProseMirror internals.
vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange }: { value?: string; onChange: (v: string) => void }) => (
    <textarea data-testid="rte" value={value ?? ''} onChange={e => onChange(e.target.value)} />
  ),
}))

describe('EditableRichTextField · read mode', () => {
  it('renders the sanitised HTML through SafeHtml when a value is set', () => {
    render(<EditableRichTextField label="Beschrijving" value="<p>Hello <strong>world</strong></p>" onSave={() => {}} />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
    expect(screen.getByText('world').tagName).toBe('STRONG')
  })

  it('shows the italic muted empty-state placeholder when the value is empty', () => {
    render(<EditableRichTextField label="Beschrijving" value="" onSave={() => {}} />)
    const placeholder = screen.getByText('customers:richText.empty')
    expect(placeholder).toBeInTheDocument()
    expect(placeholder).toHaveStyle({ fontStyle: 'italic' })
  })

  it('does not show the RichTextEditor while in read mode', () => {
    render(<EditableRichTextField label="Beschrijving" value="<p>x</p>" onSave={() => {}} />)
    expect(screen.queryByTestId('rte')).toBeNull()
  })
})

describe('EditableRichTextField · pencil → edit → save/cancel/clear', () => {
  it('enters edit mode with the current value as the draft', async () => {
    const user = userEvent.setup()
    render(<EditableRichTextField label="Beschrijving" value="<p>Original</p>" onSave={() => {}} />)
    await user.click(screen.getByTitle('edit'))
    expect(screen.getByTestId('rte')).toHaveValue('<p>Original</p>')
  })

  it('saves the edited draft and leaves edit mode', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<EditableRichTextField label="Beschrijving" value="<p>Original</p>" onSave={onSave} />)
    await user.click(screen.getByTitle('edit'))
    const rte = screen.getByTestId('rte')
    await user.clear(rte)
    await user.type(rte, '<p>Edited</p>')
    await user.click(screen.getByTitle('save'))
    expect(onSave).toHaveBeenCalledWith('<p>Edited</p>')
    expect(screen.queryByTestId('rte')).toBeNull()
  })

  it('cancel discards the draft without calling onSave', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<EditableRichTextField label="Beschrijving" value="<p>Original</p>" onSave={onSave} />)
    await user.click(screen.getByTitle('edit'))
    const rte = screen.getByTestId('rte')
    await user.clear(rte)
    await user.type(rte, '<p>Discarded</p>')
    await user.click(screen.getByTitle('cancel'))
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.queryByTestId('rte')).toBeNull()
  })

  it('re-entering edit after a cancel re-seeds the draft from the ORIGINAL value, not the discarded one', async () => {
    const user = userEvent.setup()
    render(<EditableRichTextField label="Beschrijving" value="<p>Original</p>" onSave={() => {}} />)
    await user.click(screen.getByTitle('edit'))
    await user.clear(screen.getByTestId('rte'))
    await user.type(screen.getByTestId('rte'), '<p>Discarded</p>')
    await user.click(screen.getByTitle('cancel'))
    await user.click(screen.getByTitle('edit'))
    expect(screen.getByTestId('rte')).toHaveValue('<p>Original</p>')
  })

  it('the clear button empties the draft (only shown while editing)', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<EditableRichTextField label="Beschrijving" value="<p>Original</p>" onSave={onSave} />)
    // Not visible in read mode.
    expect(screen.queryByLabelText('clear')).toBeNull()
    await user.click(screen.getByTitle('edit'))
    await user.click(screen.getByLabelText('clear'))
    expect(screen.getByTestId('rte')).toHaveValue('')
    await user.click(screen.getByTitle('save'))
    expect(onSave).toHaveBeenCalledWith('')
  })
})
