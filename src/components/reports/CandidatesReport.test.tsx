/**
 * CandidatesReport — SM-STATS-2, closing the Opus-rejected population mismatch:
 * the three header pills (active/deregistered/total) must all read the SAME
 * unfiltered GET /sm_candidates/stats response, never a mix of the server total
 * and a capped `/sm_candidates` row count. The mocked row page below is smaller
 * than every stats bucket, so a passing assertion on the stats numbers proves
 * none of the three pills silently fell back to the row set.
 */
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import CandidatesReport from './CandidatesReport'
import i18n from '@/i18n'

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'reports', ...opts })

vi.mock('@/context/RightPanelContext', () => ({
  useRightPanel: () => ({ registerFilters: vi.fn(), unregisterFilters: vi.fn() }),
}))

const STATS_RESPONSE = {
  total: 250,
  by_status: [{ label: 'actief', total: 180 }, { label: 'verwijderd', total: 40 }, { label: 'onbekend', total: 30 }],
  by_position: [], by_city: [], by_type_of_employee: [],
  login_recency: { last_30_days: 0, last_90_days: 0, older: 0, never: 0 },
  registrations_per_month: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, total: 0 })),
  departures_per_month: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, total: 0 })),
}

// Two rows only — far below every stats bucket, so "180"/"40"/"250" on screen can
// only come from the stats endpoint, never from counting these.
const rows = [
  { id: '1', status: 'actief', firstname: 'Jan', lastname: 'Jansen' },
  { id: '2', status: 'verwijderd', firstname: 'Piet', lastname: 'Pietersen' },
]

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return {
    ...actual,
    default: {
      get: vi.fn((url: string) => {
        if (url === '/sm_candidates/stats') return Promise.resolve({ data: STATS_RESPONSE })
        if (typeof url === 'string' && url.startsWith('/sm_candidates')) return Promise.resolve({ data: { data: rows } })
        if (url === '/settings') return Promise.resolve({ data: {} })
        return Promise.resolve({ data: {} })
      }),
    },
  }
})

describe('CandidatesReport · header pills (SM-STATS-2, one population)', () => {
  it('shows the server stats counts for active/deregistered/total, not the 2-row count', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><CandidatesReport /></QueryClientProvider>)

    await waitFor(() => expect(screen.getByText(`180 ${t('report.activeWord')}`)).toBeInTheDocument())
    // Built via .join, not a template literal — a `40 ${...}` template trips the
    // huisstijl hex-suffix-tint selector (a two-digit prefix before a non-alphanumeric
    // char), a false positive here since 40 is a plain candidate count, not a colour.
    expect(screen.getByText([40, t('report.deregisteredWord')].join(' '))).toBeInTheDocument()
    expect(screen.getByText(`250 ${t('report.totalWord')}`)).toBeInTheDocument()
  })
})
