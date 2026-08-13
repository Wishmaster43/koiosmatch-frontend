import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import KoiosPanel from './KoiosPanel'
import { sendChat } from './koios/koiosApi'

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

// PLAN-KANDIDATEN batch 2: a 402/koios_credit_exhausted reply must show the
// translated credit notice, not the generic "couldn't reach Koios" line.
describe('KoiosPanel — known backend error codes', () => {
  const submitMessage = async (text: string) => {
    render(<KoiosPanel open onClose={() => {}} onNavigate={() => {}} />)
    await screen.findByText('common:koios.radar.empty')
    const textarea = screen.getByPlaceholderText('koios.taskPlaceholder')
    fireEvent.change(textarea, { target: { value: text } })
    fireEvent.click(screen.getByRole('button', { name: 'koios.taskPlaceholder' }))
  }

  it('shows the translated credit-exhausted notice on a 402 koios_credit_exhausted error', async () => {
    vi.mocked(sendChat).mockRejectedValueOnce({
      response: { status: 402, data: { code: 'koios_credit_exhausted' } },
    })
    await submitMessage('hello')
    expect(await screen.findByText('errors.koiosCreditExhausted')).toBeInTheDocument()
    expect(screen.queryByText('koios.errorReply')).toBeNull()
  })

  it('still shows the generic forbidden notice on a 403', async () => {
    vi.mocked(sendChat).mockRejectedValueOnce({ response: { status: 403, data: {} } })
    await submitMessage('hello')
    expect(await screen.findByText('koios.forbidden')).toBeInTheDocument()
  })

  it('falls back to the generic error notice for an unknown failure', async () => {
    vi.mocked(sendChat).mockRejectedValueOnce(new Error('network down'))
    await submitMessage('hello')
    expect(await screen.findByText('koios.errorReply')).toBeInTheDocument()
  })
})
