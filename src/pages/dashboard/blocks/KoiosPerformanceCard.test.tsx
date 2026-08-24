/**
 * KoiosPerformanceCard — the management face IS the shared KoiosForYouCard
 * (Danny 24-08: same category tiles, same expand — one idiom) plus a compact
 * performance strip from GET /ai/koios/performance. Pins: both requests, the
 * translated card title, no raw type keys in the DOM, the strip's disclosure
 * and its calm disappearance on 403.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import KoiosPerformanceCard from './KoiosPerformanceCard'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/lib/formatters', () => ({ useNumberFormat: () => ({ formatNumber: (n: number) => String(n) }) }))
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: unknown) => String(v) }) }))
// The shared line chart needs real layout — a stub keeps the strip testable.
vi.mock('@/components/charts/LineChartCard', () => ({ default: ({ title }: { title: ReactNode }) => <div>{title}</div> }))

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})
import api from '@/lib/api'
const apiGet = api.get as unknown as ReturnType<typeof vi.fn>

const forYou = {
  from: '2026-08-24', to: '2026-08-26', period: 'range', actions_total: 8,
  per_type: { koios_create_task: 5, koios_plan_appointment: 3 }, per_source: { note: 8 },
  actions: [], actions_truncated: false,
}
const performance = {
  period: '30d', actions_total: 8,
  per_type: { koios_create_task: 5 }, per_source: { note: 8 },
  executed: { completed: 5, failed: 3, other: 0 },
  top_users: [{ user_id: 'u1', name: 'Danny', count: 8 }],
  timeseries: [{ date: '2026-08-23', count: 8 }],
}

function mockBoth({ perf = Promise.resolve({ data: performance }) }: { perf?: Promise<unknown> } = {}) {
  apiGet.mockImplementation((url: string) => {
    if (url === '/ai/koios/for-you') return Promise.resolve({ data: forYou })
    if (url === '/ai/koios/performance') return perf
    return Promise.resolve({ data: {} })
  })
}

function renderCard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><KoiosPerformanceCard /></QueryClientProvider>)
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-08-26T10:00:00Z'))
})
afterEach(() => { vi.clearAllMocks(); vi.useRealTimers() })

describe('KoiosPerformanceCard', () => {
  it('renders the shared for-you card under the performance title and fetches both endpoints', async () => {
    mockBoth()
    renderCard()
    expect(await screen.findByText('koiosPerformance.title')).toBeInTheDocument()
    // The shared idiom: translated category tiles, never a raw type key.
    expect(await screen.findByText('koiosForYou.category.tasks')).toBeInTheDocument()
    expect(screen.queryByText('koios_create_task')).not.toBeInTheDocument()
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/ai/koios/performance',
      expect.objectContaining({ params: { days: 30 } })))
  })

  it('the strip opens on its disclosure and shows executed counts + top users', async () => {
    mockBoth()
    renderCard()
    const toggle = await screen.findByRole('button', { name: 'koiosPerformance.expand' })
    fireEvent.click(toggle)
    expect(await screen.findByText('koiosPerformance.completed')).toBeInTheDocument()
    expect(screen.getByText('Danny')).toBeInTheDocument()
    expect(screen.getByText('koiosPerformance.trend')).toBeInTheDocument()
  })

  it('hides only the strip on a 403 — the shared card itself stays', async () => {
    mockBoth({ perf: Promise.reject({ response: { status: 403 } }) })
    renderCard()
    expect(await screen.findByText('koiosPerformance.title')).toBeInTheDocument()
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/ai/koios/performance', expect.anything()))
    expect(screen.queryByText('koiosPerformance.stripTitle')).not.toBeInTheDocument()
  })
})
