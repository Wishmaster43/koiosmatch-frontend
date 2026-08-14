/**
 * TargetNoteField · second-screen pop-out (BELLIJST-NOTE-POPOUT-1, Danny 14-08,
 * looking at this exact editor: "dit moet zeker een pop-out kunnen worden op
 * een popup").
 *
 * Its own file rather than an addition to TargetNoteField.test.tsx: mirrors
 * ProfileTabPopout.test.tsx's own-file convention — these tests need a
 * different mock set (window.open + notify) that the plain render tests must
 * not inherit.
 *
 * What is pinned: the icon opens the REAL second-screen route on the composite
 * <campaignId>:<targetId> id (the URL is the contract between the two windows,
 * §13 — assert the request, not that a handler fired), popping out starts the
 * edit here so the draft can never be stranded in the closed window, and a
 * blocked popup says so instead of failing silently.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@/i18n'
import TargetNoteField from './TargetNoteField'
import { notifyError } from '@/lib/notify'

vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange }: { value?: string; onChange: (v: string) => void }) => (
    <textarea aria-label="body" value={value ?? ''} onChange={e => onChange(e.target.value)} />
  ),
}))
vi.mock('@/components/drawer/tabs/notes/NoteAssistSection', () => ({ default: () => <div data-testid="assist-stub" /> }))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn(), notify: vi.fn() }))

describe('TargetNoteField · second-screen pop-out', () => {
  it('opens the second-screen window on the composite campaign:target route', async () => {
    const user = userEvent.setup()
    const open = vi.fn(() => ({}) as Window)
    vi.stubGlobal('open', open)
    render(<TargetNoteField note={null} onSave={vi.fn().mockResolvedValue(undefined)} targetId="t1" campaignId="camp-1" />)

    await user.click(screen.getByTitle('Open op tweede scherm'))

    // THE SEAM: the real route + named window, so re-opening this same target
    // re-focuses one window instead of stacking a second one.
    expect(open).toHaveBeenCalledWith(
      '/popout/text/outreachTarget/camp-1:t1/targetNote',
      'koios-text-outreachTarget-camp-1:t1-targetNote',
      expect.any(String),
    )
    vi.unstubAllGlobals()
  })

  it('starts editing here as well, so the draft lives in both windows', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('open', vi.fn(() => ({}) as Window))
    render(<TargetNoteField note={null} onSave={vi.fn().mockResolvedValue(undefined)} targetId="t1" campaignId="camp-1" />)

    expect(screen.queryByLabelText('body')).toBeNull()
    await user.click(screen.getByTitle('Open op tweede scherm'))
    expect(screen.getByLabelText('body')).toBeInTheDocument()
    vi.unstubAllGlobals()
  })

  it('says so when the browser blocks the popup — never a dead icon', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('open', vi.fn(() => null))
    render(<TargetNoteField note={null} onSave={vi.fn().mockResolvedValue(undefined)} targetId="t1" campaignId="camp-1" />)

    await user.click(screen.getByTitle('Open op tweede scherm'))
    expect(notifyError).toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
