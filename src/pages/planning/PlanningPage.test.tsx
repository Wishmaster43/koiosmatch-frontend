/**
 * PlanningPage — PLANNING-PERSIST-1 regression test (CMFE audit 2026-07-28): this
 * calendar's shifts are 100% local demo data (never fetched from a server) and
 * `handleAdd` only appends to that in-memory array — see the file header for the
 * full finding. This covers the honest, translated notice this page now shows so
 * nobody mistakes the calendar's content for a tenant's real, saved schedule.
 * react-i18next is mocked to return the raw key so the assertion targets a stable
 * key, not locale copy.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import PlanningPage from './PlanningPage'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/context/RightPanelContext', () => ({
  useRightPanel: () => ({ registerFilters: vi.fn(), unregisterFilters: vi.fn() }),
}))

describe('PlanningPage · not-yet-persisted gate (PLANNING-PERSIST-1)', () => {
  it('shows the calm notice explaining the calendar is preview data, not a saved schedule', () => {
    render(<PlanningPage />)
    expect(screen.getByText('previewNotice')).toBeInTheDocument()
  })
})
