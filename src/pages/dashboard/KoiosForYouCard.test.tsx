/**
 * KoiosForYouCard — §13 coverage for the "Koios deed dit voor jou" dashboard
 * card: GET /ai/koios/for-you fires with the active `days` param, the 7/30
 * toggle refetches with the new param, and the four UI states (loading/error/
 * empty/success) render distinctly.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import KoiosForYouCard from './KoiosForYouCard'

// Identity translations — this test asserts on state/structure, not copy
// (mirrors Dashboard.test.tsx's approach).
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
// Avoid real locale-dependent formatting / the @/i18n side-effect import
// (same reasoning as Dashboard.test.tsx).
vi.mock('@/lib/formatters', () => ({ useNumberFormat: () => ({ formatNumber: (n: number) => String(n) }) }))
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: unknown) => String(v) }) }))

// Preserve the real `unwrap` (used by the card's queryFn) — only the network
// call is stubbed.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})
import api from '@/lib/api'
const apiGet = api.get as unknown as ReturnType<typeof vi.fn>

// One fresh QueryClient per render — no cross-test cache leakage; retry:false
// keeps a rejected fetch fast.
function renderCard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return render(<KoiosForYouCard />, { wrapper })
}

const emptyReport = { period: '7d', actions_total: 0, per_type: {}, per_source: {}, latest: [] }

afterEach(() => {
  vi.clearAllMocks()
})

describe('KoiosForYouCard', () => {
  it('fetches the report with days=7 by default', async () => {
    apiGet.mockResolvedValue({ data: emptyReport })
    renderCard()
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(1))
    expect(apiGet).toHaveBeenCalledWith('/ai/koios/for-you', expect.objectContaining({ params: { days: 7 } }))
  })

  it('switches to days=30 via the period toggle', async () => {
    apiGet.mockResolvedValue({ data: emptyReport })
    renderCard()
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('radio', { name: 'koiosForYou.period.30' }))

    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(2))
    expect(apiGet).toHaveBeenLastCalledWith('/ai/koios/for-you', expect.objectContaining({ params: { days: 30 } }))
  })

  it('shows the loading state while the request is in flight', async () => {
    let resolveFn: (v: unknown) => void = () => {}
    apiGet.mockReturnValue(new Promise((resolve) => { resolveFn = resolve }))
    renderCard()
    expect(screen.getByText('common:loading')).toBeInTheDocument()
    resolveFn({ data: emptyReport })
    await waitFor(() => expect(screen.queryByText('common:loading')).not.toBeInTheDocument())
  })

  it('renders a calm empty state when actions_total is 0', async () => {
    apiGet.mockResolvedValue({ data: emptyReport })
    renderCard()
    await waitFor(() => expect(screen.getByText('koiosForYou.empty')).toBeInTheDocument())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('renders a calm error notice with a working retry on failure', async () => {
    apiGet.mockRejectedValue(new Error('network down'))
    renderCard()
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('koiosForYou.loadError'))

    apiGet.mockResolvedValue({ data: emptyReport })
    fireEvent.click(screen.getByRole('button', { name: /error\.retry/ }))
    await waitFor(() => expect(screen.getByText('koiosForYou.empty')).toBeInTheDocument())
  })

  it('renders the hero total, per-type chips and latest runs on success', async () => {
    apiGet.mockResolvedValue({
      data: {
        period: '7d',
        actions_total: 3,
        per_type: { koios_create_task: 2, koios_send_whatsapp: 1 },
        per_source: { note: 2, chat: 1 },
        latest: [
          { run_id: 'r1', template_key: 'koios_create_task', source: 'note:abc', created_at: '2026-08-01T10:00:00Z', status: 'completed' },
          { run_id: 'r2', template_key: 'koios_send_whatsapp', source: 'chat', created_at: '2026-08-02T10:00:00Z', status: 'failed' },
        ],
      },
    })
    renderCard()
    await waitFor(() => expect(screen.getByText('3')).toBeInTheDocument())
    expect(screen.getByText('Create Task · 2')).toBeInTheDocument()
    expect(screen.getByText('Send Whatsapp · 1')).toBeInTheDocument()
  })
})
