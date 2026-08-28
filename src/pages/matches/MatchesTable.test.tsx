/**
 * MatchesTable — reference number column (JOB1) + backoffice coupling
 * indicator (JOB2). Mirrors CandidatesTable.test.tsx's conventions: real (nl)
 * i18n via the transitive '@/lib/datetime' import, mocked useMatchStatuses/
 * useAllSettings/AppsContext.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MatchesTable from './MatchesTable'
import type { MatchRow } from '@/types/match'
import type { BackofficeLink } from '@/lib/backofficeLink'

vi.mock('@/lib/useMatchStatuses', () => ({ useMatchStatuses: () => ({ metaOf: () => undefined }) }))
vi.mock('@/lib/settings/useAllSettings', () => ({
  useAllSettings: () => ({}),
  getBoolSetting: (_s: unknown, _key: string, fallback: boolean) => fallback,
  getNumberSetting: (_s: unknown, _key: string, fallback: number) => fallback,
}))
// Identity date formatter — this file doesn't cover date rendering itself.
vi.mock('@/lib/datetime', () => ({
  useDateFormat: () => ({ formatDate: (v: unknown) => (v == null ? '—' : String(v)), formatDateTime: (v: unknown) => String(v) }),
}))
// Tenant app gate (JOB2 coupling column) — controlled per test, defaults to "off".
const mockUseApps = vi.fn()
vi.mock('@/context/AppsContext', () => ({ useApps: () => mockUseApps() }))
beforeEach(() => { mockUseApps.mockReturnValue({ isAppEnabled: () => false }) })
// TYPE-KOLOM-ROUTE: spy on the deep-link navigation the Type column's "Via
// sollicitatie" chip triggers.
const mockOpenEntity = vi.fn()
vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity: mockOpenEntity }) }))
beforeEach(() => { mockOpenEntity.mockClear() })
// Real (nl) translations, since mocking '@/lib/datetime' above removes the
// transitive '@/i18n' side-effect import the production component relies on.
import '@/i18n'

const link = (overrides: Partial<BackofficeLink> = {}): BackofficeLink => ({
  status: null, externalId: null, lastError: null, lastSyncedAt: null, linkedAt: null, linkedBy: null, ...overrides,
})

const baseRow: MatchRow = {
  id: 1, candidate: 'Jane Doe', initials: 'JD', vacancy: 'Verpleegkundige', client: 'Zorgpartners',
  candidateId: null, vacancyId: null, clientId: null, score: 80, stage: 'open', status: 'open', stageColor: '#000',
  owner: 'Owner', ownerId: null, ownerInitials: '?', ownerColor: null, date: '2026-01-01',
  helloflexLink: null, shiftmanagerLink: null,
} as unknown as MatchRow

describe('MatchesTable · reference number column (JOB1)', () => {
  it('renders the real referenceNumber value, and a plain dash when absent — never a blank cell', () => {
    const withRef = { ...baseRow, id: 20, referenceNumber: 'M-00042' }
    const withoutRef = { ...baseRow, id: 21, referenceNumber: '' }
    const { container } = render(<MatchesTable rows={[withRef, withoutRef]} />)

    const headerCell = screen.getByText('Referentienr.').closest('th') as HTMLElement
    const colIndex = Array.from(headerCell.parentElement?.children ?? []).indexOf(headerCell)
    const rows = container.querySelectorAll('tbody tr')
    const values = Array.from(rows).map(r => r.children[colIndex].textContent)
    expect(values).toContain('M-00042')
    expect(values).toContain('—')
  })

  it('sorts by reference number when the column header is clicked', async () => {
    const user = userEvent.setup()
    const rowA = { ...baseRow, id: 30, referenceNumber: 'M-00003' }
    const rowB = { ...baseRow, id: 31, referenceNumber: 'M-00001' }
    const rowC = { ...baseRow, id: 32, referenceNumber: 'M-00002' }
    const { container } = render(<MatchesTable rows={[rowA, rowB, rowC]} />)

    const headerCell = screen.getByText('Referentienr.').closest('th') as HTMLElement
    const colIndex = Array.from(headerCell.parentElement?.children ?? []).indexOf(headerCell)
    await user.click(within(headerCell).getByRole('button'))

    const rows = container.querySelectorAll('tbody tr')
    const values = Array.from(rows).map(r => r.children[colIndex].textContent)
    expect(values).toEqual(['M-00001', 'M-00002', 'M-00003'])
  })
})

// SWEEP-TABLES: the vacancy column had no render fn, so an empty title printed
// a blank cell — the only column left inconsistent with the house em-dash
// convention every other empty cell already follows.
describe('MatchesTable · vacancy column em-dash (SWEEP-TABLES)', () => {
  it('renders the real vacancy value, and a plain dash when empty — never a blank cell', () => {
    const withVacancy = { ...baseRow, id: 22, vacancy: 'Verpleegkundige' }
    const withoutVacancy = { ...baseRow, id: 23, vacancy: '' }
    const { container } = render(<MatchesTable rows={[withVacancy, withoutVacancy]} />)

    const headerCell = screen.getByText('Vacature').closest('th') as HTMLElement
    const colIndex = Array.from(headerCell.parentElement?.children ?? []).indexOf(headerCell)
    const rows = container.querySelectorAll('tbody tr')
    const values = Array.from(rows).map(r => r.children[colIndex].textContent)
    expect(values).toContain('Verpleegkundige')
    expect(values).toContain('—')
    expect(values).not.toContain('')
  })
})

describe('MatchesTable · backoffice coupling indicator (JOB2)', () => {
  it('distinguishes LINKED, FAILED and NOT LINKED with a real accessible name each', () => {
    mockUseApps.mockReturnValue({ isAppEnabled: () => true })
    const linked = { ...baseRow, id: 40, helloflexLink: link({ status: 'linked' }), shiftmanagerLink: null }
    const failed = { ...baseRow, id: 41, helloflexLink: link({ status: 'failed' }), shiftmanagerLink: null }
    const notLinked = { ...baseRow, id: 42, helloflexLink: null, shiftmanagerLink: null }
    render(<MatchesTable rows={[linked, failed, notLinked]} />)

    expect(screen.getByRole('img', { name: 'HelloFlex: Gekoppeld' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'HelloFlex: Mislukt' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Niet gekoppeld aan HelloFlex' })).toBeInTheDocument()
  })

  it('hides a system entirely when the tenant never enabled its app — never a fake "not linked"', () => {
    const row = { ...baseRow, id: 43, helloflexLink: link({ status: 'linked' }), shiftmanagerLink: link({ status: 'failed' }) }
    mockUseApps.mockReturnValue({ isAppEnabled: () => true })
    const { rerender } = render(<MatchesTable rows={[row]} />)
    expect(screen.getByRole('img', { name: /HelloFlex/ })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Shiftmanager/ })).toBeInTheDocument()

    mockUseApps.mockReturnValue({ isAppEnabled: () => false })
    rerender(<MatchesTable rows={[row]} />)
    expect(screen.queryByRole('img', { name: /HelloFlex/ })).toBeNull()
    expect(screen.queryByRole('img', { name: /Shiftmanager/ })).toBeNull()
  })
})

// MATCH-ORIGIN-1: the ONTSTAANSTYPE column — a neutral soft chip when origin is
// known, and the house em-dash (never a guessed "Direct") when the backend
// payload doesn't carry the application_id key yet (OFFERED-IFF-READ).
describe('MatchesTable · type column (MATCH-ORIGIN-1)', () => {
  it('renders "Via sollicitatie" / "Direct" chips and a dash for an unknown origin', () => {
    const viaApplication = { ...baseRow, id: 70, origin: 'application' as const }
    const direct = { ...baseRow, id: 71, origin: 'direct' as const }
    const unknown = { ...baseRow, id: 72 }
    render(<MatchesTable rows={[viaApplication, direct, unknown]} />)

    expect(screen.getByText('Via sollicitatie')).toBeInTheDocument()
    expect(screen.getByText('Direct')).toBeInTheDocument()
    const headerCell = screen.getByText('Type').closest('th') as HTMLElement
    const colIndex = Array.from(headerCell.parentElement?.children ?? []).indexOf(headerCell)
    const rows = document.querySelectorAll('tbody tr')
    expect(rows[2].children[colIndex].textContent).toBe('—')
  })

  it('sorts by the resolved type label when the column header is clicked', async () => {
    const user = userEvent.setup()
    const direct = { ...baseRow, id: 80, origin: 'direct' as const }
    const viaApplication = { ...baseRow, id: 81, origin: 'application' as const }
    const { container } = render(<MatchesTable rows={[direct, viaApplication]} />)

    const headerCell = screen.getByText('Type').closest('th') as HTMLElement
    const colIndex = Array.from(headerCell.parentElement?.children ?? []).indexOf(headerCell)
    await user.click(within(headerCell).getByRole('button'))

    const rows = container.querySelectorAll('tbody tr')
    const values = Array.from(rows).map(r => r.children[colIndex].textContent)
    // "Direct" sorts before "Via sollicitatie" alphabetically.
    expect(values).toEqual(['Direct', 'Via sollicitatie'])
  })

  // Eindcontrole 22-08 (finding 6): the undefined-origin branch sorts as '' and
  // the shared DataTable pushes empty sort values LAST — pin that deliberately.
  it('sorts unknown-origin rows (dash) after the labelled ones', async () => {
    const user = userEvent.setup()
    const unknown = { ...baseRow, id: 82 }
    const direct = { ...baseRow, id: 83, origin: 'direct' as const }
    const { container } = render(<MatchesTable rows={[direct, unknown]} />)

    const headerCell = screen.getByText('Type').closest('th') as HTMLElement
    const colIndex = Array.from(headerCell.parentElement?.children ?? []).indexOf(headerCell)
    await user.click(within(headerCell).getByRole('button'))

    const rows = container.querySelectorAll('tbody tr')
    const values = Array.from(rows).map(r => r.children[colIndex].textContent)
    expect(values).toEqual(['Direct', '—'])
  })
})

// TYPE-KOLOM-ROUTE (Danny GO 23-08): "Via sollicitatie" deep-links to the
// source application's own drilldown; "Direct" has nothing to link to.
describe('MatchesTable · type column deep-link (TYPE-KOLOM-ROUTE)', () => {
  it('clicking the "Via sollicitatie" chip opens the application drilldown, not the match row', async () => {
    const user = userEvent.setup()
    const onRowClick = vi.fn()
    const viaApplication = { ...baseRow, id: 90, origin: 'application' as const, applicationId: 'app-1' }
    render(<MatchesTable rows={[viaApplication]} onRowClick={onRowClick} />)

    const chipButton = screen.getByText('Via sollicitatie').closest('button') as HTMLElement
    await user.click(chipButton)

    expect(mockOpenEntity).toHaveBeenCalledWith('applications', 'app-1')
    expect(onRowClick).not.toHaveBeenCalled()
  })

  it('renders "Direct" as a plain, unclickable chip', () => {
    const direct = { ...baseRow, id: 91, origin: 'direct' as const }
    render(<MatchesTable rows={[direct]} />)

    expect(screen.getByText('Direct')).toBeInTheDocument()
    expect(screen.getByText('Direct').closest('button')).toBeNull()
  })
})

// Danny 05-08: the "Koios" column now rolls out to every entity table — this is
// the smoke test proving the header renders here too (the honest per-row rule
// lives in matchAdvice.test.ts).
describe('MatchesTable · Koios column (Danny 05-08)', () => {
  it('renders the header with the Koios mark, and flags an open match whose end date already passed', () => {
    const approaching = { ...baseRow, id: 60, endDate: '2000-01-01' }
    const openEnded = { ...baseRow, id: 61, endDate: null }
    render(<MatchesTable rows={[approaching, openEnded]} />)

    expect(screen.getByRole('img', { name: 'Koios AI' })).toBeInTheDocument()
    expect(screen.getByText('Verlengen?')).toBeInTheDocument()
  })

  it('renders an honest dash for an open-ended match (no end date)', () => {
    const openEnded = { ...baseRow, id: 62, endDate: null }
    const { container } = render(<MatchesTable rows={[openEnded]} />)
    const headerCell = screen.getByRole('img', { name: 'Koios AI' }).closest('th') as HTMLElement
    const col = Array.from(headerCell.parentElement?.children ?? []).indexOf(headerCell)
    expect(container.querySelectorAll('tbody tr')[0].children[col].textContent).toBe('—')
  })
})

// CEL-DOORKLIK-CANON: candidate/vacancy/client cells deep-link to their own
// drilldown, and never let that click also open the row's own detail drawer.
describe('MatchesTable · cell deep-links (CEL-DOORKLIK-CANON)', () => {
  it('opens the candidate drilldown from the candidate cell, without triggering the row click', async () => {
    const user = userEvent.setup()
    const onRowClick = vi.fn()
    const row = { ...baseRow, id: 70, candidateId: 'cand-7' }
    render(<MatchesTable rows={[row]} onRowClick={onRowClick} />)

    await user.click(screen.getByRole('button', { name: /Kandidaat openen/ }))

    expect(mockOpenEntity).toHaveBeenCalledWith('candidates', 'cand-7')
    expect(onRowClick).not.toHaveBeenCalled()
  })

  it('opens the vacancy drilldown from the vacancy cell', async () => {
    const user = userEvent.setup()
    const onRowClick = vi.fn()
    const row = { ...baseRow, id: 71, vacancyId: 'vac-7' }
    render(<MatchesTable rows={[row]} onRowClick={onRowClick} />)

    await user.click(screen.getByRole('button', { name: /Vacature openen/ }))

    expect(mockOpenEntity).toHaveBeenCalledWith('vacancies', 'vac-7')
    expect(onRowClick).not.toHaveBeenCalled()
  })

  it('opens the customer drilldown from the client cell', async () => {
    const user = userEvent.setup()
    const onRowClick = vi.fn()
    const row = { ...baseRow, id: 72, clientId: 'cust-7' }
    render(<MatchesTable rows={[row]} onRowClick={onRowClick} />)

    await user.click(screen.getByRole('button', { name: /Klant openen/ }))

    expect(mockOpenEntity).toHaveBeenCalledWith('customers', 'cust-7')
    expect(onRowClick).not.toHaveBeenCalled()
  })

  it('renders the candidate cell unwrapped when no candidateId is present', () => {
    const row = { ...baseRow, id: 73, candidateId: null }
    render(<MatchesTable rows={[row]} />)
    expect(screen.queryByRole('button', { name: /Kandidaat openen/ })).toBeNull()
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
  })
})
