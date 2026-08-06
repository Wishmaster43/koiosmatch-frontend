/**
 * CandidateDrawer — RECHTEN-DETAIL-1 (Danny GO 06-08) archive-gate regression.
 *
 * Archive/restore/mark-deletion split off `candidates.update` onto their own
 * `candidates.archive` permission on the backend (routes/api/tenant/candidates.php).
 * The parent page still passes onArchive/onRestore/onMarkDeletion unconditionally
 * (only onMerged is permission-gated there), so without a drawer-side check every
 * role would render — and be able to click — a control the backend now 403s. This
 * file proves the drawer withholds those three affordances without the permission,
 * while leaving hard-delete's own admin-role gate (§7: no fake affordance) untouched.
 * Every heavy tab body + the phase/status + header-edit hooks are stubbed so this
 * stays a header/banner permission test (mirrors VacancyDrawer.test.tsx / DELETE-ICON-1
 * in CustomerDrawer.test.tsx).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import CandidateDrawer from './CandidateDrawer'
import type { Candidate } from '@/types/candidate'
import type { ComponentProps } from 'react'

// The axios client — keep the real unwrap/unwrapList helpers (several lookup hooks
// use them), stub only the HTTP verbs so no real network call fires.
vi.mock('@/lib/api', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return {
    ...actual,
    default: {
      ...actual.default,
      get: vi.fn(() => Promise.resolve({ data: {} })),
      post: vi.fn(() => Promise.resolve({ data: {} })),
      patch: vi.fn(() => Promise.resolve({ data: {} })),
      delete: vi.fn(() => Promise.resolve({ data: {} })),
    },
  }
})

// Tenant candidate lookups (phase/status/contract-form) — no provider is mounted,
// so useLookups needs its own stub (it throws outside a LookupsProvider).
vi.mock('@/context/LookupsContext', () => ({ useLookups: () => ({ phases: [], statuses: [], candidateTypes: [] }) }))

// Session + permission plumbing — a vi.fn() wrapper (mock-prefixed so Vitest hoists
// it alongside the vi.mock call, mirrors CustomerDrawer.test.tsx's DELETE-ICON-1
// mockUseAuth) so each test below can grant/deny candidates.archive independently.
interface MockAuthValue { hasModule: (m: string) => boolean; isSuperAdmin: () => boolean; hasRole: (r: string) => boolean; hasPermission: (p: string) => boolean }
const mockUseAuth = vi.fn((): MockAuthValue => ({ hasModule: () => false, isSuperAdmin: () => false, hasRole: () => false, hasPermission: () => false }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))

vi.mock('@/lib/useCustomFields', () => ({ useCustomFields: () => ({ fields: [] }) }))

// The phase/status axis + header name/function edit carry their own heavy fetches
// (matches, vacancy options, …) irrelevant to the archive gate under test — stub
// them to static, inert defaults (mock-prefixed for the same hoisting reason).
/* eslint-disable no-restricted-syntax -- DATA: fixture phase colour, not UI styling */
const mockUseCandidateStatus = vi.fn(() => ({
  showStatus: true, currentStatus: 'available', statuses: [{ value: 'available', label: 'Available' }],
  changeStatus: vi.fn(), canEditStatusReason: false, openStatusEdit: vi.fn(),
  phaseInfo: { label: 'Candidate', color: '#1B60A9' }, currentPhase: 'candidate',
  isEntryPhase: false, nextPhase: undefined, converting: false, doConvert: vi.fn(),
  matchPrompt: false, setMatchPrompt: vi.fn(), matchChoice: null, setMatchChoice: vi.fn(),
  newMatchVacancyId: '', setNewMatchVacancyId: vi.fn(), vacancyOptions: [], creatingMatch: false,
  confirmPlacedMatch: vi.fn(), statusModal: null, setStatusModal: vi.fn(), confirmStatus: vi.fn(),
}))
/* eslint-enable no-restricted-syntax */
vi.mock('./hooks/useCandidateStatus', () => ({ useCandidateStatus: () => mockUseCandidateStatus() }))

const mockUseCandidateHeaderEdit = vi.fn(() => ({
  headerEditing: false, hf: () => '', setHF: vi.fn(), startHeaderEdit: vi.fn(), saveHeader: vi.fn(), setHeaderEditing: vi.fn(),
}))
vi.mock('./hooks/useCandidateHeaderEdit', () => ({ useCandidateHeaderEdit: () => mockUseCandidateHeaderEdit() }))

// Every tab body pulls in its own API/react-query dependencies, irrelevant to this
// header/banner guard — stub them (mirrors VacancyDrawer.test.tsx / ApplicationDrawer.test.tsx).
vi.mock('./drawer/ProfilePanel', () => ({ default: () => <div>profile-tab-content</div> }))
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
// ChangelogTab only mounts once the ChangelogPopover is opened (untested here) —
// stubbed anyway to keep the import graph light, same reasoning as VacancyDrawer.test.tsx.
vi.mock('./drawer/ChangelogTab', () => ({ default: () => null }))
vi.mock('./drawer/MergeCandidateModal', () => ({ default: () => null }))

const ct = (key: string) => i18n.t(key, { ns: 'candidates' })

const candidate = (over: Partial<Candidate> = {}): Candidate => ({
  id: 'c1', name: 'Jan Jansen', initials: 'JJ', phase: 'candidate', status: 'available',
  candidateTypes: [], tags: [], created: '2026-01-01T00:00:00Z', matches: [],
  referenceNumber: 'K-1', title: 'Verpleegkundige',
  firstname: 'Jan', lastname: 'Jansen', middleName: '',
  archived: false,
  ...over,
} as unknown as Candidate)

// Several real (unstubbed) header hooks — useGenders/useFunctions/useCvSettings/
// useAllSettings — resolve their mocked api.get() a tick after the initial render;
// flushing that microtask under act() here keeps every test below warning-free
// instead of repeating the same act(async () => {}) after each render() call.
async function renderDrawer(props: Partial<ComponentProps<typeof CandidateDrawer>> & { candidate: Candidate }) {
  render(<CandidateDrawer onClose={() => {}} expanded={false} onToggleExpand={() => {}} {...props} />)
  await act(async () => {})
}

describe('CandidateDrawer · archive icon (RECHTEN-DETAIL-1, candidates.archive)', () => {
  it('renders NO archive icon without candidates.archive, even though onArchive is passed', async () => {
    mockUseAuth.mockReturnValue({ hasModule: () => false, isSuperAdmin: () => false, hasRole: () => false, hasPermission: () => false })
    await renderDrawer({ candidate: candidate(), onArchive: vi.fn() })
    expect(screen.queryByTitle(ct('drawer.archive'))).toBeNull()
  })

  it('renders the archive icon once candidates.archive is granted, and clicking it calls onArchive with the id', async () => {
    mockUseAuth.mockReturnValue({ hasModule: () => false, isSuperAdmin: () => false, hasRole: () => false, hasPermission: p => p === 'candidates.archive' })
    const onArchive = vi.fn()
    const user = userEvent.setup()
    await renderDrawer({ candidate: candidate(), onArchive })

    const icon = screen.getByTitle(ct('drawer.archive'))
    await user.click(icon)
    expect(onArchive).toHaveBeenCalledWith('c1')
  })

  it('never renders the archive icon on an already-archived candidate, permission or not', async () => {
    mockUseAuth.mockReturnValue({ hasModule: () => false, isSuperAdmin: () => false, hasRole: () => false, hasPermission: p => p === 'candidates.archive' })
    await renderDrawer({ candidate: candidate({ archived: true }), onArchive: vi.fn() })
    expect(screen.queryByTitle(ct('drawer.archive'))).toBeNull()
  })
})

describe('CandidateDrawer · archived banner restore/mark-deletion (RECHTEN-DETAIL-1, candidates.archive)', () => {
  it('withholds BOTH restore and move-to-trash without candidates.archive, even though the callbacks are passed', async () => {
    mockUseAuth.mockReturnValue({ hasModule: () => false, isSuperAdmin: () => false, hasRole: () => false, hasPermission: () => false })
    await renderDrawer({ candidate: candidate({ archived: true }), onRestore: vi.fn(), onMarkDeletion: vi.fn() })

    expect(screen.queryByTitle(ct('drawer.restore'))).toBeNull()
    expect(screen.queryByTitle(ct('erase.markDelete'))).toBeNull()
  })

  it('shows restore and move-to-trash once candidates.archive is granted, and each calls its own callback with the id', async () => {
    mockUseAuth.mockReturnValue({ hasModule: () => false, isSuperAdmin: () => false, hasRole: () => false, hasPermission: p => p === 'candidates.archive' })
    const onRestore = vi.fn()
    const onMarkDeletion = vi.fn()
    const user = userEvent.setup()
    await renderDrawer({ candidate: candidate({ archived: true }), onRestore, onMarkDeletion })

    await user.click(screen.getByTitle(ct('drawer.restore')))
    expect(onRestore).toHaveBeenCalledWith('c1')
    await user.click(screen.getByTitle(ct('erase.markDelete')))
    expect(onMarkDeletion).toHaveBeenCalledWith('c1')
  })

  it('hard delete keeps its OWN admin-role gate — candidates.archive alone does not unlock it', async () => {
    // Granted: candidates.archive (so restore/mark-deletion show) but no admin role.
    mockUseAuth.mockReturnValue({ hasModule: () => false, isSuperAdmin: () => false, hasRole: () => false, hasPermission: p => p === 'candidates.archive' })
    await renderDrawer({ candidate: candidate({ archived: true, lifecycle: 'pending_erase' } as Partial<Candidate>),
      onRestore: vi.fn(), onMarkDeletion: vi.fn(), onHardDelete: vi.fn() })

    expect(screen.queryByTitle(ct('drawer.hardDelete'))).toBeNull()
  })
})
