/**
 * QueueHealthBlock — QUEUE-WATCH-1: verifies the health strip renders the
 * right notice for each queue_status shape, and stays silent (additive-field
 * tolerance, §10) when an older server sends none at all.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import QueueHealthBlock from './QueueHealthBlock'
import type { QueueStatus } from './jobsApi'

// Deterministic key-echo with interpolation (repo-wide precedent, see
// MatchScoreBlock.test.tsx) — avoids depending on the real, async-initialising
// i18n instance while still letting us assert interpolated values landed.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key),
    i18n: { language: 'nl' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}))

const baseStatus: QueueStatus = {
  horizon_running: true,
  master_last_seen_seconds: 300,
  supervisors: [{ name: 'supervisor-1', status: 'running' }],
  scheduler_last_tick_at: '2026-08-13T10:00:00Z',
  watch: { alerting: false, open_incident_since: null },
}

describe('QueueHealthBlock', () => {
  it('renders nothing when queue_status is absent (older server)', () => {
    const { container } = render(<QueueHealthBlock queueStatus={undefined} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the calm success line + supervisor chips when everything is healthy', () => {
    render(<QueueHealthBlock queueStatus={baseStatus} />)
    // 300s → 5 minutes, 5-minute-granularity rounding.
    expect(screen.getByText('jobs.health.healthySeen:{"minutes":5}')).toBeInTheDocument()
    expect(screen.getByText('supervisor-1: running')).toBeInTheDocument()
    expect(screen.queryByText('jobs.health.horizonDown')).not.toBeInTheDocument()
  })

  it('shows the danger notice when horizon_running is false', () => {
    render(<QueueHealthBlock queueStatus={{ ...baseStatus, horizon_running: false }} />)
    expect(screen.getByText('jobs.health.horizonDown')).toBeInTheDocument()
  })

  it('shows the scheduler-down notice when scheduler_last_tick_at is null', () => {
    render(<QueueHealthBlock queueStatus={{ ...baseStatus, scheduler_last_tick_at: null }} />)
    expect(screen.getByText('jobs.health.schedulerDown')).toBeInTheDocument()
  })

  it('shows a prominent incident banner with the formatted date when watch.alerting is true', () => {
    render(<QueueHealthBlock queueStatus={{ ...baseStatus, watch: { alerting: true, open_incident_since: '2026-08-13T09:15:00Z' } }} />)
    const banner = screen.getByRole('alert')
    // The formatted (DD-MM-YYYY HH:mm) value is interpolated — never a raw ISO string.
    expect(banner.textContent).toContain('jobs.health.incidentBanner:')
    expect(banner.textContent).not.toContain('2026-08-13T09:15:00Z')
  })
})
