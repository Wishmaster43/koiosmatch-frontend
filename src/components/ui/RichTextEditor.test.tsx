/**
 * RichTextEditor — EXTERNAL-VALUE-SYNC regression (Danny 08-08 "txt komt niet in
 * notities blok"): TipTap only reads `content` at init, so an outside change to
 * the `value` prop (the dictation mic's append, the Koios assist "Overnemen")
 * never reached the editor until the sync effect landed. Real TipTap, no mocks —
 * the bug lived exactly in the prop→editor seam a mock would paper over.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import RichTextEditor from './RichTextEditor'

describe('RichTextEditor · external value sync', () => {
  it('renders an externally APPENDED value into the editor (mic/assist path)', async () => {
    const onChange = vi.fn()
    const { rerender } = render(<RichTextEditor value="<p>Eerste regel</p>" onChange={onChange} />)
    await screen.findByText('Eerste regel')

    // The host appends a dictated paragraph OUTSIDE the editor (state change only).
    rerender(<RichTextEditor value="<p>Eerste regel</p><p>Gedicteerde zin</p>" onChange={onChange} />)
    await waitFor(() => expect(screen.getByText('Gedicteerde zin')).toBeInTheDocument())
    // The sync itself must not echo back through onChange (no update loop).
    expect(onChange).not.toHaveBeenCalled()
  })

  it('clears the editor when the host resets the value to empty', async () => {
    const { rerender } = render(<RichTextEditor value="<p>Weg hiermee</p>" onChange={vi.fn()} />)
    await screen.findByText('Weg hiermee')
    rerender(<RichTextEditor value="" onChange={vi.fn()} />)
    await waitFor(() => expect(screen.queryByText('Weg hiermee')).toBeNull())
  })

  it('mounts host toolbarExtra next to the language picker', () => {
    render(<RichTextEditor value="" onChange={vi.fn()} toolbarExtra={<button type="button">mic-slot</button>} />)
    expect(screen.getByRole('button', { name: 'mic-slot' })).toBeInTheDocument()
  })

  // 13-09 regression: the `resizable` branch (MemorySettings) set the content
  // element's minHeight to '100%' of an ancestor with no explicit height, which
  // collapsed to the empty content's own size (19.5px measured) instead of the
  // requested 240px — Danny: "Tekst is heel klein".
  it('gives the resizable editor content its real pixel minHeight, not a percentage', () => {
    const { container } = render(<RichTextEditor value="" onChange={vi.fn()} resizable minHeight={240} />)
    const content = container.querySelector('.ProseMirror')?.parentElement as HTMLElement
    expect(content.style.minHeight).toBe('240px')
  })
})
