/**
 * AttachmentsCard — the internal note is a CONVERSATION note (like a NotesTab
 * note), distinct from the Vacaturetekst description above it. ACTIONS-SCOPE-
 * DEFAULT-FLIP (Danny 09-08): proves this note keeps all three Koios assist
 * modes, including Actiepunten, even though CollapsibleRichText's/RichTextAssist-
 * Bar's shared default is now improve+summarize only.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AttachmentsCard from './AttachmentsCard'

// Stand-in for the Tiptap editor — `assistModes` surfaced as a data attribute
// so it can be asserted without mounting the real assist bar.
vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange, assistModes }: { value?: string; onChange: (v: string) => void; assistModes?: string[] }) => (
    <textarea data-testid="rte" value={value ?? ''} onChange={e => onChange(e.target.value)}
      data-assist-modes={assistModes ? assistModes.join(',') : ''} />
  ),
}))

describe('AttachmentsCard · note assist modes (ACTIONS-SCOPE-DEFAULT-FLIP)', () => {
  it('keeps all three Koios assist modes on the note, including Actiepunten (a conversation, not a description)', async () => {
    const user = userEvent.setup()
    render(<AttachmentsCard files={[]} onAddFile={vi.fn()} onRemoveFile={vi.fn()} noteText="" onNoteChange={vi.fn()} />)

    // The note starts as a collapsed ghost (CollapsibleRichText) — reveal it first.
    expect(screen.queryByTestId('rte')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'modal.attachments.noteLabel' }))

    expect(screen.getByTestId('rte')).toHaveAttribute('data-assist-modes', 'improve,summarize,actions')
  })
})

// S-add-1: the bare coloured "+ toevoegen" text link becomes the shared
// DrawerAddButton (short variant) — never a hand-rolled text link.
describe('AttachmentsCard · document add affordance is a real button (S-add-1)', () => {
  it('opens the file picker via the shared DrawerAddButton, not a bare text link', async () => {
    const user = userEvent.setup()
    render(<AttachmentsCard files={[]} onAddFile={vi.fn()} onRemoveFile={vi.fn()} noteText="" onNoteChange={vi.fn()} />)

    // Full label ("drawer.tabs.documents") is the accessible name/title even in
    // `short` mode (DRAWER-ADD-SHORT-1) — the visible text collapses, the a11y
    // name does not.
    const addButton = screen.getByRole('button', { name: 'drawer.tabs.documents' })
    expect(addButton.tagName).toBe('BUTTON')

    const clickSpy = vi.fn()
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    fileInput.addEventListener('click', clickSpy)
    await user.click(addButton)
    expect(clickSpy).toHaveBeenCalled()
  })
})
