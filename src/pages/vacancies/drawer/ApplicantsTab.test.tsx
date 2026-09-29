import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ApplicantsTab from './ApplicantsTab'
import { mapVacancyDetail } from '../data/mapVacancy'

// The real tenant phase lookup — a stable `value` per phase, unlike WorkTab's
// candidate-embed which only carries a resolved label (V14: this side wires the
// filter directly to the lookup instead of a derived-from-rows fallback).
/* eslint-disable no-restricted-syntax -- DATA: fixture tenant phase colours, not a style rule. */
const PHASES = [
  { value: 'applied', label: 'Applied', color: '#3B82F6' },
  { value: 'hired', label: 'Hired', color: '#10B981' },
]
/* eslint-enable no-restricted-syntax */
vi.mock('@/context/VacancyLookupsContext', () => ({
  useVacancyLookups: () => ({ phases: PHASES, phaseMeta: () => ({ label: null, color: null }) }),
}))
// INTERVIEW-VISIBILITY-1: the toggles' useAllSettings() reads getActiveTenantId
// off this same module — an omitted export throws before the component renders.
vi.mock('@/lib/api', () => ({ default: { get: vi.fn(() => Promise.resolve({ data: { data: {} } })) }, unwrap: (r: unknown) => r, getActiveTenantId: () => 't1' }))
// Default: a TARGETED per-permission flag (mirrors ScopedMatchesTab.test.tsx:30),
// not a blanket () => true — a mis-wire to the wrong permission key would fail
// this default too, not just the dedicated gate tests below. Grants exactly the
// two permissions this tab actually checks so the pre-existing house-toolbar/
// phase-filter tests (which never touch auth) keep seeing today's UI. The
// OPENERS-HIDE-1 gate describe further down overrides this via vi.doMock +
// vi.resetModules + a dynamic re-import, same pattern as the pencil/unlink test.
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ hasPermission: (p: string) => ['applications.update', 'applications.create'].includes(p) }),
}))
vi.mock('@/pages/candidates/drawer/PlanIntakeModal', () => ({ default: () => null }))
vi.mock('@/pages/applications/AddApplicationModal', () => ({ default: () => null }))
vi.mock('@/pages/candidates/drawer/AddApplicationModal', () => ({ default: () => null }))
vi.mock('@/pages/candidates/drawer/DetachApplicationModal', () => ({ default: () => null }))
// Reused row (S-vacapp-1) pulls in useDateFormat, which pulls in the real i18n
// init — mocked out exactly like WorkTab.test.tsx so this file stays on the
// same "untranslated raw key" test convention as the rest of this suite.
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => `fmt(${v})`, formatDateTime: (v: string) => `dt(${v})`, locale: 'nl-NL' }) }))

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw API-shaped fixture, mapVacancyDetail's own input type
const vacancy = (applications: any[]) => mapVacancyDetail({ id: 'v1', title: 'Verpleegkundige', applications, applicationsByPhase: {} })

describe('ApplicantsTab · house toolbar (V14)', () => {
  it('renders the search box, the phase status filter and the add button in house order', () => {
    render(<ApplicantsTab vacancy={vacancy([])} />)
    expect(screen.getByPlaceholderText('applicants.searchPlaceholder')).toBeInTheDocument()
    expect(screen.getByTitle('filters.statusFilter')).toBeInTheDocument()
    // DRAWER-ADD-SHORT-1: the visible text collapses to the shared "new" word,
    // but the full label stays the accessible name/title.
    expect(screen.getByRole('button', { name: 'applicants.addApplication' })).toBeInTheDocument()
  })

  it('search narrows the applications list by candidate name', async () => {
    render(<ApplicantsTab vacancy={vacancy([
      { id: 'a1', candidate_id: 'c1', candidate_name: 'Jan Jansen', phase: { value: 'applied' } },
      { id: 'a2', candidate_id: 'c2', candidate_name: 'Piet Pietersen', phase: { value: 'applied' } },
    ])} />)
    expect(screen.getByText('Jan Jansen')).toBeInTheDocument()
    expect(screen.getByText('Piet Pietersen')).toBeInTheDocument()
    await userEvent.type(screen.getByPlaceholderText('applicants.searchPlaceholder'), 'Jan')
    expect(screen.getByText('Jan Jansen')).toBeInTheDocument()
    expect(screen.queryByText('Piet Pietersen')).toBeNull()
  })
})

// PDF-VACATURES-11: the "Per fase" breakdown block above the list is gone —
// the toolbar's own StatusFilterSelect is now the ONLY phase filter, and it
// still narrows the list exactly as before.
describe('ApplicantsTab · the toolbar phase filter narrows the list (PDF-VACATURES-11)', () => {
  it('has no separate per-phase breakdown row above the list', () => {
    render(<ApplicantsTab vacancy={vacancy([
      { id: 'a1', candidate_id: 'c1', candidate_name: 'Jan Jansen', phase: { value: 'applied' } },
    ])} />)
    expect(screen.queryByRole('button', { name: /^Applied/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Hired/ })).toBeNull()
  })

  it('picking a phase in the toolbar filter narrows the list to that phase', async () => {
    render(<ApplicantsTab vacancy={vacancy([
      { id: 'a1', candidate_id: 'c1', candidate_name: 'Jan Jansen', phase: { value: 'applied' } },
      { id: 'a2', candidate_id: 'c2', candidate_name: 'Piet Pietersen', phase: { value: 'hired' } },
    ])} />)
    expect(screen.getByText('Jan Jansen')).toBeInTheDocument()
    expect(screen.getByText('Piet Pietersen')).toBeInTheDocument()

    await userEvent.click(screen.getByTitle('filters.statusFilter'))
    await userEvent.click(screen.getByRole('button', { name: 'Applied' }))

    expect(screen.getByText('Jan Jansen')).toBeInTheDocument()
    expect(screen.queryByText('Piet Pietersen')).toBeNull()
  })
})

// S-vacapp-1: the applicant row REUSES the candidate drawer's own ApplicationRow
// (record EntityLink, pencil-edit, reason-gated unlink, lazy detail, pagination)
// — never a second, forked row implementation.
describe('ApplicantsTab · reuses the candidate drawer ApplicationRow (S-vacapp-1)', () => {
  it('links each row to the APPLICATION record (not a second, forked link)', () => {
    render(<ApplicantsTab vacancy={vacancy([
      { id: 'a1', candidate_id: 'c1', candidate_name: 'Jan Jansen', phase: { value: 'applied' } },
    ])} />)
    // The reused row's own accessible "open in new tab" affordance proves
    // ApplicationRow (not a hand-rolled row) rendered for this applicant.
    expect(screen.getAllByTitle('openInNewTab').length).toBeGreaterThan(0)
  })

  it('hides pencil/unlink without applications.update, shows them with it', async () => {
    // resetModules is now required here (unlike before OPENERS-HIDE-1 added the
    // file-wide default AuthContext mock above): without it this doMock would
    // override a module the earlier static import already resolved/cached.
    vi.resetModules()
    // Targeted flag: only a WRONG permission is granted, so this proves the
    // gate reads applications.update specifically, not just "some permission".
    vi.doMock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: (p: string) => p === 'applications.create' }) }))
    const { default: NoPerm } = await import('./ApplicantsTab')
    const { unmount } = render(<NoPerm vacancy={vacancy([
      { id: 'a1', candidate_id: 'c1', candidate_name: 'Jan Jansen', phase: { value: 'applied' } },
    ])} />)
    expect(screen.queryByTitle('work.editApplication')).toBeNull()
    expect(screen.queryByTitle('work.detachApplication')).toBeNull()
    unmount()

    vi.resetModules()
    vi.doMock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: (p: string) => p === 'applications.update' }) }))
    const { default: WithPerm } = await import('./ApplicantsTab')
    render(<WithPerm vacancy={vacancy([
      { id: 'a1', candidate_id: 'c1', candidate_name: 'Jan Jansen', phase: { value: 'applied' } },
    ])} />)
    expect(screen.getByTitle('work.editApplication')).toBeInTheDocument()
    expect(screen.getByTitle('work.detachApplication')).toBeInTheDocument()
  })

  it('hides the "+ applicant" opener without applications.create, shows it with it (OPENERS-HIDE-1)', async () => {
    vi.resetModules()
    // Targeted flag: only a WRONG permission is granted, proving the opener
    // reads applications.create specifically.
    vi.doMock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: (p: string) => p === 'applications.update' }) }))
    const { default: NoCreate } = await import('./ApplicantsTab')
    const { unmount } = render(<NoCreate vacancy={vacancy([])} />)
    expect(screen.queryByRole('button', { name: 'applicants.addApplication' })).toBeNull()
    unmount()

    vi.resetModules()
    vi.doMock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: (p: string) => p === 'applications.create' }) }))
    const { default: WithCreate } = await import('./ApplicantsTab')
    render(<WithCreate vacancy={vacancy([])} />)
    expect(screen.getByRole('button', { name: 'applicants.addApplication' })).toBeInTheDocument()
  })

  // PDF-VACATURES-13: the expanded application detail carries a DrillPager so the
  // recruiter can step to the next applicant without collapsing back to the list.
  it('shows a DrillPager in the expanded detail and next steps to the next application', async () => {
    vi.resetModules()
    vi.doMock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
    const { default: WithView } = await import('./ApplicantsTab')
    render(<WithView vacancy={vacancy([
      { id: 'a1', candidate_id: 'c1', candidate_name: 'Jan Jansen', phase: { value: 'applied' } },
      { id: 'a2', candidate_id: 'c2', candidate_name: 'Piet Pietersen', phase: { value: 'applied' } },
    ])} />)

    const [firstToggle] = screen.getAllByTitle('work.showDetails')
    await userEvent.click(firstToggle)
    expect(screen.getByLabelText('drillPager.next')).toBeInTheDocument()
    expect(screen.getByLabelText('drillPager.prev')).toBeDisabled()

    await userEvent.click(screen.getByLabelText('drillPager.next'))
    // Stepping "next" collapses row 1 (its own toggle is back to "show") and
    // opens row 2's panel instead — never both at once.
    expect(screen.getAllByTitle('work.showDetails').length).toBe(1)
    expect(screen.getByTitle('work.hideDetails')).toBeInTheDocument()
  })

  it('paginates at 5 rows per page (mirrors WorkTab)', async () => {
    const apps = Array.from({ length: 6 }, (_, i) => ({
      id: `a${i}`, candidate_id: `c${i}`, candidate_name: `Candidate ${i}`, phase: { value: 'applied' },
    }))
    render(<ApplicantsTab vacancy={vacancy(apps)} />)
    expect(screen.getByText('Candidate 0')).toBeInTheDocument()
    expect(screen.queryByText('Candidate 5')).toBeNull()
    // Pagination next/prev are now house Button iconOnly controls (accessible
    // name, not a bare '›' glyph — HUISSTIJL herhaal-audit r6).
    await userEvent.click(screen.getByRole('button', { name: 'common:nextPage' }))
    expect(screen.getByText('Candidate 5')).toBeInTheDocument()
    expect(screen.queryByText('Candidate 0')).toBeNull()
  })
})

// INTERVIEW-VISIBILITY-1 (Danny 29-09: "per vacature makkelijk zien welke
// sollicitanten nog geen agent hebben of vastzitten"): the two quick-view
// toggles above the list.
describe('ApplicantsTab · interview visibility toggles (INTERVIEW-VISIBILITY-1)', () => {
  it('shows the no-agent toggle with a count, filters to applicants without a session when the vacancy has no default workflow', async () => {
    render(<ApplicantsTab vacancy={vacancy([
      { id: 'a1', candidate_id: 'c1', candidate_name: 'Jan Jansen', phase: { value: 'applied' }, interview: null },
      { id: 'a2', candidate_id: 'c2', candidate_name: 'Piet Pietersen', phase: { value: 'applied' }, interview: { category: 'busy' } },
    ])} />)
    const toggle = screen.getByText('applicants.filterNoAgent')
    expect(screen.getByText('1')).toBeInTheDocument() // CountBadge
    await userEvent.click(toggle)
    expect(screen.getByText('Jan Jansen')).toBeInTheDocument()
    expect(screen.queryByText('Piet Pietersen')).toBeNull()
  })

  it('never counts a session-less applicant as "no agent" once the vacancy itself carries a default workflow', () => {
    const v = mapVacancyDetail({
      id: 'v1', title: 'Verpleegkundige', applicationsByPhase: {},
      applications: [{ id: 'a1', candidate_id: 'c1', candidate_name: 'Jan Jansen', phase: { value: 'applied' }, interview: null }],
      interview_workflow_id: 'wf-1',
    })
    render(<ApplicantsTab vacancy={v} />)
    // The toggle still renders (feature is available), but its count is zero —
    // a tellerbadge never renders "0" (CLAUDE.md §16 canon).
    expect(screen.getByText('applicants.filterNoAgent')).toBeInTheDocument()
    expect(screen.queryByText('1')).toBeNull()
  })

  it('hides the stalled toggle entirely when no row carries a waiting-duration field (feature detection)', () => {
    render(<ApplicantsTab vacancy={vacancy([
      { id: 'a1', candidate_id: 'c1', candidate_name: 'Jan Jansen', phase: { value: 'applied' }, interview: null },
    ])} />)
    expect(screen.queryByText('applicants.filterStalled')).toBeNull()
  })

  it('hides the no-agent toggle entirely when the backend does not send the `interview` key on any row (feature detection)', () => {
    render(<ApplicantsTab vacancy={vacancy([
      { id: 'a1', candidate_id: 'c1', candidate_name: 'Jan Jansen', phase: { value: 'applied' } },
    ])} />)
    expect(screen.queryByText('applicants.filterNoAgent')).toBeNull()
  })

  it('shows the stalled toggle once a row carries waiting_since, and filters to it', async () => {
    const staleIso = new Date(Date.now() - 30 * 3600000).toISOString() // 30h ago > default 24h window
    render(<ApplicantsTab vacancy={vacancy([
      { id: 'a1', candidate_id: 'c1', candidate_name: 'Jan Jansen', phase: { value: 'applied' }, interview: { category: 'busy', turn: 'candidate', waiting_since: staleIso } },
      { id: 'a2', candidate_id: 'c2', candidate_name: 'Piet Pietersen', phase: { value: 'applied' }, interview: { category: 'busy', turn: 'agent', waiting_since: null } },
    ])} />)
    const toggle = screen.getByText('applicants.filterStalled')
    await userEvent.click(toggle)
    expect(screen.getByText('Jan Jansen')).toBeInTheDocument()
    expect(screen.queryByText('Piet Pietersen')).toBeNull()
  })

  it('reads the stalled window from the tenant setting, not the hardcoded default', async () => {
    // A tenant-configured 48h window: 30h-waiting is NOT stalled (default 24h
    // would have flagged it — proves the setting, not the fallback, is read).
    vi.resetModules()
    vi.doMock('@/lib/settings/useAllSettings', () => ({
      useAllSettings: () => ({ koios_suggest_interview_stalled_hours: 48 }),
      getNumberSetting: (v: Record<string, unknown> | null | undefined, k: string, fallback: number) => {
        const raw = v?.[k]
        return typeof raw === 'number' ? raw : fallback
      },
    }))
    const { default: WindowedTab } = await import('./ApplicantsTab')
    const staleIso30h = new Date(Date.now() - 30 * 3600000).toISOString()
    const staleIso50h = new Date(Date.now() - 50 * 3600000).toISOString()
    render(<WindowedTab vacancy={vacancy([
      { id: 'a1', candidate_id: 'c1', candidate_name: 'Jan Jansen', phase: { value: 'applied' }, interview: { category: 'busy', turn: 'candidate', waiting_since: staleIso30h } },
      { id: 'a2', candidate_id: 'c2', candidate_name: 'Piet Pietersen', phase: { value: 'applied' }, interview: { category: 'busy', turn: 'candidate', waiting_since: staleIso50h } },
    ])} />)
    const toggle = screen.getByText('applicants.filterStalled')
    await userEvent.click(toggle)
    expect(screen.queryByText('Jan Jansen')).toBeNull()
    expect(screen.getByText('Piet Pietersen')).toBeInTheDocument()
  })
})
