/**
 * ContactTextSection — CONTACT-TEKST-1: the thin wrapper over EditableRichTextField.
 * Covers what this file itself owns: the SafeHtml read display, the save callback
 * shape (raw HTML, the caller turns it into `{ notes }`), and the second-screen
 * popout icon presence/absence (customerId null on legacy/edge data). RichTextEditor
 * is stubbed exactly like EditableRichTextField.test.tsx — its own Tiptap internals
 * are out of scope here.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ContactTextSection from './ContactTextSection'

vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange }: { value?: string; onChange: (v: string) => void }) => (
    <textarea data-testid="rte" value={value ?? ''} onChange={e => onChange(e.target.value)} />
  ),
}))

describe('ContactTextSection · read display', () => {
  it('renders saved HTML through SafeHtml', () => {
    render(<ContactTextSection contactId="c1" customerId="cust-1" value="<p>Hello <strong>world</strong></p>" onSave={() => {}} />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
    expect(screen.getByText('world').tagName).toBe('STRONG')
  })

  it('shows the shared calm empty state when there is no text yet', () => {
    render(<ContactTextSection contactId="c1" customerId="cust-1" value="" onSave={() => {}} />)
    expect(screen.getByText('customers:richText.empty')).toBeInTheDocument()
  })
})

describe('ContactTextSection · second-screen popout icon (TEKST-POPOUT-1)', () => {
  it('renders the popout icon when customerId is known', () => {
    render(<ContactTextSection contactId="c1" customerId="cust-1" value="<p>x</p>" onSave={() => {}} />)
    expect(screen.getByTitle('openSecondScreen')).toBeInTheDocument()
  })

  it('hides the popout icon when customerId is null (legacy/edge data)', () => {
    render(<ContactTextSection contactId="c1" customerId={null} value="<p>x</p>" onSave={() => {}} />)
    expect(screen.queryByTitle('openSecondScreen')).toBeNull()
  })
})

describe('ContactTextSection · save', () => {
  it('calls onSave with the raw edited HTML', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<ContactTextSection contactId="c1" customerId="cust-1" value="<p>Original</p>" onSave={onSave} />)
    await user.click(screen.getByTitle('edit'))
    const rte = screen.getByTestId('rte')
    await user.clear(rte)
    await user.type(rte, '<p>Edited</p>')
    await user.click(screen.getByTitle('save'))
    expect(onSave).toHaveBeenCalledWith('<p>Edited</p>')
  })
})
