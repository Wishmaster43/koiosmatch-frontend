import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import KoiosPanel from './KoiosPanel'

// jsdom has no scrollIntoView implementation; KoiosPanel calls it to keep the
// latest message in view on every messages/loading change.
Element.prototype.scrollIntoView = vi.fn()

// KoiosPanel imports @/lib/datetime (useLocale), which imports the real i18n
// singleton as a module-level side effect (src/i18n/index.ts) — unlike most
// component tests, every t() in this tree would then return actual Dutch copy
// instead of echoing the key. Stub useLocale directly so that import — and the
// real i18n init behind it — never happens; every useTranslation() falls back
// to its normal uninitialised-instance behaviour (t returns the key).
vi.mock('@/lib/datetime', () => ({ useLocale: () => 'nl-NL' }))

// KoiosPanel's own hooks call these on open — stub them so the test never hits
// the real network (useKoiosSettings fetches settings the moment `open` is true).
vi.mock('./koios/koiosApi', () => ({
  sendChat: vi.fn(),
  getKoiosSettings: vi.fn(() => Promise.resolve(null)),
  confirmPendingAction: vi.fn(),
  cancelPendingAction: vi.fn(),
}))
// KoiosRadar's own stats fetch (candidates/stats) via the shared heavyGet wrapper.
vi.mock('@/lib/heavyGet', () => ({ heavyGet: () => Promise.resolve({ data: { data: { attention: {} } } }) }))

// Landing state (Danny 21/7): the radar REPLACES the generic welcome bubble, it
// never sits alongside it, and only while no real conversation has started yet.
describe('KoiosPanel — landing state', () => {
  it('shows the Koios Advies radar instead of the welcome bubble when opened', async () => {
    render(<KoiosPanel open onClose={() => {}} onNavigate={() => {}} />)
    expect(screen.getByText('common:koios.radar.title')).toBeInTheDocument()
    expect(screen.queryByText('koios.welcome')).toBeNull()
    // Let the radar's own stats fetch settle (mocked all-zero → empty state) so
    // the async state update lands inside RTL's act(), not after the test ends.
    await screen.findByText('common:koios.radar.empty')
  })
})

// Resizable panel (replaces the old two-fixed-width toggle) — the drag handle
// must render with real separator semantics, and the expand/collapse button
// must keep working alongside it (§6, requirement: don't silently drop it).
describe('KoiosPanel — resizable width', () => {
  beforeEach(() => localStorage.clear())

  it('renders a keyboard-operable resize handle and keeps the expand/collapse button', async () => {
    render(<KoiosPanel open onClose={() => {}} onNavigate={() => {}} />)
    await screen.findByText('common:koios.radar.empty')
    // The handle: real separator role + accessible name (never mouse-only).
    expect(screen.getByRole('separator', { name: 'koios.resizeHandle' })).toBeInTheDocument()
    // The pre-existing toggle button is still present, not replaced by the handle.
    expect(screen.getByRole('button', { name: 'expand' })).toBeInTheDocument()
  })

  it('restores a previously stored pixel width instead of a fixed preset', async () => {
    localStorage.setItem('koios.width', '480')
    const { container } = render(<KoiosPanel open onClose={() => {}} onNavigate={() => {}} />)
    await screen.findByText('common:koios.radar.empty')
    expect((container.firstChild as HTMLElement).style.width).toBe('480px')
  })
})
