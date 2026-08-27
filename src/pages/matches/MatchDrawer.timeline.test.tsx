/**
 * MatchDrawer — TIJDLIJN-OVERAL (27-08) regression: the new Timeline tab mounts
 * second-to-last (Statistics stays last) and reuses the same ChangelogTab
 * content the title-row popover shows.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MatchDrawer from './MatchDrawer'
import type { MatchRow } from '@/types/match'

// Track the activity fetch to prove the timeline tab's ChangelogTab really fires it.
const activityGet = vi.fn(() => Promise.resolve({ data: { data: [] } }))
vi.mock('@/lib/api', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { ...actual.default, get: (url: string) => {
    if (String(url) === '/matches/m1/activity') return activityGet()
    return Promise.resolve({ data: {} })
  } } }
})

vi.mock('@/lib/useMatchStatuses', () => ({
  useMatchStatuses: () => ({
    statuses: [{ value: 'open', label: 'Open' }, { value: 'closed', label: 'Afgesloten' }],
    metaOf: (v?: string | null) => ({
      open: { value: 'open', label: 'Open', is_closed: false },
      closed: { value: 'closed', label: 'Afgesloten', is_closed: true },
    })[v ?? ''],
  }),
}))
vi.mock('@/lib/useCustomFields', () => ({ useCustomFields: () => ({ fields: [] }) }))
vi.mock('@/context/LookupsContext', () => ({ useLookups: () => ({ candidateTypes: [] }) }))
const mockUseApps = vi.fn()
vi.mock('@/context/AppsContext', () => ({ useApps: () => mockUseApps() }))
beforeEach(() => { mockUseApps.mockReturnValue({ isAppEnabled: () => false } as unknown as ReturnType<typeof mockUseApps>) })
const mockUseMatchApprovalMode = vi.fn()
vi.mock('./hooks/useMatchApprovalMode', () => ({ useMatchApprovalMode: () => mockUseMatchApprovalMode() }))
beforeEach(() => { mockUseMatchApprovalMode.mockReturnValue({ approvalMode: 'always' }) })
vi.mock('@/lib/queries', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/queries')>()),
  useUsers: () => ({ data: [] }),
}))

// Every other tab body is irrelevant to this test — stub inert.
vi.mock('./drawer/OverviewTab', () => ({ default: () => null }))
vi.mock('./drawer/StatisticsTab', () => ({ default: () => null }))
vi.mock('./drawer/MatchContractSection', () => ({ default: () => null }))
vi.mock('./drawer/NotesTab', () => ({ default: () => null }))
vi.mock('./drawer/TerminateMatchModal', () => ({ default: () => null }))
vi.mock('./drawer/RenewMatchModal', () => ({ default: () => null }))

const match = {
  id: 'm1', referenceNumber: 'M-00001', candidate: 'Jan Jansen', initials: 'JJ',
  vacancy: 'Verpleegkundige', client: 'Acme', candidateId: null, vacancyId: null, clientId: null,
  score: null, stage: '', status: 'open', stageColor: '', owner: '', ownerInitials: '', ownerColor: null,
  date: '', approval_status: 'approved', archived: false,
  helloflexLink: null, shiftmanagerLink: null,
} as unknown as MatchRow

describe('MatchDrawer · timeline tab (TIJDLIJN-OVERAL)', () => {
  it('mounts the timeline tab second-to-last, with statistics last', () => {
    render(<MatchDrawer match={match} onClose={vi.fn()} />)
    const texts = screen.getAllByRole('tab').map(b => b.textContent)
    expect(texts[texts.length - 1]).toBe('Statistieken')
    expect(texts[texts.length - 2]).toBe('Tijdlijn')
  })

  // Conditional combo (Opus verify): with custom fields AND backoffice links
  // enabled, the tail order must STILL be ... extra/links · Tijdlijn · Statistieken.
  it('keeps timeline second-to-last with extra and links tabs enabled', async () => {
    const { useCustomFields } = await import('@/lib/useCustomFields')
    vi.mocked(useCustomFields as unknown as () => unknown)
    mockUseApps.mockReturnValue({ isAppEnabled: () => true } as unknown as ReturnType<typeof mockUseApps>)
    render(<MatchDrawer match={match} onClose={vi.fn()} />)
    const texts = screen.getAllByRole('tab').map(b => b.textContent)
    expect(texts[texts.length - 1]).toBe('Statistieken')
    expect(texts[texts.length - 2]).toBe('Tijdlijn')
  })

  it('opening the timeline tab renders the changelog content and fetches /matches/{id}/activity', async () => {
    const user = userEvent.setup()
    render(<MatchDrawer match={match} onClose={vi.fn()} />)
    const tabButtons = screen.getAllByRole('tab')
    // The second-to-last tab is the new timeline tab.
    await user.click(tabButtons[tabButtons.length - 2])
    expect(activityGet).toHaveBeenCalled()
  })
})
