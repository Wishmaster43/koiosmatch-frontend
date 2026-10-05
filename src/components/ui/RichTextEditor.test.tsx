/**
 * RichTextEditor — EXTERNAL-VALUE-SYNC regression (Danny 08-08 "txt komt niet in
 * notities blok"): TipTap only reads `content` at init, so an outside change to
 * the `value` prop (the dictation mic's append, the Koios assist "Overnemen")
 * never reached the editor until the sync effect landed. Real TipTap, no mocks —
 * the bug lived exactly in the prop→editor seam a mock would paper over.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { useState } from 'react'
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

// ONIX M-002: the raw-HTML source mode is the one place a user can type markup the
// editor itself never produces — it must leave source mode through the same allow-list
// the renderer applies, so a <form>/<input>/<button> never reaches onChange as "saved".
describe('RichTextEditor · source mode sanitises on the way out (ONIX M-002)', () => {
  // A stateful host, so the value the toggle reads is what the textarea typed.
  function Host({ onChange }: { onChange: (html: string) => void }) {
    const [value, setValue] = useState('<p>ok</p>')
    return <RichTextEditor value={value} onChange={h => { setValue(h); onChange(h) }} labels={{ html: 'HTML' }} />
  }

  it('strips form/input/button typed in source mode when toggling back to the editor', async () => {
    const onChange = vi.fn()
    const { container } = render(<Host onChange={onChange} />)
    await screen.findByText('ok')
    fireEvent.click(screen.getByRole('button', { name: 'HTML' }))
    const source = container.querySelector('textarea') as HTMLTextAreaElement
    fireEvent.change(source, { target: { value: '<form action="https://evil.example"><input name="pw"><button>Inloggen</button></form><p>ok</p>' } })
    fireEvent.click(screen.getByRole('button', { name: 'HTML' }))
    await waitFor(() => expect(onChange).toHaveBeenCalled())
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0] as string
    expect(last).not.toMatch(/<form|<input|<button/)
    expect(last).toContain('<p>ok</p>')
    expect(last).toContain('Inloggen')
  })

  it('sanitises on blur of the source textarea too, so a direct save never carries raw markup', async () => {
    const onChange = vi.fn()
    const { container } = render(<Host onChange={onChange} />)
    await screen.findByText('ok')
    fireEvent.click(screen.getByRole('button', { name: 'HTML' }))
    const source = container.querySelector('textarea') as HTMLTextAreaElement
    fireEvent.change(source, { target: { value: '<style>body{display:none}</style><p class="x">ok</p>' } })
    fireEvent.blur(source)
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith('<p>ok</p>'))
  })
})
