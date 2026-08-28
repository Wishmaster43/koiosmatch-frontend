/** useEditorExitGuards — pins for the back-guard's synthetic-pop immunity. */
import { describe, it, expect, vi } from 'vitest'

describe('exit guards ignore synthetic announcement pops (KOIOS-CHIP-STALE-1 fallout, r2)', () => {
  it('a kmSynthetic popstate never triggers the guarded close; a real pop does', async () => {
    const { renderHook } = await import('@testing-library/react')
    const { useEditorExitGuards } = await import('./useEditorExitGuards')
    const confirm = vi.fn((_m: string, ok: () => void) => ok())
    const onClose = vi.fn()
    renderHook(() => useEditorExitGuards({ isDirty: () => false, liveRunActive: false, onClose, confirm }))
    window.dispatchEvent(new PopStateEvent('popstate', { state: { kmSynthetic: true } }))
    expect(onClose).not.toHaveBeenCalled()
    window.dispatchEvent(new PopStateEvent('popstate', { state: null }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
