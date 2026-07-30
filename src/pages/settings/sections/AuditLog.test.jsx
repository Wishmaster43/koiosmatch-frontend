/**
 * AuditLog — regression for the activity-log fetch race: the effect used to
 * depend on `t`, so switching language mid-load re-ran the fetch with no guard
 * to stop a stale response from winning. The fix loads once per mount (deps
 * intentionally empty — i18next's `t` reads the current language dynamically
 * even from a mount-time closure) and drops any response that arrives after
 * the component has unmounted.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import i18n from '@/i18n'
import { RightPanelProvider } from '@/context/RightPanelContext'
import AuditLog from './AuditLog'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})
import api from '@/lib/api'

const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

function renderAuditLog() {
  return render(<RightPanelProvider><AuditLog /></RightPanelProvider>)
}

// A promise the test controls the resolution timing of, so a language switch
// can be simulated WHILE the request is still in flight.
function deferred() {
  let resolve
  const promise = new Promise(res => { resolve = res })
  return { promise, resolve }
}

// Drains the WHOLE microtask queue (a macrotask only runs once it is empty),
// so a multi-hop `.then().catch().finally()` chain fully settles inside a
// single act() scope regardless of how many hops it takes.
const flushMicrotasks = () => new Promise(resolve => setTimeout(resolve, 0))

afterEach(async () => {
  vi.clearAllMocks()
  // afterEach hooks run LIFO — this one (registered after RTL's own auto-cleanup
  // import-time registration) fires BEFORE that cleanup unmounts the component,
  // so the language reset still hits a mounted tree and must be act-wrapped too.
  await act(async () => { await i18n.changeLanguage('nl') })
})

describe('AuditLog — activity-log fetch does not re-run on language switch', () => {
  it('calls /activity-log exactly once even if the language changes while the request is pending', async () => {
    const { promise, resolve } = deferred()
    api.get.mockReturnValue(promise)

    await act(async () => { renderAuditLog() })
    expect(api.get).toHaveBeenCalledTimes(1)

    // Switch language while the fetch is still pending — this used to re-run
    // the effect (dep on `t`) and fire a second, racing request.
    await act(async () => { await i18n.changeLanguage('en') })
    expect(api.get).toHaveBeenCalledTimes(1)

    await act(async () => { resolve({ data: [] }); await flushMicrotasks() })
    expect(screen.getByText(st('audit.noEntries'))).toBeInTheDocument()
    // Still exactly one call after the response lands.
    expect(api.get).toHaveBeenCalledTimes(1)
  })

  it('shows the translated unavailable message in whatever language is active when the request fails, even without `t` in the deps', async () => {
    api.get.mockRejectedValue(new Error('network down'))
    await act(async () => {
      renderAuditLog()
      await flushMicrotasks()
    })
    expect(screen.getByText(st('audit.unavailable'))).toBeInTheDocument()
  })
})

describe('AuditLog — unmounting before the fetch resolves does not throw', () => {
  it('drops a response that arrives after unmount instead of updating state', async () => {
    const { promise, resolve } = deferred()
    api.get.mockReturnValue(promise)

    const { unmount } = renderAuditLog()
    unmount()

    // Resolve only after the component is gone — must not throw / reject unhandled.
    await expect(act(async () => { resolve({ data: [] }); await promise })).resolves.not.toThrow()
  })
})
