/**
 * CampaignStatsTab (G31) — GET /outreach-campaigns/{id}/stats existed but was
 * never shown. Tests the transform from the raw by_status/by_outcome/by_assignee
 * arrays into donut specs (label/colour resolved via the tenant lookups,
 * zero-count segments dropped) and the click-to-filter wiring (a donut pick
 * calls onPick(axis, value); the active axis reflects the current filter).
 * InsightsRow itself is mocked — its own rendering/click plumbing is out of
 * scope here (components/insights/InsightsRow.test.tsx); this file only proves
 * CampaignStatsTab hands it the RIGHT config.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
// Real i18n (nl) side-effect init so t() resolves genuine Dutch/default copy.
import '@/i18n'
import nlOutreach from '@/i18n/locales/nl/outreach.json'
import CampaignStatsTab from './CampaignStatsTab'

interface CapturedDonut { key: string; title?: string; data: Array<{ name: string; key: string; value: number; color?: string }>; active?: boolean; picked?: string | null; onPick?: (d: unknown) => void }
interface CapturedKpi { key: string; label?: string; value?: number }

const { capturedProps } = vi.hoisted(() => ({
  capturedProps: { current: null as { donuts: CapturedDonut[]; kpis: CapturedKpi[] } | null },
}))
vi.mock('@/components/insights/InsightsRow', () => ({
  default: (props: { donuts: CapturedDonut[]; kpis: CapturedKpi[] }) => { capturedProps.current = props; return <div data-testid="insights-row" /> },
}))

const { statsMock } = vi.hoisted(() => ({ statsMock: vi.fn() }))
vi.mock('../hooks/useOutreachStats', () => ({ useOutreachStats: (id: string | null) => statsMock(id) }))

/* eslint-disable no-restricted-syntax -- DATA: mock hex mirrors the real seed lookups, not UI styling */
vi.mock('@/lib/useOutreachStatuses', () => ({
  useOutreachStatuses: () => ({
    metaOf: (v?: string) => ({
      todo: { label: 'Te doen', color: '#94A3B8', is_reached: false },
      contacted: { label: 'Benaderd', color: '#6E8FD6', is_reached: true },
    } as Record<string, { label: string; color: string; is_reached: boolean }>)[v ?? ''],
  }),
}))
vi.mock('@/lib/useOutreachOutcomes', () => ({
  useOutreachOutcomes: () => ({
    metaOf: (v?: string) => ({
      interested: { label: 'Interesse', color: '#79B58E' },
      no_answer: { label: 'Geen gehoor', color: '#DDA071' },
    } as Record<string, { label: string; color: string }>)[v ?? ''],
  }),
}))
/* eslint-enable no-restricted-syntax */

const stats = {
  total: 10,
  by_status: [{ status: 'todo', count: 6 }, { status: 'contacted', count: 4 }],
  by_outcome: [{ outcome: 'interested', count: 2 }, { outcome: 'no_answer', count: 0 }],
  by_assignee: [{ owner_id: 'r1', name: 'Nora Recruiter', count: 3 }, { owner_id: null, name: 'Niet toegewezen', count: 7 }],
}

afterEach(() => { capturedProps.current = null; statsMock.mockReset() })

describe('CampaignStatsTab · four UI states', () => {
  it('shows the loading state', () => {
    statsMock.mockReturnValue({ stats: null, loading: true, error: false })
    render(<CampaignStatsTab campaignId="c1" filter={null} onPick={vi.fn()} onClear={vi.fn()} />)
    expect(screen.getByText(/laden|loading/i)).toBeInTheDocument()
  })

  it('shows the error state', () => {
    statsMock.mockReturnValue({ stats: null, loading: false, error: true })
    render(<CampaignStatsTab campaignId="c1" filter={null} onPick={vi.fn()} onClear={vi.fn()} />)
    expect(screen.getByText(nlOutreach.drawer.stats.error)).toBeInTheDocument()
  })

  it('shows the empty state for a campaign with zero targets', () => {
    statsMock.mockReturnValue({ stats: { total: 0, by_status: [], by_outcome: [], by_assignee: [] }, loading: false, error: false })
    render(<CampaignStatsTab campaignId="c1" filter={null} onPick={vi.fn()} onClear={vi.fn()} />)
    expect(screen.getByText(/geen kandidaten|no candidates/i)).toBeInTheDocument()
  })
})

describe('CampaignStatsTab · donut/KPI config (G31)', () => {
  it('resolves labels/colours from the tenant lookups and drops zero-count segments', () => {
    statsMock.mockReturnValue({ stats, loading: false, error: false })
    render(<CampaignStatsTab campaignId="c1" filter={null} onPick={vi.fn()} onClear={vi.fn()} />)

    const [statusDonut, outcomeDonut, assigneeDonut] = capturedProps.current!.donuts
    /* eslint-disable no-restricted-syntax -- DATA: asserting the mocked lookup's own seed hex, not UI styling */
    expect(statusDonut.data).toEqual([
      { name: 'Te doen', key: 'todo', value: 6, color: '#94A3B8' },
      { name: 'Benaderd', key: 'contacted', value: 4, color: '#6E8FD6' },
    ])
    // no_answer (count: 0) is dropped — an empty ring is more honest than a
    // full circle of invisible slivers.
    expect(outcomeDonut.data).toEqual([{ name: 'Interesse', key: 'interested', value: 2, color: '#79B58E' }])
    /* eslint-enable no-restricted-syntax */
    // Unassigned (owner_id null) uses the '' sentinel key TargetsTab's filter matches.
    expect(assigneeDonut.data).toEqual([
      { name: 'Nora Recruiter', key: 'r1', value: 3, color: undefined },
      { name: 'Niet toegewezen', key: '', value: 7, color: undefined },
    ])
  })

  it('computes the Reached KPI from the is_reached-flagged status counts only', () => {
    statsMock.mockReturnValue({ stats, loading: false, error: false })
    render(<CampaignStatsTab campaignId="c1" filter={null} onPick={vi.fn()} onClear={vi.fn()} />)
    const reached = capturedProps.current!.kpis.find(k => k.key === 'reached')
    // Only 'contacted' (4) is flagged is_reached; 'todo' (6) is not.
    expect(reached?.value).toBe(4)
    expect(capturedProps.current!.kpis.find(k => k.key === 'total')?.value).toBe(10)
  })

  it('a donut pick calls onPick with (axis, value) — the click genuinely filters, never decorative', () => {
    const onPick = vi.fn()
    statsMock.mockReturnValue({ stats, loading: false, error: false })
    render(<CampaignStatsTab campaignId="c1" filter={null} onPick={onPick} onClear={vi.fn()} />)

    const [statusDonut] = capturedProps.current!.donuts
    statusDonut.onPick?.({ key: 'contacted' })
    expect(onPick).toHaveBeenCalledWith('status', 'contacted')
  })

  it('marks only the active filter axis as active, with the matching segment name as `picked`', () => {
    statsMock.mockReturnValue({ stats, loading: false, error: false })
    render(<CampaignStatsTab campaignId="c1" filter={{ axis: 'status', value: 'contacted' }} onPick={vi.fn()} onClear={vi.fn()} />)

    const [statusDonut, outcomeDonut] = capturedProps.current!.donuts
    expect(statusDonut.active).toBe(true)
    expect(statusDonut.picked).toBe('Benaderd')
    expect(outcomeDonut.active).toBe(false)
  })

  it('passes campaignId through to useOutreachStats (entity-keyed fetch)', () => {
    statsMock.mockReturnValue({ stats, loading: false, error: false })
    render(<CampaignStatsTab campaignId="c1" filter={null} onPick={vi.fn()} onClear={vi.fn()} />)
    expect(statsMock).toHaveBeenCalledWith('c1')
  })
})

// Sanity: the hook itself is exercised against the real route/signal in
// outreachApi.test.ts (getCampaignStats); this just confirms this component
// awaits the async state instead of racing loading=false before the effect settles.
describe('CampaignStatsTab · async-safe', () => {
  it('renders once stats resolve, without an act() warning', async () => {
    statsMock.mockReturnValue({ stats, loading: false, error: false })
    render(<CampaignStatsTab campaignId="c1" filter={null} onPick={vi.fn()} onClear={vi.fn()} />)
    await waitFor(() => expect(screen.getByTestId('insights-row')).toBeInTheDocument())
  })
})
