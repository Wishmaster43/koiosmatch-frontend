/**
 * useTextPopoutHost + DrawerPopoutRegistry — KLANTEN 5 (21-08, drawer-scoped
 * rebuild after the verify round rejected host-unmount closing): closing the
 * DRAWER closes the popped-out window; a mere TAB SWITCH (host unmounts, the
 * drawer stays) must leave it open; a host outside any drawer closes nothing.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, renderHook } from '@testing-library/react'
import { useTextPopoutHost } from './useTextPopoutHost'
import { DrawerPopoutRegistryProvider } from '@/components/drawer/DrawerPopoutRegistry'

const openTextPopout = vi.fn()
vi.mock('@/lib/secondScreen', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/secondScreen')>()
  return { ...actual, openTextPopout: (...a: unknown[]) => openTextPopout(...a) }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn() }))
// The sync channel is irrelevant here — a no-op post keeps jsdom BroadcastChannel out.
vi.mock('./useTextPopoutSync', () => ({ useTextPopoutSync: () => vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

const HOST_OPTS = {
  entity: 'customer' as const, id: 'c1', field: 'companyText' as const,
  value: '<p>x</p>', dirty: false, onDraft: vi.fn(), onSaved: vi.fn(),
}

// Test harness: a drawer (provider) whose active "tab" can unmount separately.
function Host({ onReady }: { onReady: (open: () => void) => void }) {
  const popout = useTextPopoutHost(HOST_OPTS)
  onReady(popout.open)
  return null
}
function Drawer({ tabMounted, onReady }: { tabMounted: boolean; onReady: (open: () => void) => void }) {
  return <DrawerPopoutRegistryProvider>{tabMounted && <Host onReady={onReady} />}</DrawerPopoutRegistryProvider>
}

describe('useTextPopoutHost — drawer-scoped popout close (KLANTEN 5)', () => {
  beforeEach(() => openTextPopout.mockReset())

  it('a TAB SWITCH keeps the window open; closing the DRAWER closes it', () => {
    const win = { closed: false, close: vi.fn() }
    openTextPopout.mockReturnValue(win)
    let openFn: () => void = () => {}
    const view = render(<Drawer tabMounted onReady={fn => { openFn = fn }} />)
    openFn()
    expect(openTextPopout).toHaveBeenCalledWith('customer', 'c1', 'companyText')

    // Tab switch: the HOST unmounts, the drawer (provider) stays — window lives.
    view.rerender(<Drawer tabMounted={false} onReady={fn => { openFn = fn }} />)
    expect(win.close).not.toHaveBeenCalled()

    // Drawer close: the provider unmounts — the window closes with it.
    view.unmount()
    expect(win.close).toHaveBeenCalledTimes(1)
  })

  it('leaves a window the user already closed alone', () => {
    const win = { closed: true, close: vi.fn() }
    openTextPopout.mockReturnValue(win)
    let openFn: () => void = () => {}
    const view = render(<Drawer tabMounted onReady={fn => { openFn = fn }} />)
    openFn()
    view.unmount()
    expect(win.close).not.toHaveBeenCalled()
  })

  it('a host OUTSIDE any drawer (modal hosts) closes nothing on unmount', () => {
    const win = { closed: false, close: vi.fn() }
    openTextPopout.mockReturnValue(win)
    const { result, unmount } = renderHook(() => useTextPopoutHost(HOST_OPTS))
    result.current.open()
    unmount()
    expect(win.close).not.toHaveBeenCalled()
  })
})
