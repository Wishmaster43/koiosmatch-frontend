/**
 * OpportunityDescriptionBlock — the "Kanstekst" pencil → save/cancel cycle, the
 * SafeHtml read display, and the italic-muted empty state (§4: italic reserved
 * for placeholder text; house rule Danny 2026-07-14: every prose field is a
 * rich-text block with its own edit dance) — mirrors
 * customers/drawer/EditableRichTextField.test.tsx's coverage. Real i18n (nl)
 * side-effect init so common:edit/save/cancel AND the opportunities-namespace
 * keys (details.groups.description, richText.empty) resolve genuine Dutch text.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@/i18n'
import OpportunityDescriptionBlock from './OpportunityDescriptionBlock'

// Minimal stand-in for the Tiptap editor — a plain textarea wired to value/onChange.
vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange }: { value?: string; onChange: (v: string) => void }) => (
    <textarea data-testid="rte" value={value ?? ''} onChange={e => onChange(e.target.value)} />
  ),
}))

describe('OpportunityDescriptionBlock · read mode', () => {
  it('renders the sanitised HTML through SafeHtml when a value is set', () => {
    render(<OpportunityDescriptionBlock value="<p>Hallo <strong>wereld</strong></p>" onSave={() => {}} />)
    expect(screen.getByText('Hallo')).toBeInTheDocument()
    expect(screen.getByText('wereld').tagName).toBe('STRONG')
  })

  it('shows the italic muted empty-state placeholder when the value is empty', () => {
    render(<OpportunityDescriptionBlock value="" onSave={() => {}} />)
    // Real nl translation for opportunities:richText.empty.
    const placeholder = screen.getByText('Nog niets vastgelegd')
    expect(placeholder).toBeInTheDocument()
    expect(placeholder).toHaveStyle({ fontStyle: 'italic' })
  })

  it('does not show the RichTextEditor while in read mode', () => {
    render(<OpportunityDescriptionBlock value="<p>x</p>" onSave={() => {}} />)
    expect(screen.queryByTestId('rte')).toBeNull()
  })
})

describe('OpportunityDescriptionBlock · pencil → edit → save/cancel', () => {
  it('enters edit mode with the current value as the draft', async () => {
    const user = userEvent.setup()
    render(<OpportunityDescriptionBlock value="<p>Origineel</p>" onSave={() => {}} />)
    await user.click(screen.getByTitle('Bewerken'))
    expect(screen.getByTestId('rte')).toHaveValue('<p>Origineel</p>')
  })

  it('saves the edited draft and leaves edit mode', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<OpportunityDescriptionBlock value="<p>Origineel</p>" onSave={onSave} />)
    await user.click(screen.getByTitle('Bewerken'))
    const rte = screen.getByTestId('rte')
    await user.clear(rte)
    await user.type(rte, '<p>Bewerkt</p>')
    await user.click(screen.getByTitle('Opslaan'))
    expect(onSave).toHaveBeenCalledWith('<p>Bewerkt</p>')
    expect(screen.queryByTestId('rte')).toBeNull()
  })

  it('cancel discards the draft without calling onSave', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<OpportunityDescriptionBlock value="<p>Origineel</p>" onSave={onSave} />)
    await user.click(screen.getByTitle('Bewerken'))
    const rte = screen.getByTestId('rte')
    await user.clear(rte)
    await user.type(rte, '<p>Weggegooid</p>')
    await user.click(screen.getByTitle('Annuleren'))
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.queryByTestId('rte')).toBeNull()
    // The read view still shows the ORIGINAL value, not the discarded draft.
    expect(screen.getByText('Origineel')).toBeInTheDocument()
  })
})
