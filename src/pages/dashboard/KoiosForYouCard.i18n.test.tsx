/**
 * KoiosForYouCard i18n pin — KOIOS-KAART-COMPACT acceptance criterion "NL-
 * labels gepind (geen 'Create Task' in de DOM)". Uses the REAL i18n runtime
 * (no react-i18next mock, mirrors DashboardSwitcher.test.tsx) so this fails
 * the moment a raw English action-type string leaks into the table view.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
// Importing the real i18n runtime initializes it (side-effect import) — mirrors
// how the app itself boots translations; no provider wrapper needed (singleton).
import '@/i18n'
import KoiosForYouCard from './KoiosForYouCard'

// Preserve the real `unwrap` — only the network call is stubbed.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})
import api from '@/lib/api'
const apiGet = api.get as unknown as ReturnType<typeof vi.fn>

function renderCard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return render(<KoiosForYouCard />, { wrapper })
}

function renderCardWithToggle() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return render(<KoiosForYouCard scopeToggle />, { wrapper })
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-08-26T10:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('KoiosForYouCard (real i18n — NL default)', () => {
  it('shows translated NL category and action labels, never the raw English/keys', async () => {
    apiGet.mockResolvedValue({
      data: {
        from: '2026-08-24', to: '2026-08-26', period: 'range',
        actions_total: 2,
        per_type: { koios_create_task: 1, koios_send_whatsapp: 1 },
        per_source: { note: 1, chat: 1 },
        actions: [
          { id: 'a1', type: 'koios_create_task', source: 'note:abc', executed_at: '2026-08-24T10:00:00Z', status: 'completed', created: null },
          { id: 'a2', type: 'koios_send_whatsapp', source: 'chat', executed_at: '2026-08-25T10:00:00Z', status: 'failed', created: null },
        ],
        actions_truncated: false,
      },
    })
    renderCard()
    await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument())

    // KPI tiles: NL category labels + counts.
    expect(screen.getByText('Taken')).toBeInTheDocument()
    expect(screen.getByText('WhatsApp')).toBeInTheDocument()
    expect(screen.queryByText('Create Task')).not.toBeInTheDocument()
    expect(screen.queryByText('Send Whatsapp')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Taken'))

    // Table: NL action label — the raw English humanize output never appears.
    expect(screen.getByText('Taak aangemaakt')).toBeInTheDocument()
    expect(screen.queryByText('Create Task')).not.toBeInTheDocument()
  })
  // K-182 scope toggle: the manager control renders the REAL NL labels through
  // the live i18n runtime — a raw `koiosForYou.` key leaking into the DOM (the
  // exact bug the first delivery shipped: keys filed under `filters`) fails here.
  it('renders the scope toggle with real NL labels, never raw keys', async () => {
    apiGet.mockResolvedValue({
      data: { from: '2026-08-24', to: '2026-08-26', period: 'range', actions_total: 0,
        per_type: {}, per_source: {}, actions: [], actions_truncated: false },
    })
    renderCardWithToggle()
    await waitFor(() => expect(screen.getByText('Mij')).toBeInTheDocument())
    expect(screen.getByText('Mijn team')).toBeInTheDocument()
    // No element renders a raw dotted key from this namespace.
    expect(document.body.textContent).not.toMatch(/koiosForYou\./)
  })

})
