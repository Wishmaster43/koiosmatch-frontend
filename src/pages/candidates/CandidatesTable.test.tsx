import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CandidatesTable from './CandidatesTable'
import type { Candidate, CandidateBackofficeLink } from '@/types/candidate'

// Controlled lookup metas — flags drive the deep-link, never the label/slug
// (mirrors the sibling agents' contract). funnelTypes stays empty (sort order only).
const funnelMeta = vi.fn((v?: string) => (
  v === 'hired' ? { label: 'Aangenomen', color: '#000', is_match: true } : { label: 'Gesolliciteerd', color: '#000', is_match: false }
))
const statusMeta = vi.fn((v?: string) => (
  v === 'sick' ? { label: 'Ziek', color: '#000', requires_reason: true }
    // icon rides along since the BE icon column (13-08) — the row must render it.
    : v === 'placed' ? { label: 'Geplaatst', color: '#000', requires_match: true, icon: 'briefcase' }
    : { label: 'Beschikbaar', color: '#000' }
))
vi.mock('@/context/LookupsContext', () => ({
  useLookups: () => ({
    funnelTypes: [],
    funnelMeta,
    statusMeta,
    phaseMeta: (v?: string) => ({ label: v ?? '', color: '#000' }),
    typeMeta: (v?: string) => ({ label: v ?? '', color: '#000' }),
  }),
}))
vi.mock('@/lib/useGenders', () => ({ useGenders: () => ({ colorOf: () => null }) }))
vi.mock('@/lib/useLastContactTypes', () => ({ useLastContactTypes: () => ({ labelOf: (v: string) => v, iconOf: () => null }) }))
vi.mock('@/lib/settings/useAllSettings', () => ({
  useAllSettings: () => ({}),
  // Colour flags on so chip branches render (matches the coloured production default for status/phase).
  getBoolSetting: (_s: unknown, _key: string, fallback: boolean) => fallback,
}))
// Shared advice resolver (contract D) — stubbed stable so the koios column renders without a real hook.
vi.mock('@/lib/useCandidateAdvice', () => ({ useCandidateAdvice: () => () => null }))
// Tenant app gate (JOB2 coupling column) — controlled per test, defaults to "off"
// so the pre-existing tests above (which never touch it) see the same dash they
// always did.
const mockUseApps = vi.fn()
vi.mock('@/context/AppsContext', () => ({ useApps: () => mockUseApps() }))
beforeEach(() => { mockUseApps.mockReturnValue({ isAppEnabled: () => false }) })

const link = (overrides: Partial<CandidateBackofficeLink> = {}): CandidateBackofficeLink => ({
  status: null, externalId: null, lastError: null, lastSyncedAt: null, linkedAt: null, linkedBy: null, ...overrides,
})

const baseCandidate: Candidate = {
  id: 1, name: 'Jane Doe', initials: 'JD', title: 'Nurse', city: 'Utrecht',
  phase: null, status: null, created: '2026-01-01', lastContactAt: null, lastContactType: null,
  lastContactBy: null, stage: '', stageLabel: null, stageColor: null,
  candidateTypes: [], pools: [], koiosAdvice: null, owner: 'Owner', ownerInitials: '?', ownerColor: null,
  gender: null, lifecycle: 'active',
} as unknown as Candidate

describe('CandidatesTable cell deep-links', () => {
  it('clicking the talent pool chip opens work:pools and does not select the row', async () => {
    const onOpenTab = vi.fn()
    const onSelect = vi.fn()
    const row = { ...baseCandidate, pools: [{ id: 'p1', name: 'Pool A', color: '#111' }] }
    render(<CandidatesTable rows={[row]} onOpenTab={onOpenTab} onSelect={onSelect} />)
    await userEvent.click(screen.getByRole('button', { name: /talentenpools/i }))
    expect(onOpenTab).toHaveBeenCalledWith(row, 'work:pools')
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('a stage carrying is_match sends work:matches, a plain stage sends work:applications', async () => {
    const onOpenTab = vi.fn()
    const hired = { ...baseCandidate, id: 2, stage: 'hired' }
    const applied = { ...baseCandidate, id: 3, stage: 'applied' }
    render(<CandidatesTable rows={[hired, applied]} onOpenTab={onOpenTab} />)
    await userEvent.click(screen.getByRole('button', { name: /matches/i }))
    expect(onOpenTab).toHaveBeenCalledWith(hired, 'work:matches')
    await userEvent.click(screen.getByRole('button', { name: /sollicitaties/i }))
    expect(onOpenTab).toHaveBeenCalledWith(applied, 'work:applications')
  })

  it('a status carrying requires_reason sends preferences', async () => {
    const onOpenTab = vi.fn()
    const row = { ...baseCandidate, id: 4, status: 'sick' }
    render(<CandidatesTable rows={[row]} onOpenTab={onOpenTab} />)
    await userEvent.click(screen.getByRole('button', { name: /voorkeuren/i }))
    expect(onOpenTab).toHaveBeenCalledWith(row, 'preferences')
  })

  it('a status with no flags renders no deep-link button', () => {
    const row = { ...baseCandidate, id: 5, status: 'available' }
    render(<CandidatesTable rows={[row]} />)
    expect(screen.queryByRole('button', { name: /matches/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /voorkeuren/i })).toBeNull()
  })
})

// JOB1: the reference number (K-00123) is now a real, sortable table column —
// before this change grepping every pages/*Table.tsx for `referenceNumber`
// returned nothing at all, so a passing test here MUST fail on a revert.
describe('CandidatesTable · reference number column (JOB1)', () => {
  it('renders the real referenceNumber value, and a plain dash when absent — never a blank cell', () => {
    const withRef = { ...baseCandidate, id: 20, referenceNumber: 'K-00123' }
    const withoutRef = { ...baseCandidate, id: 21, referenceNumber: '' }
    const { container } = render(<CandidatesTable rows={[withRef, withoutRef]} />)
    expect(screen.getByText('K-00123')).toBeInTheDocument()

    const headerCell = screen.getByText('Referentienr.').closest('th') as HTMLElement
    const colIndex = Array.from(headerCell.parentElement?.children ?? []).indexOf(headerCell)
    const rows = container.querySelectorAll('tbody tr')
    const values = Array.from(rows).map(r => r.children[colIndex].textContent)
    // Order isn't asserted here (both rows share the same `created`); only that
    // the row WITH a number shows it and the row WITHOUT one shows a real dash.
    expect(values).toContain('K-00123')
    expect(values).toContain('—')
  })

  it('sorts by reference number when the column header is clicked', async () => {
    const user = userEvent.setup()
    const rowA = { ...baseCandidate, id: 30, referenceNumber: 'K-00003' }
    const rowB = { ...baseCandidate, id: 31, referenceNumber: 'K-00001' }
    const rowC = { ...baseCandidate, id: 32, referenceNumber: 'K-00002' }
    const { container } = render(<CandidatesTable rows={[rowA, rowB, rowC]} />)

    const headerCell = screen.getByText('Referentienr.').closest('th') as HTMLElement
    const colIndex = Array.from(headerCell.parentElement?.children ?? []).indexOf(headerCell)
    // First click sorts ascending (mirrors the established convention, e.g. the
    // Leads column in VacanciesTable.test.tsx).
    await user.click(within(headerCell).getByRole('button'))

    const rows = container.querySelectorAll('tbody tr')
    const values = Array.from(rows).map(r => r.children[colIndex].textContent)
    expect(values).toEqual(['K-00001', 'K-00002', 'K-00003'])
  })
})

// JOB2: the compact per-row backoffice coupling indicator — before this change
// HelloFlexMark was imported by nothing at all (grepped repo-wide) and there was
// no signal anywhere in a list; a passing test here MUST fail on a revert.
describe('CandidatesTable · backoffice coupling indicator (JOB2)', () => {
  it('distinguishes LINKED, FAILED and NOT LINKED with a real accessible name each', () => {
    mockUseApps.mockReturnValue({ isAppEnabled: () => true })
    const linked = { ...baseCandidate, id: 40, helloflexLink: link({ status: 'linked' }), shiftmanagerLink: null }
    const failed = { ...baseCandidate, id: 41, helloflexLink: link({ status: 'failed' }), shiftmanagerLink: null }
    const notLinked = { ...baseCandidate, id: 42, helloflexLink: null, shiftmanagerLink: null }
    render(<CandidatesTable rows={[linked, failed, notLinked]} />)

    // Three real, distinct accessible names — never colour alone (§6) — one per state.
    expect(screen.getByRole('img', { name: 'HelloFlex: Gekoppeld' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'HelloFlex: Mislukt' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Niet gekoppeld aan HelloFlex' })).toBeInTheDocument()
  })

  it('hides a system entirely when the tenant never enabled its app — never a fake "not linked"', () => {
    const row = { ...baseCandidate, id: 43, helloflexLink: link({ status: 'linked' }), shiftmanagerLink: link({ status: 'failed' }) }
    mockUseApps.mockReturnValue({ isAppEnabled: () => true })
    const { rerender } = render(<CandidatesTable rows={[row]} />)
    // First prove the marks CAN render at all (guards against the assertions
    // below passing vacuously just because the column doesn't exist).
    expect(screen.getByRole('img', { name: /HelloFlex/ })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Shiftmanager/ })).toBeInTheDocument()

    mockUseApps.mockReturnValue({ isAppEnabled: () => false })
    rerender(<CandidatesTable rows={[row]} />)
    expect(screen.queryByRole('img', { name: /HelloFlex/ })).toBeNull()
    expect(screen.queryByRole('img', { name: /Shiftmanager/ })).toBeNull()
  })

  // KOPPELING-COLUMN-1: the coupling cell is a real ghost button now, matching
  // every other deep-link cell in this table — clicking it opens the drawer on
  // the RIGHT candidate's Koppelingen tab, and never also selects the row.
  it('clicking the coupling cell opens the integrations tab for that candidate, not row-select', async () => {
    mockUseApps.mockReturnValue({ isAppEnabled: () => true })
    const onOpenTab = vi.fn()
    const onSelect = vi.fn()
    const other = { ...baseCandidate, id: 44, helloflexLink: link({ status: 'linked' }), shiftmanagerLink: null }
    const row = { ...baseCandidate, id: 45, helloflexLink: link({ status: 'failed' }), shiftmanagerLink: null }
    render(<CandidatesTable rows={[other, row]} onOpenTab={onOpenTab} onSelect={onSelect} />)
    const buttons = screen.getAllByRole('button', { name: /koppelingen/i })
    expect(buttons).toHaveLength(2)
    await userEvent.click(buttons[0])
    expect(onOpenTab).toHaveBeenCalledWith(row, 'integrations')
    expect(onSelect).not.toHaveBeenCalled()
  })
})

// Danny 05-08: the "Koios" column now rolls out to every entity table via the
// shared makeKoiosColumn factory — this is the smoke test proving the header
// still renders here (useCandidateAdvice is stubbed to null above, so the rule
// itself stays covered by candidateAdvice.test.ts/useCandidateAdvice.test.ts).
describe('CandidatesTable · Koios column (Danny 05-08)', () => {
  it('renders the header with the Koios mark + label', () => {
    render(<CandidatesTable rows={[baseCandidate]} />)
    expect(screen.getByRole('img', { name: 'Koios AI' })).toBeInTheDocument()
    expect(screen.getByText('Koios')).toBeInTheDocument()
  })
})

// LOOKUP-ICON-1 control-round regression: the status icon must actually REACH the
// row — the earlier mock bypassed normalize() and hid that the icon was dropped.
it('renders the status lookup icon in the row when the lookup carries one', () => {
  const row = { ...baseCandidate, id: 99, status: 'placed' }
  const { container } = render(<CandidatesTable rows={[row]} onOpenTab={vi.fn()} />)
  // LookupIcon renders a lucide svg for the curated 'briefcase' key.
  expect(container.querySelector('svg.lucide-briefcase, svg[class*="briefcase"]')).toBeTruthy()
})

// V-appdetail-1/2: the missing_appointment flag (mapCandidate.ts) surfaces as an
// accessible-label attention icon next to the name, only when set.
describe('CandidatesTable · missing-appointment attention icon (V-appdetail-1/2)', () => {
  it('shows the icon when the flag is set', () => {
    const row = { ...baseCandidate, id: 2, missingAppointment: true } as Candidate
    render(<CandidatesTable rows={[row]} />)
    expect(screen.getByRole('img', { name: 'Afspraak ontbreekt' })).toBeInTheDocument()
  })

  it('renders no icon at all when the flag is absent', () => {
    const row = { ...baseCandidate, id: 3, missingAppointment: false } as Candidate
    render(<CandidatesTable rows={[row]} />)
    expect(screen.queryByRole('img', { name: 'Afspraak ontbreekt' })).toBeNull()
  })
})
