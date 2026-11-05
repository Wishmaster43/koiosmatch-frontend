/** WorkTab · Sollicitaties toolbar, stage filter, column geometry and pager (split from WorkTab.test.tsx; raw-key i18n, no real init). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WorkTab from './WorkTab'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { useAuth } from '@/context/AuthContext'
import type { Candidate } from '@/types/candidate'

// Hoisted so the navigation spy is the SAME function across renders (punt 5
// asserts WHICH entity the row title opens in-app).
const { openEntity } = vi.hoisted(() => ({ openEntity: vi.fn() }))

// The candidate's appointments fetch (a sibling structured entity) is irrelevant
// to the vacancy-title/created-date row this test covers. `delete` is real here:
// punt 7's detach (WorkTab.test.tsx) asserts the exact method/route/body.
vi.mock('@/lib/api', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: { data: [] } })),
    delete: vi.fn(() => Promise.resolve({ status: 204 })),
  },
  unwrap: (r: unknown) => r,
  unwrapList: (r: { data?: { data?: unknown[] } }) => ({ rows: r?.data?.data ?? [] }),
}))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))
vi.mock('@/context/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => `fmt(${v})`, locale: 'nl-NL' }), useLocale: () => 'nl-NL' }))
vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity, navigate: vi.fn() }) }))
// The application form is a different file's scope (vacancy/stage/user lookups) —
// stand in with a marker exposing `editApplicationId`, so punt 5's pencil wiring is
// observable without mounting the real form (it has its own test file).
vi.mock('./AddApplicationModal', () => ({
  default: ({ editApplicationId }: { editApplicationId?: string | number | null }) => (
    <div data-testid="application-modal" data-edit-application-id={editApplicationId ?? ''} />
  ),
}))
vi.mock('@/lib/useMatchStatuses', () => ({ useMatchStatuses: () => ({ statuses: [], metaOf: () => undefined }) }))
// sectionBlock (styling) + the NAV-BACK-1 helpers MatchesTab imports from the same module.
vi.mock('./constants', () => ({ sectionBlock: {}, rememberReturnTab: vi.fn(), peekReturnTab: () => null, clearReturnTab: () => {} }))
// The shared appointment modal is a different file's scope (its own lookups/auth/
// vacancy-options hooks) — stand in with a marker exposing the props INTAKE-
// VACANCY-ID-1 cares about, so the wiring is observable without those hooks.
vi.mock('./PlanIntakeModal', () => ({
  default: ({ defaultVacancyId, suggestedVacancyId, existing }: { defaultVacancyId?: string | number | null; suggestedVacancyId?: string | number | null; existing?: { vacancy_id?: string | number | null } }) => (
    <div data-testid="plan-intake-modal" data-default-vacancy-id={defaultVacancyId ?? ''} data-suggested-vacancy-id={suggestedVacancyId ?? ''} data-existing-vacancy-id={existing?.vacancy_id ?? ''} />
  ),
}))
// MatchModal is a different file's scope (customer/vacancy/rate hooks) —
// stand in with a marker exposing `editMatchId` + a trigger button for `onCreated`
// (§13: this is how point 1's refresh-callback wiring and point 2's pencil wiring
// (WorkTab.subtabs.test.tsx) get exercised without mounting the real form).
vi.mock('./MatchModal', () => ({
  default: ({ editMatchId, onCreated }: { editMatchId?: string | number | null; onCreated: () => void }) => (
    <div data-testid="match-modal" data-edit-match-id={editMatchId ?? ''}>
      <button onClick={onCreated}>trigger-match-created</button>
    </div>
  ),
}))

const candidate = (applications: unknown[], matches: unknown[] = []): Candidate => ({ id: 9, matches, applications } as unknown as Candidate)

// Default: a recruiter WITH applications.create + applications.update + matches.update
// (add + pencil + unlink + "+ Match" all visible). Individual tests override it where they test a narrower grant.
beforeEach(() => {
  vi.mocked(api.delete).mockClear()
  vi.mocked(api.get).mockClear()
  openEntity.mockClear()
  vi.mocked(notifyError).mockClear()
  vi.mocked(useAuth).mockReturnValue({ hasPermission: (p: string) => ['applications.create', 'applications.update', 'matches.update'].includes(p) } as unknown as ReturnType<typeof useAuth>)
})

// Danny live review, 04-08: "Zoeken en status erbij!" — the Sollicitaties list
// gets the same search + stage-filter toolbar idiom as the customer drill-down,
// on the SAME line as the two existing action buttons; plus column headers for
// the stage pill / applied-on date the header row was missing.
describe('WorkTab · Sollicitaties toolbar (search + stage filter, Danny live review 04-08)', () => {
  const twoApps = [
    { id: 'a1', vacancy: { id: 'v1', title: 'Verpleegkundige' }, stageLabel: 'Gesolliciteerd', created_at: '2026-07-01' },
    { id: 'a2', vacancy: { id: 'v2', title: 'Verzorgende' }, stageLabel: 'Ingepland', created_at: '2026-07-02' },
  ]

  it('renders search, stage filter and the two actions on ONE line, in that DOM order', () => {
    render(<WorkTab c={candidate(twoApps)} />)
    const search = screen.getByPlaceholderText('work.searchPlaceholder')
    // StatusFilterSelect shows the pill+count convention since HUISSTIJL-1 batch G:
    // the trigger always reads the static "Status" word, never the picked value.
    const stageFilter = screen.getByRole('button', { name: 'filters.status' })
    const applyButton = screen.getByRole('button', { name: 'work.addApplication' })
    const intakeButton = screen.getByRole('button', { name: 'work.planIntake' })
    expect(search.compareDocumentPosition(stageFilter) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(stageFilter.compareDocumentPosition(applyButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(applyButton.compareDocumentPosition(intakeButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('search narrows the visible applications on the vacancy label', async () => {
    const user = userEvent.setup()
    render(<WorkTab c={candidate(twoApps)} />)
    expect(screen.getByRole('button', { name: 'Verpleegkundige' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Verzorgende' })).toBeInTheDocument()
    await user.type(screen.getByPlaceholderText('work.searchPlaceholder'), 'verzorg')
    expect(screen.queryByRole('button', { name: 'Verpleegkundige' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Verzorgende' })).toBeInTheDocument()
  })

  it('the stage filter (derived from the loaded rows) narrows to the picked stage only', async () => {
    const user = userEvent.setup()
    render(<WorkTab c={candidate(twoApps)} />)
    // StatusFilterSelect shows the pill+count convention since HUISSTIJL-1 batch G:
    // the trigger always reads the static "Status" word, never the picked value.
    await user.click(screen.getByRole('button', { name: 'filters.status' }))
    await user.click(await screen.findByRole('button', { name: 'Ingepland' }))
    expect(screen.getByRole('button', { name: 'Verzorgende' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Verpleegkundige' })).toBeNull()
  })

  it('renders column headers for Vacature, Status and Datum (Danny live review: "geen kopje?")', () => {
    render(<WorkTab c={candidate(twoApps)} />)
    expect(screen.getByText('work.vacancy')).toBeInTheDocument()
    expect(screen.getByText('work.colStatus')).toBeInTheDocument()
    expect(screen.getByText('work.colDate')).toBeInTheDocument()
  })
})

/**
 * S-cand-1: the stage filter now groups/filters on `stageKey` when the backend
 * embed carries it, so a tenant renaming a stage's LABEL never silently splits
 * one stage into two filter buckets — falls back to stageLabel while any row
 * still predates the embed (rollout-safe).
 */
describe('WorkTab · S-cand-1 stage filter uses stageKey (label fallback)', () => {
  it('two rows sharing one stageKey but different (renamed) labels stay ONE filter bucket', async () => {
    const rows = [
      { id: 'a1', vacancy: { id: 'v1', title: 'Verpleegkundige' }, stageKey: 'applied', stageLabel: 'Gesolliciteerd', created_at: '2026-07-01' },
      { id: 'a2', vacancy: { id: 'v2', title: 'Verzorgende' }, stageKey: 'applied', stageLabel: 'Sollicitatie ontvangen', created_at: '2026-07-02' },
    ]
    const user = userEvent.setup()
    render(<WorkTab c={candidate(rows)} />)
    // StatusFilterSelect shows the pill+count convention since HUISSTIJL-1 batch G:
    // the trigger always reads the static "Status" word, never the picked value.
    await user.click(screen.getByRole('button', { name: 'filters.status' }))
    // Only ONE stage option in the menu — not two, despite the differing labels.
    expect(screen.getAllByRole('button', { name: /Gesolliciteerd|Sollicitatie ontvangen/ })).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: /Gesolliciteerd|Sollicitatie ontvangen/ }))
    // Picking that one bucket keeps BOTH rows.
    expect(screen.getByRole('button', { name: 'Verpleegkundige' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Verzorgende' })).toBeInTheDocument()
  })

  it('still filters correctly by label when stageKey is absent (pre-rollout rows)', async () => {
    const rows = [
      { id: 'a1', vacancy: { id: 'v1', title: 'Verpleegkundige' }, stageLabel: 'Gesolliciteerd', created_at: '2026-07-01' },
      { id: 'a2', vacancy: { id: 'v2', title: 'Verzorgende' }, stageLabel: 'Ingepland', created_at: '2026-07-02' },
    ]
    const user = userEvent.setup()
    render(<WorkTab c={candidate(rows)} />)
    // StatusFilterSelect shows the pill+count convention since HUISSTIJL-1 batch G:
    // the trigger always reads the static "Status" word, never the picked value.
    await user.click(screen.getByRole('button', { name: 'filters.status' }))
    await user.click(await screen.findByRole('button', { name: 'Ingepland' }))
    expect(screen.getByRole('button', { name: 'Verzorgende' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Verpleegkundige' })).toBeNull()
  })
})

/**
 * Danny 09-08: "de koppen staan niet boven hun eigen kolom" — the header used
 * to declare its own fixed widths while ApplicationRow built its cells
 * completely differently (a pill with its own intrinsic width, a date with
 * only `flexShrink: 0`), and the header had no column at all for the trailing
 * pencil/unlink/external-link/chevron cluster. Both sides now read their
 * widths from the SAME shared module (applicationRowColumns.ts) — these tests
 * compare the ACTUAL rendered header cell to the ACTUAL rendered row cell
 * (not just to the imported constant), so a future hardcoded, divergent
 * number on either side breaks this instead of silently drifting apart again.
 */
describe('WorkTab · Sollicitaties header/row share ONE column geometry (Danny 09-08)', () => {
  const oneApp = [{ id: 'a1', vacancy: { id: 'v1', title: 'Verpleegkundige' }, stageLabel: 'Gesolliciteerd', created_at: '2026-07-01' }]

  it('renders an (empty) header cell above the actions column (Danny: "lege kop boven de actiekolom")', () => {
    render(<WorkTab c={candidate(oneApp)} />)
    expect(screen.getByTestId('app-col-actions-header')).toBeInTheDocument()
  })

  it('status/date/actions column widths are IDENTICAL between the header and the row', () => {
    render(<WorkTab c={candidate(oneApp)} />)
    const statusHeader = screen.getByText('work.colStatus')
    const dateHeader = screen.getByText('work.colDate')
    const actionsHeader = screen.getByTestId('app-col-actions-header')
    // The stage pill's own wrapping cell (StatusPill's text is the pill's OWN
    // direct text child, so its immediate parent is ApplicationRow's column span).
    const statusCell = screen.getByText('Gesolliciteerd').parentElement as HTMLElement
    const dateCell = screen.getByText('fmt(2026-07-01)')
    const actionsCell = screen.getByTestId('app-col-actions')
    expect(statusCell.style.width).toBe(statusHeader.style.width)
    expect(dateCell.style.width).toBe(dateHeader.style.width)
    expect(actionsCell.style.width).toBe(actionsHeader.style.width)
  })
})

/**
 * HUISSTIJL-1 — the applications pager renders via the shared Button atom
 * (iconOnly, sm) instead of hand-painted 24px buttons, so it shares the exact
 * same face and disabled treatment as every other prev/next pager in the app
 * (mirrors ApplicantsTab.tsx's identical idiom).
 */
describe('WorkTab · applications pager uses the shared Button atom', () => {
  const manyApps = Array.from({ length: 6 }, (_, i) => ({
    id: `a${i}`, vacancy: { id: `v${i}`, title: `Vacature ${i}` }, created_at: '2026-07-01',
  }))

  it('renders prev disabled and next enabled on the first page', () => {
    render(<WorkTab c={candidate(manyApps)} />)
    const prev = screen.getByRole('button', { name: 'common:prevPage' })
    const next = screen.getByRole('button', { name: 'common:nextPage' })
    expect(prev).toBeDisabled()
    expect(next).not.toBeDisabled()
  })

  it('advances to the next page and disables next once the last page is reached', async () => {
    const user = userEvent.setup()
    render(<WorkTab c={candidate(manyApps)} />)
    const next = screen.getByRole('button', { name: 'common:nextPage' })
    await user.click(next)
    expect(screen.getByRole('button', { name: 'common:prevPage' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: 'common:nextPage' })).toBeDisabled()
  })
})
