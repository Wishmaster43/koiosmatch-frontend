/**
 * AuditLog — regression for the activity-log fetch race: the effect used to
 * depend on `t`, so switching language mid-load re-ran the fetch with no guard
 * to stop a stale response from winning. The fix loads once per mount (deps
 * intentionally empty — i18next's `t` reads the current language dynamically
 * even from a mount-time closure) and drops any response that arrives after
 * the component has unmounted. The per_page limit comes from tenant settings;
 * the test asserts the API call includes the expected limit.
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

// Mock settings with controllable return value.
const mockSettings = vi.fn(() => ({}))
vi.mock('@/lib/settings/useAllSettings', () => ({
  useAllSettings: () => mockSettings(),
  getNumberSetting: (values, key, fallback) => {
    const raw = values?.[key]
    if (raw == null) return fallback
    const n = typeof raw === 'number' ? raw : Number(raw)
    return Number.isFinite(n) ? n : fallback
  },
}))

const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

function renderAuditLog() {
  return render(<RightPanelProvider><AuditLog /></RightPanelProvider>)
}

afterEach(() => {
  vi.clearAllMocks()
  mockSettings.mockReturnValue({})
})

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
  // afterEach hooks run LIFO — this one (registered after RTL's own auto-cleanup
  // import-time registration) fires BEFORE that cleanup unmounts the component,
  // so the language reset still hits a mounted tree and must be act-wrapped too.
  await act(async () => { await i18n.changeLanguage('nl') })
})

describe('AuditLog — request seam', () => {
  // K-139 / ACTORLABEL-SWEEP-1: a Koios-performed action carries actor_label
  // ("<name>-KoiosAI") on the REAL /activity-log envelope — it must win over
  // the human causer_name on the central audit surface.
  it('renders actor_label instead of causer_name when the feed carries both', async () => {
    mockSettings.mockReturnValue({})
    api.get.mockResolvedValue({ data: { data: [{
      id: 1, description: 'updated', log_name: 'candidate',
      causer_name: 'Danny Polak', actor_label: 'Vacature Flow-KoiosAI',
      created_at: '2026-08-01T10:00:00Z',
    }] } })
    renderAuditLog()
    expect(await screen.findByText(/Vacature Flow-KoiosAI/)).toBeInTheDocument()
    expect(screen.queryByText(/Danny Polak/)).not.toBeInTheDocument()
  })

  it('GETs /activity-log with the default per_page limit (200) when no setting is configured', async () => {
    mockSettings.mockReturnValue({})
    api.get.mockResolvedValue({ data: [] })
    await act(async () => { renderAuditLog() })
    // THE SEAM: exact route and per_page param from tenant settings default (activity_log_limit=200).
    expect(api.get).toHaveBeenCalledWith('/activity-log', { params: { per_page: 200 } })
  })

  it('GETs /activity-log with the custom per_page limit when activity_log_limit is configured', async () => {
    mockSettings.mockReturnValue({ activity_log_limit: 50 })
    api.get.mockResolvedValue({ data: [] })
    await act(async () => { renderAuditLog() })
    // THE SEAM: passes the tenant-configured activity_log_limit as per_page.
    expect(api.get).toHaveBeenCalledWith('/activity-log', { params: { per_page: 50 } })
  })
})

describe('AuditLog — activity-log fetch does not re-run on language switch', () => {
  it('calls /activity-log exactly once even if the language changes while the request is pending', async () => {
    mockSettings.mockReturnValue({})
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
    mockSettings.mockReturnValue({})
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
    mockSettings.mockReturnValue({})
    const { promise, resolve } = deferred()
    api.get.mockReturnValue(promise)

    const { unmount } = renderAuditLog()
    unmount()

    // Resolve only after the component is gone — must not throw / reject unhandled.
    await expect(act(async () => { resolve({ data: [] }); await promise })).resolves.not.toThrow()
  })
})
