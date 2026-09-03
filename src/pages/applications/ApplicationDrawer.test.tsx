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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ComponentProps } from 'react'
// Real i18n (nl) side-effect init so t() resolves genuine Dutch text — the
// removed badge rendered the literal "Actief" copy this test asserts against.
import '@/i18n'
import ApplicationDrawer from './ApplicationDrawer'
import { useAuth } from '@/context/AuthContext'
import type { ApplicationDetail } from '@/types/application'

// ApplicationDrawer wires useApplicationCandidateEdit directly (the header
// pencil) — it reads useQueryClient() to invalidate on save (REFRESH-FIX-2),
// so even with CandidateTab mocked below, a provider is required.
const renderDrawer = (props: ComponentProps<typeof ApplicationDrawer>) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><ApplicationDrawer {...props} /></QueryClientProvider>)
}

// Lookups/custom-fields arrive via mocked hooks — no providers needed.
vi.mock('@/context/LookupsContext', () => ({
  useLookups: () => ({ funnelTypes: [{ value: 'invited', label: 'Uitgenodigd' }] }),
}))
// RIGHTS-GATE-OPENERS-1: wrapped in vi.fn() so the footer/action gate test below
// can override hasPermission — defaults to true (the S21 header tests above never
// exercise the footer, so this default is unused by them).
vi.mock('@/context/AuthContext', () => ({ useAuth: vi.fn(() => ({ hasPermission: () => true })) }))
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
    renderDrawer({ application: application(), onClose: vi.fn() })
    // The badge used to render this exact translated bucket label — Danny's
    // literal complaint ("ACTIEF???"). It must be entirely absent now.
    expect(screen.queryByText('Actief')).not.toBeInTheDocument()
    // The candidate name stays, directly in the title row.
    expect(screen.getByText('Jan Jansen')).toBeInTheDocument()
    // The Fase meta picker (single source of truth for the phase) is untouched.
    expect(screen.getByText('Fase')).toBeInTheDocument()
    // The changelog popover icon in the title row is untouched. Its name now comes from
    // the shared common:changelog key — every entity used to word this control
    // differently ("Wijzigingslog" / "Wijzigingen" / "Activiteit"), unified 28-07.
    expect(screen.getByRole('button', { name: 'Wijzigingslog' })).toBeInTheDocument()
  })

  it('still renders the matched/rejected bucket data path elsewhere unaffected (no badge for any bucket value)', () => {
    // Regression net: whichever bucket value the application carries, no chip
    // with its translated label appears in the header — the removal is
    // unconditional, not just for 'active'.
    renderDrawer({ application: application({ bucket: 'rejected' }), onClose: vi.fn() })
    expect(screen.queryByText('Afgewezen')).not.toBeInTheDocument()
  })
})

// RIGHTS-GATE-OPENERS-1: the footer's Afwijzen/Ontkoppelen and the header's
// "Voorstellen aan klant" all read the applications.update permission via the
// local canManageApplication check — hidden without it, never a dead button (§3).
// canManage=true on the caller's own prop so the gate under test is specifically
// the LOCAL permission check, not the pre-existing prop gate.
describe('ApplicationDrawer · footer/action gate (RIGHTS-GATE-OPENERS-1)', () => {
  const activeApp = application({ bucket: 'active', vacancyId: 'v1', candidateId: 'cand-1', customerId: 'cust-1' } as Partial<ApplicationDetail>)

  it('hides Afwijzen, Ontkoppelen and Voorstellen aan klant without applications.update', () => {
    vi.mocked(useAuth).mockReturnValue({ hasPermission: () => false } as unknown as ReturnType<typeof useAuth>)
    renderDrawer({ application: activeApp, onClose: vi.fn(), canManage: true })
    expect(screen.queryByRole('button', { name: 'Afwijzen' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ontkoppelen' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Voorstellen aan klant' })).not.toBeInTheDocument()
  })

  it('shows Afwijzen, Ontkoppelen and Voorstellen aan klant with applications.update', () => {
    vi.mocked(useAuth).mockReturnValue({ hasPermission: () => true } as unknown as ReturnType<typeof useAuth>)
    renderDrawer({ application: activeApp, onClose: vi.fn(), canManage: true })
    expect(screen.getByRole('button', { name: 'Afwijzen' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ontkoppelen' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Voorstellen aan klant' })).toBeInTheDocument()
  })
})
