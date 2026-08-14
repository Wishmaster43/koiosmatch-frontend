/**
 * TargetNoteField · the popped-out window's save reaches the row behind it
 * (BELLIJST-NOTE-POPOUT-1). Its own file — mirrors TargetNoteField.popout.test.tsx
 * — because these tests mock @/hooks/useTextPopoutHost itself to simulate a
 * `saved` message arriving over the established BroadcastChannel (jsdom has no
 * real cross-window messaging), instead of the real hook the other suites use.
 *
 * What is pinned: the row's OWN read view updates the instant the pop-out
 * window's save lands (never a stale value until some unrelated re-render),
 * and that same landed note is pushed to `onNoteSavedElsewhere` — the campaign-
 * level state a collapsed-then-re-expanded row would otherwise re-read stale
 * from (§9 no second channel: this is the SAME message the popout already
 * sends, just observed at the point it reaches the opener).
 */
import { describe, it, expect, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import '@/i18n'
import TargetNoteField from './TargetNoteField'

vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange }: { value?: string; onChange: (v: string) => void }) => (
    <textarea aria-label="body" value={value ?? ''} onChange={e => onChange(e.target.value)} />
  ),
}))
vi.mock('@/components/drawer/tabs/notes/NoteAssistSection', () => ({ default: () => <div data-testid="assist-stub" /> }))

const captured: { onSaved?: (html: string) => void } = {}
vi.mock('@/hooks/useTextPopoutHost', () => ({
  useTextPopoutHost: (opts: { onSaved: (html: string) => void }) => {
    captured.onSaved = opts.onSaved
    return { open: vi.fn(), publishDraft: vi.fn(), active: false }
  },
}))

describe("TargetNoteField · the popout's save reaches the row behind it", () => {
  it("adopts the popout's saved note into the read view immediately", () => {
    render(<TargetNoteField note="Oude tekst" onSave={vi.fn()} targetId="t1" campaignId="camp-1" />)
    expect(screen.getByText('Oude tekst')).toBeInTheDocument()

    // Simulate the popout window's `saved` BroadcastChannel message arriving.
    act(() => { captured.onSaved?.('<p>Bel na 17u terug</p>') })

    expect(screen.getByText('Bel na 17u terug')).toBeInTheDocument()
    expect(screen.queryByText('Oude tekst')).toBeNull()
  })

  it("pushes the popout's saved note to the campaign-level state (onNoteSavedElsewhere)", () => {
    const onNoteSavedElsewhere = vi.fn()
    render(<TargetNoteField note="Oude tekst" onSave={vi.fn()} targetId="t1" campaignId="camp-1"
      onNoteSavedElsewhere={onNoteSavedElsewhere} />)

    act(() => { captured.onSaved?.('<p>Bel na 17u terug</p>') })

    // THE SEAM: the exact note text reaches the campaign-level state, so a row
    // that unmounts on collapse (TargetsTab) reads this, not a stale prop.
    expect(onNoteSavedElsewhere).toHaveBeenCalledWith('<p>Bel na 17u terug</p>')
  })
})
