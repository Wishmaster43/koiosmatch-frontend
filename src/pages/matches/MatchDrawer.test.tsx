/**
 * MatchDrawer — Koppelingen tab regression guard (EXTRACT-1): the shared
 * BackofficeLinksTab is wired in as the LAST tab, with the entity/id/canLink
 * props MatchDrawer derives from its own props (mirrors VacancyDrawer.test.tsx —
 * every other tab body is stubbed so only the header + tab bar + the tab under
 * test actually mount).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Real i18n (nl) side-effect init so the tab labels resolve genuine Dutch text.
import '@/i18n'
import MatchDrawer from './MatchDrawer'
import type { MatchRow } from '@/types/match'

vi.mock('@/lib/useMatchStatuses', () => ({ useMatchStatuses: () => ({ statuses: [{ value: 'open', label: 'Open' }] }) }))
vi.mock('@/lib/useCustomFields', () => ({ useCustomFields: () => ({ fields: [] }) }))
// avatar_color values off the /users payload — DATA fixtures, not UI styling.
// eslint-disable-next-line no-restricted-syntax -- API fixture value, never rendered as a style literal
const COLOR_A = '#abcdef'
// eslint-disable-next-line no-restricted-syntax -- API fixture value, never rendered as a style literal
const COLOR_B = '#123456'

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
vi.mock('./drawer/MatchContractSection', () => ({ default: () => null }))
vi.mock('./drawer/RelationsTab', () => ({ default: () => null }))
vi.mock('./drawer/ChangelogTab', () => ({ default: () => null }))

// The shared component itself has its own test suite (BackofficeLinksTab.test.tsx);
// here we only prove MatchDrawer wires it in with the right props.
const mockBackofficeLinksTab = vi.fn()
vi.mock('@/components/drawer/BackofficeLinksTab', () => ({
  default: (props: Record<string, unknown>) => { mockBackofficeLinksTab(props); return <div>backoffice-links-content</div> },
}))

const match = {
  id: 'm1', referenceNumber: 'M-00001', candidate: 'Jan Jansen', initials: 'JJ',
  vacancy: 'Verpleegkundige', client: 'Acme', candidateId: null, vacancyId: null, clientId: null,
  score: null, stage: '', status: 'open', stageColor: '', owner: '', ownerInitials: '', ownerColor: null,
  date: '', approval_status: 'approved', archived: false,
  helloflexLink: null, shiftmanagerLink: { status: 'linked', externalId: 'HF-9', lastError: null, lastSyncedAt: null, linkedAt: null, linkedBy: null },
} as unknown as MatchRow

describe('MatchDrawer · Koppelingen tab (EXTRACT-1)', () => {
  it('renders "Koppelingen" as the LAST tab, after Overzicht/Contract & financieel/Relaties', () => {
    render(<MatchDrawer match={match} onClose={vi.fn()} />)
    const tabLabels = ['Overzicht', 'Contract & financieel', 'Relaties', 'Koppelingen']
    const tabButtons = screen.getAllByRole('tab').filter(b => tabLabels.includes(b.textContent ?? ''))
    expect(tabButtons.map(b => b.textContent)).toEqual(tabLabels)
  })

  it('shows the shared BackofficeLinksTab content when the Koppelingen tab is clicked, with the right entity/id/canLink props', async () => {
    const user = userEvent.setup()
    render(<MatchDrawer match={match} onClose={vi.fn()} canLinkBackoffice />)
    await user.click(screen.getByRole('tab', { name: 'Koppelingen' }))
    expect(screen.getByText('backoffice-links-content')).toBeInTheDocument()
    expect(mockBackofficeLinksTab).toHaveBeenCalledWith(expect.objectContaining({
      entity: 'matches', id: 'm1', canLink: true,
      helloflexLink: null, shiftmanagerLink: match.shiftmanagerLink,
    }))
  })

  it('defaults canLink to false when the caller omits canLinkBackoffice (no matches.update permission)', async () => {
    const user = userEvent.setup()
    render(<MatchDrawer match={match} onClose={vi.fn()} />)
    await user.click(screen.getByRole('tab', { name: 'Koppelingen' }))
    expect(mockBackofficeLinksTab).toHaveBeenCalledWith(expect.objectContaining({ canLink: false }))
  })
})

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
    expect(screen.getByRole('button', { name: /Geen eigenaar/ })).toBeInTheDocument()
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
