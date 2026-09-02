import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Real i18n runtime: the failed icon's title must carry the translated sentence + error.
import '@/i18n'
import BackofficeLinkStatusIcons from './BackofficeLinkStatusIcons'
import type { CandidateBackofficeLink } from '@/types/candidate'

// Tenant app gate (hf/shiftmanager connector), controlled per test.
const mockUseApps = vi.fn()
vi.mock('@/context/AppsContext', () => ({ useApps: () => mockUseApps() }))

// Build a link fixture (mirrors CandidatesTable.test.tsx's `link()` helper).
const link = (overrides: Partial<CandidateBackofficeLink> = {}): CandidateBackofficeLink => ({
  status: null, externalId: null, lastError: null, lastSyncedAt: null, linkedAt: null, linkedBy: null, ...overrides,
})

describe('BackofficeLinkStatusIcons', () => {
  it('renders an icon for a linked system and hides it for an unlinked one', () => {
    mockUseApps.mockReturnValue({ isAppEnabled: (id: string) => id === 'hf' || id === 'shiftmanager' })
    render(
      <BackofficeLinkStatusIcons helloflexLink={link({ status: 'linked' })} shiftmanagerLink={null}
        onOpenIntegrations={() => {}} />
    )
    expect(screen.getByTitle('HelloFlex gekoppeld')).toBeInTheDocument()
    expect(screen.queryAllByRole('button')).toHaveLength(1)
  })

  it('renders a warning icon for a failed sync', () => {
    mockUseApps.mockReturnValue({ isAppEnabled: () => true })
    render(
      <BackofficeLinkStatusIcons helloflexLink={null} shiftmanagerLink={link({ status: 'failed', lastError: 'timeout' })}
        onOpenIntegrations={() => {}} />
    )
    expect(screen.getByTitle('Shiftmanager synchronisatie mislukt: timeout')).toBeInTheDocument()
  })

  it('names a failed sync without a captured reason as a plain sentence (no dangling colon)', () => {
    mockUseApps.mockReturnValue({ isAppEnabled: () => true })
    render(
      <BackofficeLinkStatusIcons helloflexLink={null} shiftmanagerLink={link({ status: 'failed', lastError: null })}
        onOpenIntegrations={() => {}} />
    )
    expect(screen.getByTitle('Shiftmanager synchronisatie mislukt')).toBeInTheDocument()
  })

  it('renders nothing when the connector app is off, even for a linked system', () => {
    mockUseApps.mockReturnValue({ isAppEnabled: () => false })
    render(
      <BackofficeLinkStatusIcons helloflexLink={link({ status: 'linked' })} shiftmanagerLink={link({ status: 'failed' })}
        onOpenIntegrations={() => {}} />
    )
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('jumps to the Links tab when an icon is clicked', async () => {
    mockUseApps.mockReturnValue({ isAppEnabled: () => true })
    const onOpen = vi.fn()
    render(
      <BackofficeLinkStatusIcons helloflexLink={link({ status: 'linked' })} shiftmanagerLink={null}
        onOpenIntegrations={onOpen} />
    )
    await userEvent.click(screen.getByRole('button'))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })
})
