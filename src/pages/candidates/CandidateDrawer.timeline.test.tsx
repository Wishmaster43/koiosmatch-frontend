/**
 * CandidateDrawer — TIJDLIJN-OVERAL (27-08) regression: the new Timeline tab
 * mounts second-to-last (Statistics stays last) and reuses the same
 * ChangelogTab content the title-row popover shows.
 */
import { describe, it, expect, vi } from 'vitest'
import type { ReactElement } from 'react'
import { render, screen, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@/i18n'
import CandidateDrawer from './CandidateDrawer'
import type { Candidate } from '@/types/candidate'

// The timeline tab's ChangelogTab uses react-query — every render below needs a client.
const queryClient = new QueryClient()
const renderWithClient = (ui: ReactElement) => render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)

vi.mock('@/context/LookupsContext', () => ({ useLookups: () => ({ phases: [], statuses: [], candidateTypes: [] }) }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasModule: () => false, isSuperAdmin: () => false, hasRole: () => false, hasPermission: () => false }) }))
const mockCustomFields = vi.fn(() => ({ fields: [] as unknown[] }))
vi.mock('@/lib/useCustomFields', () => ({ useCustomFields: () => mockCustomFields() }))
vi.mock('./hooks/useCandidateStatus', () => ({ useCandidateStatus: () => ({
  showStatus: true, currentStatus: 'available', statuses: [{ value: 'available', label: 'Available' }],
  changeStatus: vi.fn(), canEditStatusReason: false, openStatusEdit: vi.fn(),
  phaseInfo: { label: 'Candidate', color: 'var(--color-primary)' }, currentPhase: 'candidate',
  isEntryPhase: false, nextPhase: undefined, converting: false, doConvert: vi.fn(),
  matchPrompt: false, setMatchPrompt: vi.fn(), matchChoice: null, setMatchChoice: vi.fn(),
  newMatchVacancyId: '', setNewMatchVacancyId: vi.fn(), vacancyOptions: [], creatingMatch: false,
  confirmPlacedMatch: vi.fn(), statusModal: null, setStatusModal: vi.fn(), confirmStatus: vi.fn(),
}) }))
vi.mock('./hooks/useCandidateHeaderEdit', () => ({ useCandidateHeaderEdit: () => ({ headerEditing: false, hf: () => '', setHF: vi.fn(), startHeaderEdit: vi.fn(), saveHeader: vi.fn(), setHeaderEditing: vi.fn() }) }))

// Every other tab body is irrelevant to this test — stub inert.
vi.mock('./drawer/ProfilePanel', () => ({ default: () => null }))
vi.mock('./drawer/BackgroundTab', () => ({ default: () => null }))
vi.mock('./drawer/WorkTab', () => ({ default: () => null }))
vi.mock('./drawer/VacancySearchTab', () => ({ default: () => null }))
vi.mock('@/components/drawer/CustomFieldsTab', () => ({ default: () => null }))
vi.mock('./drawer/PlanningPanel', () => ({ default: () => null }))
vi.mock('./drawer/PreferencesZzpTabs', () => ({ PreferencesTab: () => null, ZzpTab: () => null }))
vi.mock('./drawer/CommunicationTab', () => ({ default: () => null }))
vi.mock('./drawer/DocumentsSection', () => ({ default: () => null }))
vi.mock('./drawer/IntegrationsTab', () => ({ default: () => null }))
vi.mock('./drawer/StatisticsTab', () => ({ default: () => null }))
vi.mock('./drawer/MergeCandidateModal', () => ({ default: () => null }))

// Track the activity fetch to prove the timeline tab's ChangelogTab really fires it.
const activityGet = vi.fn(() => Promise.resolve({ data: { data: [] } }))
vi.mock('@/lib/api', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { ...actual.default, get: (url: string) => {
    if (String(url) === '/candidates/c1/activity') return activityGet()
    return Promise.resolve({ data: {} })
  }, post: vi.fn(() => Promise.resolve({ data: {} })), patch: vi.fn(() => Promise.resolve({ data: {} })), delete: vi.fn(() => Promise.resolve({ data: {} })) } }
})


const candidate: Candidate = {
  id: 'c1', name: 'Jan Jansen', initials: 'JJ', phase: 'candidate', status: 'available',
  candidateTypes: [], tags: [], created: '2026-01-01T00:00:00Z', matches: [],
  referenceNumber: 'K-1', title: 'Verpleegkundige',
  firstname: 'Jan', lastname: 'Jansen', middleName: '',
  archived: false,
} as unknown as Candidate

describe('CandidateDrawer · timeline tab (TIJDLIJN-OVERAL)', () => {
  it('mounts the timeline tab second-to-last, with statistics last', async () => {
    renderWithClient(<CandidateDrawer candidate={candidate} onClose={() => {}} expanded={false} onToggleExpand={() => {}} />)
    await act(async () => {})
    const tabs = screen.getAllByRole('tab').map(el => el.textContent)
    // Literal labels: a raw-key render (missing i18n) must FAIL here, never round-trip.
    expect(tabs[tabs.length - 2]).toBe('Tijdlijn')
    expect(tabs[tabs.length - 1]).toBe('Statistieken')
  })

  // Opus verify (blocker): with ≥1 active custom field the Extra tab used to be
  // APPENDED after Statistics — the tail must stay ... Extra · Tijdlijn · Statistieken.
  it('keeps the tail order Extra · Tijdlijn · Statistieken when custom fields are active', async () => {
    mockCustomFields.mockReturnValue({ fields: [{ key: 'cf1', label: 'Extra veld', type: 'text' }] })
    renderWithClient(<CandidateDrawer candidate={candidate} onClose={() => {}} expanded={false} onToggleExpand={() => {}} />)
    await act(async () => {})
    const tabs = screen.getAllByRole('tab').map(el => el.textContent)
    expect(tabs.slice(-3)).toEqual(['Extra', 'Tijdlijn', 'Statistieken'])
  })

  it('opening the timeline tab renders the changelog content and fetches /candidates/{id}/activity', async () => {
    renderWithClient(<CandidateDrawer candidate={candidate} onClose={() => {}} expanded={false} onToggleExpand={() => {}} initialTab="timeline" />)
    await act(async () => {})
    expect(activityGet).toHaveBeenCalled()
  })
})
