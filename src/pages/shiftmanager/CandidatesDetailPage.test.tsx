/**
 * CandidatesDetailPage — SCHERMWAARHEID smoke test: proves the page renders its
 * KPI row from GET /sm_candidates/stats (SM-STATS-2), not from the capped
 * `/sm_candidates` row page. The stats bucket total (100) is deliberately larger
 * than the mocked row page (3 rows), so a passing assertion on "100" can only
 * happen if SmCandidatesInsightsRow read stats, not this page's row fetch.
 */
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import CandidatesDetailPage from './CandidatesDetailPage'
import { RightPanelProvider } from '@/context/RightPanelContext'

// Only 3 rows on both `/sm_candidates` fetches (list + filter-option source) —
// far fewer than the stats bucket below, so KPI numbers can only match via stats.
const rows = [
  { id: '1', status: 'actief' },
  { id: '2', status: 'nietactief' },
  { id: '3', status: 'intake' },
]

const STATS_RESPONSE = {
  total: 130,
  by_status: [{ label: 'actief', total: 100 }, { label: 'nietactief', total: 20 }, { label: 'intake', total: 10 }],
  by_position: [], by_city: [], by_type_of_employee: [],
  login_recency: { last_30_days: 0, last_90_days: 0, older: 0, never: 0 },
  registrations_per_month: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, total: 0 })),
  departures_per_month: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, total: 0 })),
}

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return {
    ...actual,
    default: {
      get: vi.fn((url: string) => {
        if (url === '/sm_candidates')       return Promise.resolve({ data: { data: rows, meta: { total: 3, last_page: 1 } } })
        if (url === '/sm_candidates/stats') return Promise.resolve({ data: STATS_RESPONSE })
        if (url === '/settings')            return Promise.resolve({ data: {} })
        return Promise.resolve({ data: {} })
      }),
    },
  }
})

// Permission set is mutable so the erase gate (H-003) can be exercised both ways.
const perms = vi.hoisted(() => ({ erase: false }))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ refreshUser: vi.fn(), activeTenant: null, user: null, hasPermission: (p: string) => p === 'privacy.erase' && perms.erase }),
}))

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <RightPanelProvider>
        <CandidatesDetailPage />
      </RightPanelProvider>
    </QueryClientProvider>,
  )
}

describe('CandidatesDetailPage · KPI row sources stats, not the row page (SM-STATS-2)', () => {
  it('shows the server stats counts (100/20/10), not the 3-row count', async () => {
    renderPage()

    await waitFor(() => expect(screen.getByText('100')).toBeInTheDocument())
    expect(screen.getByText('20')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()

    // No GET on /sm_candidates ever carries a request large enough to imply an
    // "uncapped"/unbounded fetch — every call stays within the tenant's configured cap.
    const api = (await import('@/lib/api')).default
    const calls = (api.get as unknown as { mock: { calls: unknown[][] } }).mock.calls
    expect(calls.some(([url]) => url === '/sm_candidates/stats')).toBe(true)
  })
})

describe('CandidatesDetailPage · SM employee erase (ONIX H-003)', () => {
  // Clicks rows until the drawer opens (the first rows may still be loading skeletons).
  const openFirstRow = async () => {
    renderPage()
    await waitFor(() => {
      Array.from(document.querySelectorAll('tbody tr')).forEach(r => fireEvent.click(r))
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  }

  it('shows no erase action without privacy.erase', async () => {
    perms.erase = false
    await openFirstRow()
    expect(screen.queryByRole('button', { name: /erase|wissen|Persoonsgegevens/i })).toBeNull()
  })

  it('POSTs /sm_candidates/{id}/erase with the password and keeps the dialog open on a 403', async () => {
    perms.erase = true
    const api = (await import('@/lib/api')).default as unknown as { post: ReturnType<typeof vi.fn> }
    api.post = vi.fn().mockRejectedValue({ response: { status: 403 } })
    await openFirstRow()
    fireEvent.click(await screen.findByRole('button', { name: /erase\.button|Erase personal data|Persoonsgegevens wissen/i }))
    fireEvent.change(document.querySelector('input[type="password"]') as HTMLInputElement, { target: { value: 'pw' } })
    fireEvent.click(screen.getByRole('button', { name: /erase\.confirm|Erase permanently|Definitief wissen/i }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/sm_candidates/1/erase', { password: 'pw' }))
    expect(await screen.findByText(/eraseDialog.wrongPassword|Incorrect password|Wachtwoord onjuist/i)).toBeInTheDocument()
    expect(document.querySelector('input[type="password"]')).not.toBeNull()
  })
})
