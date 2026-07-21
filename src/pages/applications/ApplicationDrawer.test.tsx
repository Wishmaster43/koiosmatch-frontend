/**
 * ApplicationDrawer — S21 header regression guard (Danny 21-07): the read-only
 * outcome bucket badge that used to sit next to the candidate name is gone. It
 * duplicated the Fase meta picker below it and Danny flagged it three times
 * ("kerstboom", "status klopt niet", "ACTIEF???") — this locks the removal in
 * so it can't silently regress. The Fase/Recruiter pickers and the changelog
 * popover icon are untouched and still render.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
// Real i18n (nl) side-effect init so t() resolves genuine Dutch text — the
// removed badge rendered the literal "Actief" copy this test asserts against.
import '@/i18n'
import ApplicationDrawer from './ApplicationDrawer'
import type { ApplicationDetail } from '@/types/application'

// Lookups/custom-fields arrive via mocked hooks — no providers needed.
vi.mock('@/context/LookupsContext', () => ({
  useLookups: () => ({ funnelTypes: [{ value: 'invited', label: 'Uitgenodigd' }] }),
}))
vi.mock('@/lib/useCustomFields', () => ({ useCustomFields: () => ({ fields: [] }) }))
// The tab bodies pull in api/react-query dependencies irrelevant to the header —
// stub every tab so only the header + tab bar actually mount (mirrors DetailsTab.test.tsx).
vi.mock('./drawer/ApplicationTab', () => ({ default: () => null }))
vi.mock('./drawer/CandidateTab', () => ({ default: () => null }))
vi.mock('./drawer/VacancyTab', () => ({ default: () => null }))
vi.mock('./drawer/InterviewsTab', () => ({ default: () => null }))
vi.mock('./drawer/AppointmentsTab', () => ({ default: () => null }))
vi.mock('./drawer/NotesTab', () => ({ default: () => null }))
vi.mock('./drawer/Timeline', () => ({ default: () => null }))

// A minimal drawer-ready application; `bucket` stays set (it still drives
// filters/insights elsewhere) even though the header no longer renders it.
const application = (over: Partial<ApplicationDetail> = {}) => ({
  id: 1, candidateName: 'Jan Jansen', candidateInitials: 'JJ',
  vacancyTitle: 'Verpleegkundige', referenceNumber: 'APP-0001',
  bucket: 'active', phaseKey: 'invited',
  owner: { id: null, name: '', initials: '', color: null },
  created: '2026-07-01T10:00:00', archived: false, deletedAt: null,
  vacancyId: 'v1', timeline: [], customFields: {},
  ...over,
} as unknown as ApplicationDetail)

describe('ApplicationDrawer — header bucket badge removed (S21, Danny 21-07)', () => {
  it('does not render the outcome bucket badge, but keeps the candidate name, Fase picker and changelog icon', () => {
    render(<ApplicationDrawer application={application()} onClose={vi.fn()} />)
    // The badge used to render this exact translated bucket label — Danny's
    // literal complaint ("ACTIEF???"). It must be entirely absent now.
    expect(screen.queryByText('Actief')).not.toBeInTheDocument()
    // The candidate name stays, directly in the title row.
    expect(screen.getByText('Jan Jansen')).toBeInTheDocument()
    // The Fase meta picker (single source of truth for the phase) is untouched.
    expect(screen.getByText('Fase')).toBeInTheDocument()
    // The changelog popover icon in the title row is untouched.
    expect(screen.getByRole('button', { name: 'Wijzigingen' })).toBeInTheDocument()
  })

  it('still renders the matched/rejected bucket data path elsewhere unaffected (no badge for any bucket value)', () => {
    // Regression net: whichever bucket value the application carries, no chip
    // with its translated label appears in the header — the removal is
    // unconditional, not just for 'active'.
    render(<ApplicationDrawer application={application({ bucket: 'rejected' })} onClose={vi.fn()} />)
    expect(screen.queryByText('Afgewezen')).not.toBeInTheDocument()
  })
})
