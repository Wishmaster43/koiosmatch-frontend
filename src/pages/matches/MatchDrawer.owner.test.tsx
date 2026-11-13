/** MatchDrawer · owner picker (split from MatchDrawer.test.tsx; mock header duplicated, hoisted mocks cannot be shared). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import MatchDrawer from './MatchDrawer'
import type { MatchRow } from '@/types/match'
import { match, COLOR_A, COLOR_B } from './MatchDrawer.testKit'

// MATCH-TERMINATE-1: metaOf's is_closed flag now drives the header's terminate
// button gate — the mock must return a working metaOf, not just a bare list.
// X-3 / B2: auth is mocked per test — null (no provider) by default, so every block
// written before the mock keeps the exact behaviour it was written against.
const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn((): unknown => null) }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))

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
// DD-FE-6 ("no empty tabs"): the Koppelingen tab now only lists when a connector
// app is enabled (useBackofficeLinksVisible reads this). Default to "hf" enabled
// so the tab bar keeps proving the SHOWN case here; the dedicated describe block in
// MatchDrawer.test.tsx overrides this to prove the hidden case.
const mockUseApps = vi.fn()
vi.mock('@/context/AppsContext', () => ({ useApps: () => mockUseApps() }))
beforeEach(() => { mockUseApps.mockReturnValue({ isAppEnabled: (id: string) => id === 'hf' }) })
// goedkeuring-badge-eerlijk (08-08): default the tenant approval mode to a "real"
// one (not 'off') so every test in this file keeps proving its own thing undisturbed; the dedicated
// describe block in MatchDrawer.test.tsx overrides this to prove the honesty gate.
const mockUseMatchApprovalMode = vi.fn()
vi.mock('./hooks/useMatchApprovalMode', () => ({ useMatchApprovalMode: () => mockUseMatchApprovalMode() }))
beforeEach(() => { mockUseMatchApprovalMode.mockReturnValue({ approvalMode: 'always' }) })

// The owner picker's option source (MATCH-OWNER-1) — stubbed so no QueryClient is needed.
vi.mock('@/lib/queries', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/queries')>()),
  useUsers: () => ({ data: [
    { id: 'u-1', name: 'Nina Bakker', avatar_color: COLOR_A },
    { id: 'u-7', name: 'Piet de Vries', avatar_color: COLOR_B },
  ] }),
}))
// Every other tab body pulls in its own API/react-query dependencies, irrelevant
// to this tab-bar guard — stub them (mirrors VacancyDrawer.test.tsx).
vi.mock('./drawer/OverviewTab', () => ({ default: () => null }))
vi.mock('./drawer/StatisticsTab', () => ({ default: () => null }))
vi.mock('./drawer/MatchContractSection', () => ({ default: () => null }))
vi.mock('./drawer/ChangelogTab', () => ({ default: () => null }))
vi.mock('./drawer/NotesTab', () => ({ default: () => null }))

/**
 * MATCH-OWNER-1: the header owner used to be a dead <div> that LOOKED like a
 * control (metaExtra) while PATCH /matches/{id} has accepted owner_id all along.
 * These guard the two halves: a real picker when a handler is wired, and an
 * honest read-only value — never a no-op picker — when it is not.
 */
// Owner name deliberately differs from the fixture's candidate name — SelectMenu's
// trigger concatenates the avatar initials into its accessible name ("NBNina Bakker"),
// so the queries below match on the name fragment.
const owned = (over: Partial<MatchRow> = {}) =>
  ({ ...match, owner: 'Nina Bakker', ownerId: 'u-1', ownerInitials: 'NB', ownerColor: COLOR_A, ...over }) as unknown as MatchRow

describe('MatchDrawer · owner picker (MATCH-OWNER-1)', () => {
  it('reassigns via a real picker, handing the caller the whole picked user', async () => {
    const user = userEvent.setup()
    const onSetOwner = vi.fn()
    render(<MatchDrawer match={owned()} onClose={vi.fn()} onSetOwner={onSetOwner} />)

    // The trigger shows the CURRENT owner — proof it preselects on ownerId, not on name.
    await user.click(screen.getByRole('button', { name: /Nina Bakker/ }))
    await user.click(screen.getByRole('button', { name: /Piet de Vries/ }))
    // The page forwards this object straight into the owner_id PATCH + optimistic write.
    expect(onSetOwner).toHaveBeenCalledWith({ id: 'u-7', name: 'Piet de Vries', avatar_color: COLOR_B })
  })

  it('shows the placeholder, not a blank box, on an ownerless match', () => {
    render(<MatchDrawer match={owned({ owner: '', ownerId: null, ownerInitials: '' })} onClose={vi.fn()} onSetOwner={vi.fn()} />)
    expect(screen.getByRole('button', { name: new RegExp(i18n.t('matches:drawer.ownerUnassigned')) })).toBeInTheDocument()
  })

  it('keeps an owner who is no longer in /users visible, and picking that entry is a no-op', async () => {
    const user = userEvent.setup()
    const onSetOwner = vi.fn()
    render(<MatchDrawer match={owned({ owner: 'Ex Medewerker', ownerId: 'u-gone', ownerInitials: 'EM' })} onClose={vi.fn()} onSetOwner={onSetOwner} />)

    await user.click(screen.getByRole('button', { name: /Ex Medewerker/ }))
    // The synthetic fallback entry is a label, not a target: selecting it must not PATCH.
    await user.click(screen.getAllByRole('button', { name: /Ex Medewerker/ })[1])
    expect(onSetOwner).not.toHaveBeenCalled()
  })

  it('renders the owner READ-ONLY (no picker) when no handler is wired — no fake affordance', () => {
    render(<MatchDrawer match={owned()} onClose={vi.fn()} />)
    expect(screen.getByText('Nina Bakker')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Nina Bakker/ })).not.toBeInTheDocument()
  })

  it('renders the owner READ-ONLY on an archived match — restore first (mirrors the status picker)', () => {
    render(<MatchDrawer match={owned({ archived: true })} onClose={vi.fn()} onSetOwner={vi.fn()} />)
    expect(screen.getByText('Nina Bakker')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Nina Bakker/ })).not.toBeInTheDocument()
  })
})

// DROPDOWN-CLEAR-1 (B2): the header owner picker's clear X unsets the owner through the
// onUpdate path ({ ownerId: null }) — never through onSetOwner, which carries a picked user.
describe('MatchDrawer · owner picker clear (DROPDOWN-CLEAR-1)', () => {
  it('clears the owner via the X and hands { ownerId: null } to onUpdate', async () => {
    const user = userEvent.setup()
    const onSetOwner = vi.fn(); const onUpdate = vi.fn()
    render(<MatchDrawer match={owned()} onClose={vi.fn()} onSetOwner={onSetOwner} onUpdate={onUpdate} />)
    await user.click(screen.getByRole('button', { name: /wissen$/ }))
    expect(onUpdate).toHaveBeenCalledWith('m1', { ownerId: null })
    expect(onSetOwner).not.toHaveBeenCalled()
  })

  it('shows no clear X on an ownerless match (placeholder state)', () => {
    render(<MatchDrawer match={owned({ owner: '', ownerId: null, ownerInitials: '' })} onClose={vi.fn()} onSetOwner={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /wissen$/ })).toBeNull()
    expect(screen.getByRole('button', { name: new RegExp(i18n.t('matches:drawer.ownerUnassigned')) })).toBeInTheDocument()
  })
})
