/**
 * TargetNoteField — NOTE-RICH-PARITY-1 (Danny 14-08): the bellijst note is now
 * the SAME rich note as the candidate drawer (RichTextEditor + the Koios
 * assist modes), saved through the SAME (id, note) shape the PATCH wrapper
 * already expected. RichTextEditor is stubbed (mirrors NoteFields.test.tsx —
 * Tiptap itself is out of scope here); NoteAssistSection is real, so this
 * suite is the one place proving the shared assist modes actually
 * render on this field.
 *
 * The second-screen pop-out (BELLIJST-NOTE-POPOUT-1) has its own test files —
 * TargetNoteField.popout.test.tsx (opens the real window.open route) and
 * TargetNoteField.popoutSync.test.tsx (the popout's save reaches this row) —
 * mirroring ProfileTabPopout.test.tsx's own-file convention: a different mock
 * set (window.open / useTextPopoutHost) that these plain render tests must not
 * inherit.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@/i18n'
import TargetNoteField from './TargetNoteField'

vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange }: { value?: string; onChange: (v: string) => void }) => (
    <textarea aria-label="body" value={value ?? ''} onChange={e => onChange(e.target.value)} />
  ),
}))

describe('TargetNoteField · rich-note parity with the candidate note (NOTE-RICH-PARITY-1)', () => {
  // ASSIST-SIDEPANEEL-1: the shared section's modes are now Verwerken
  // (verbeteren + actiepunten in one call) and Samenvatten — same parity, new
  // buttons; the items half renders through the shared execute wizard here.
  it('shows the Koios assist modes (Verwerken/Samenvatten) once editing', async () => {
    const user = userEvent.setup()
    render(<TargetNoteField note={null} onSave={vi.fn().mockResolvedValue(undefined)} targetId="t1" campaignId="camp-1" />)

    await user.click(screen.getByRole('button', { name: 'Bewerken' }))

    expect(screen.getByRole('button', { name: /Verwerken/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Samenvatten/ })).toBeInTheDocument()
  })

  it('saves through the exact same (trimmed note string) shape the caller already expects', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<TargetNoteField note={null} onSave={onSave} targetId="t1" campaignId="camp-1" />)

    await user.click(screen.getByRole('button', { name: 'Bewerken' }))
    await user.type(screen.getByLabelText('body'), 'Bel na 17u terug')
    await user.click(screen.getByRole('button', { name: 'Opslaan' }))

    // THE SEAM: onSave still receives a single trimmed note string — the PATCH
    // wrapper (useOutreachDetail.setTargetNote) is unchanged.
    expect(onSave).toHaveBeenCalledWith('Bel na 17u terug')
  })

  it('renders an existing note read-only (sanitized HTML) until the pencil is clicked', () => {
    render(<TargetNoteField note="Al twee keer gemist" onSave={vi.fn()} targetId="t1" campaignId="camp-1" />)
    expect(screen.getByText('Al twee keer gemist')).toBeInTheDocument()
    expect(screen.queryByLabelText('body')).toBeNull()
  })
})
