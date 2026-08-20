/**
 * ActionRuleSaveBar — regression test (HUISSTIJL slotaudit finding 10, V6): the
 * reset and save buttons must always share ONE height/radius, because both render
 * through the shared Button size="sm" identity. This pins that contract, so a
 * repainted hand-styled 34px <button> beside the shared Button turns this red.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ActionRuleSaveBar from './ActionRuleSaveBar'

describe('ActionRuleSaveBar', () => {
  it('renders reset + save at the same Button sm footprint (height/radius) when dirty', () => {
    render(<ActionRuleSaveBar dirtyCount={3} saving={false} saved={false} onSave={vi.fn()} onResetAll={vi.fn()} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(2)
    const [resetBtn, saveBtn] = buttons
    // Both go through the shared Button component — same sm footprint (28px/r6),
    // never one button at the hand-painted 34px this finding caught.
    expect(resetBtn.style.height).toBe(saveBtn.style.height)
    expect(resetBtn.style.borderRadius).toBe(saveBtn.style.borderRadius)
    expect(saveBtn.style.height).toBe('28px')
    expect(saveBtn.style.borderRadius).toBe('6px')
  })

  it('save is disabled until something is dirty, and enabled once dirtyCount > 0', () => {
    const { rerender } = render(<ActionRuleSaveBar dirtyCount={0} saving={false} saved={false} onSave={vi.fn()} onResetAll={vi.fn()} />)
    const [, saveBtnIdle] = screen.getAllByRole('button')
    expect(saveBtnIdle).toBeDisabled()

    rerender(<ActionRuleSaveBar dirtyCount={2} saving={false} saved={false} onSave={vi.fn()} onResetAll={vi.fn()} />)
    const [, saveBtnDirty] = screen.getAllByRole('button')
    expect(saveBtnDirty).not.toBeDisabled()
  })

  it('the saved state paints the §4 success token pair in the REACHABLE post-save state', () => {
    // dirtyCount 0 + saved is what the parent actually produces: the save PUT
    // resets the draft (dirty → 0) BEFORE savedOk flips on. Round-2 Opus review:
    // the old test used dirtyCount 1 + saved, a state that never occurs, and so
    // missed that the disabled recipe greyed out the whole confirmation window.
    render(<ActionRuleSaveBar dirtyCount={0} saving={false} saved onSave={vi.fn()} onResetAll={vi.fn()} />)
    const [, saveBtn] = screen.getAllByRole('button')
    expect(saveBtn.style.background).toBe('var(--color-success-bg)')
    expect(saveBtn.style.border).toBe('1px solid var(--color-success)')
    // Ink is the dedicated on-success-bg token (16:1 light / ~12:1 dark) — never
    // --color-success itself, which reads 3.0:1 on its own bg (WCAG AA fail).
    expect(saveBtn.style.color).toBe('var(--color-on-success-bg)')
    // Inert but not grey: feedback state blocks the click via aria-disabled.
    expect(saveBtn).toHaveAttribute('aria-disabled', 'true')
  })
})
