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
