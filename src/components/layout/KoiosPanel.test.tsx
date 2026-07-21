import { describe, it, expect, vi } from 'vitest'
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
