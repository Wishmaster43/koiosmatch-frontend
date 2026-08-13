/**
 * StatisticsTab — honest, derived statistics only (STATS-HONEST-1, B11 point 19).
 * The old "Statusoverzicht" card held dossier fields, not statistics, and every
 * one of them duplicated a place that also lets you edit it: status → the drawer
 * header picker, last contact + contact type → the always-visible drawer footer,
 * branch → the Profiel tab's BranchSection, created-on/by + source → the Profiel
 * tab's Herkomst card (DANNY-6). This suite guards that none of them can silently
 * reappear here, that the KPIs keep counting from the candidate payload, that the
 * gated Diensten/Uren tiles never ship an invented number, and that each new
 * derived block (outcomes/appointments/notes/timeline) renders only when its own
 * source data is actually present — never a fabricated zero.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import StatisticsTab from './StatisticsTab'
// Vite's ?raw import — the source-level guard below reads this file's own text
// (node:fs is not typed in this tsconfig, and jsdom gives import.meta an http URL).
import statisticsTabSource from './StatisticsTab.tsx?raw'
import type { Candidate } from '@/types/candidate'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k) }),
}))
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => v }) }))

let mockNotes: { notes: unknown[]; loaded: boolean } = { notes: [], loaded: true }
vi.mock('@/pages/candidates/hooks/useCandidateNotes', () => ({
  useCandidateNotes: () => mockNotes,
}))

let mockAppointmentsResponse: unknown[] = []
vi.mock('@/lib/api', () => ({
  default: { get: () => Promise.resolve({ data: { data: mockAppointmentsResponse } }) },
  unwrapList: (r: { data?: { data?: unknown[] } }) => ({ rows: r.data?.data ?? [] }),
}))

const baseCandidate = (overrides: Partial<Candidate> = {}): Candidate =>
  ({ id: 1, matches: [], applications: [], branches: [], ...overrides } as unknown as Candidate)

describe('StatisticsTab · dossier fields live elsewhere (STATS-HONEST-1 / DANNY-6)', () => {
  it('renders no status-overview card and none of its former rows', async () => {
    mockNotes = { notes: [], loaded: true }
    mockAppointmentsResponse = []
    render(<StatisticsTab c={baseCandidate({
      status: 'available',
      lastContactDate: '2026-08-01', lastContactType: 'phone', lastContactBy: 'Bente de Jong',
      branches: [{ id: 'b1', name: 'Utrecht' }] as Candidate['branches'],
      createdBy: { id: 7, name: 'Bente de Jong' }, source: 'indeed', created: '2026-01-05',
    })} />)
    await waitFor(() => {})
    expect(screen.queryByText('statistics.statusOverview')).not.toBeInTheDocument()
    for (const key of ['statistics.status', 'statistics.contactType',
      'statistics.branch', 'statistics.memberSince', 'statistics.createdBy', 'statistics.source']) {
      expect(screen.queryByText(key)).not.toBeInTheDocument()
    }
    expect(screen.queryByText(/Bente de Jong/)).not.toBeInTheDocument()
    expect(screen.queryByText('indeed')).not.toBeInTheDocument()
    expect(screen.queryByText('Utrecht')).not.toBeInTheDocument()
  })
})

describe('StatisticsTab · the two KPIs count the real payload', () => {
  it('shows the match and application counts from the candidate record', () => {
    render(<StatisticsTab c={baseCandidate({
      matches: [{ id: 'm1' }, { id: 'm2' }] as Candidate['matches'],
      applications: [{ id: 'a1' }] as Candidate['applications'],
    })} />)
    expect(screen.getByText('statistics.placements')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('statistics.applications')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('falls back to 0 — never blank — when the record carries no lists at all', () => {
    render(<StatisticsTab c={{ id: 1 } as unknown as Candidate} />)
    expect(screen.getAllByText('0')).toHaveLength(2)
  })

  it('jumps to the Werk tab, where the counted records live', () => {
    const onJump = vi.fn()
    render(<StatisticsTab c={baseCandidate()} onJump={onJump} />)
    screen.getByText('statistics.placements').closest('[role="button"]')?.dispatchEvent(
      new MouseEvent('click', { bubbles: true })
    )
    expect(onJump).toHaveBeenCalledWith('work')
  })
})

describe('StatisticsTab · the gated shift/hour tiles carry no invented numbers', () => {
  // Source-level guard: the example values 24 and 186 once shipped as `?? 24` /
  // `?? 186` fallbacks. Uncommenting the tiles must never resurrect them, so the
  // assertion reads the file rather than the DOM (the tiles do not render today).
  it('never re-introduces the 24 / 186 example fallbacks', () => {
    expect(statisticsTabSource).not.toMatch(/shiftsCount\s*\?\?\s*(?!0\b)\d+/)
    expect(statisticsTabSource).not.toMatch(/hoursWorked\s*\?\?\s*(?!0\b)\d+/)
  })

  it('renders exactly the two honest KPIs while planning data is absent', () => {
    render(<StatisticsTab c={baseCandidate()} />)
    expect(screen.queryByText('statistics.shifts')).not.toBeInTheDocument()
    expect(screen.queryByText('statistics.hoursWorked')).not.toBeInTheDocument()
  })
})

describe('StatisticsTab · derived blocks hide without their own source data (B11 point 19)', () => {
  it('shows no outcome/appointments/notes/timeline blocks for a bare candidate', async () => {
    mockNotes = { notes: [], loaded: true }
    mockAppointmentsResponse = []
    render(<StatisticsTab c={baseCandidate()} />)
    await waitFor(() => {})
    expect(screen.queryByText('statistics.byOutcome')).not.toBeInTheDocument()
    expect(screen.queryByText('statistics.appointments')).not.toBeInTheDocument()
    // Notes loaded (empty array) still renders a "0 notes" line — that IS real data.
    expect(screen.queryByText('statistics.timeline')).not.toBeInTheDocument()
  })

  it('renders the applications-by-outcome block once applications carry a stage', () => {
    render(<StatisticsTab c={baseCandidate({
      applications: [
        { id: 1, stageKey: 'applied', stageLabel: 'Applied', stageColor: '#2563eb' },
        { id: 2, stageKey: 'applied', stageLabel: 'Applied', stageColor: '#2563eb' },
      ] as unknown as Candidate['applications'],
    })} />)
    expect(screen.getByText('statistics.byOutcome')).toBeInTheDocument()
    expect(screen.getByText('Applied')).toBeInTheDocument()
    expect(screen.getAllByText('2').length).toBeGreaterThan(0)
  })

  it('renders the appointments block once the side-load resolves with rows', async () => {
    mockAppointmentsResponse = [{ id: 1, status: 'scheduled', scheduled_at: '2099-01-01T00:00:00Z' }]
    render(<StatisticsTab c={baseCandidate()} />)
    expect(await screen.findByText('statistics.appointments')).toBeInTheDocument()
  })

  it('renders notes count + last contact once their sources exist', () => {
    mockNotes = { notes: [{ id: 1 }, { id: 2 }], loaded: true }
    render(<StatisticsTab c={baseCandidate({ lastContactAt: '2026-08-01', lastContactType: 'phone' })} />)
    expect(screen.getByText('statistics.notesCount:{"count":2}')).toBeInTheDocument()
    expect(screen.getByText(/statistics.lastContact/)).toBeInTheDocument()
  })

  it('renders the timeline block once created/phase-change dates exist', () => {
    render(<StatisticsTab c={baseCandidate({ created: '2026-01-01', statusChangedAt: '2026-01-05' })} />)
    expect(screen.getByText('statistics.timeline')).toBeInTheDocument()
  })
})
