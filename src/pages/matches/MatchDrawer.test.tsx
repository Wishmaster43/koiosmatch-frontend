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
    const tabButtons = screen.getAllByRole('button').filter(b => tabLabels.includes(b.textContent ?? ''))
    expect(tabButtons.map(b => b.textContent)).toEqual(tabLabels)
  })

  it('shows the shared BackofficeLinksTab content when the Koppelingen tab is clicked, with the right entity/id/canLink props', async () => {
    const user = userEvent.setup()
    render(<MatchDrawer match={match} onClose={vi.fn()} canLinkBackoffice />)
    await user.click(screen.getByRole('button', { name: 'Koppelingen' }))
    expect(screen.getByText('backoffice-links-content')).toBeInTheDocument()
    expect(mockBackofficeLinksTab).toHaveBeenCalledWith(expect.objectContaining({
      entity: 'matches', id: 'm1', canLink: true,
      helloflexLink: null, shiftmanagerLink: match.shiftmanagerLink,
    }))
  })

  it('defaults canLink to false when the caller omits canLinkBackoffice (no matches.update permission)', async () => {
    const user = userEvent.setup()
    render(<MatchDrawer match={match} onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Koppelingen' }))
    expect(mockBackofficeLinksTab).toHaveBeenCalledWith(expect.objectContaining({ canLink: false }))
  })
})
