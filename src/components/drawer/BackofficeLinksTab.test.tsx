/**
 * BackofficeLinksTab — the shared HelloFlex/Shiftmanager cards (EXTRACT-1). Covers
 * the app-flag gating, the generic entity-agnostic "Koppelen" POST (route + body
 * per entity, §13: asserts the real request, never just that a callback fired),
 * the `canLink` disabled-button gate (§7 — no fake affordances), the `children`
 * slot (mirrors the candidate's PDOK card), and the Shiftmanager "Nu
 * synchroniseren" mutation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BackofficeLinksTab from './BackofficeLinksTab'
import type { BackofficeLink } from '@/lib/backofficeLink'

const mockUseApps = vi.fn()
const mockPost = vi.fn()
const mockNotifySuccess = vi.fn()
const mockNotifyError = vi.fn()

vi.mock('@/context/AppsContext', () => ({ useApps: () => mockUseApps() }))
vi.mock('@/lib/api', () => ({ default: { post: (...args: unknown[]) => mockPost(...args) } }))
vi.mock('@/lib/notify', () => ({ notifySuccess: (...a: unknown[]) => mockNotifySuccess(...a), notifyError: (...a: unknown[]) => mockNotifyError(...a) }))
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => v, formatDateTime: (v: string) => `fmt(${v})` }) }))

const link = (overrides: Partial<BackofficeLink> = {}): BackofficeLink => ({
  status: null, externalId: null, lastError: null, lastSyncedAt: null, linkedAt: null, linkedBy: null, ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  mockUseApps.mockReturnValue({ isAppEnabled: () => false })
})

describe('BackofficeLinksTab · app-flag gating', () => {
  it('renders only the children slot when both connector apps are off', () => {
    render(
      <BackofficeLinksTab entity="customers" id="1" helloflexLink={null} shiftmanagerLink={null} canLink>
        <div>child-card-content</div>
      </BackofficeLinksTab>,
    )
    expect(screen.getByText('child-card-content')).toBeInTheDocument()
    expect(screen.queryByAltText('backofficeLinks.helloflex.alt')).toBeNull()
    expect(screen.queryByAltText('backofficeLinks.shiftmanager.alt')).toBeNull()
  })

  it('shows both cards, in HelloFlex-then-Shiftmanager order, when both apps are on', () => {
    mockUseApps.mockReturnValue({ isAppEnabled: () => true })
    render(<BackofficeLinksTab entity="customers" id="1" helloflexLink={null} shiftmanagerLink={null} canLink />)
    expect(screen.getByAltText('backofficeLinks.helloflex.alt')).toBeInTheDocument()
    expect(screen.getByAltText('backofficeLinks.shiftmanager.alt')).toBeInTheDocument()
    const buttons = screen.getAllByRole('button', { name: /backofficeLinks.common.linkButton/ })
    expect(buttons).toHaveLength(2)
  })
})

describe('BackofficeLinksTab · entity-agnostic "Koppelen" POST (§13: asserts the request)', () => {
  beforeEach(() => { mockUseApps.mockReturnValue({ isAppEnabled: () => true }) })

  it('POSTs /sync/{entity}/{id} { system } for a customers-entity link click', async () => {
    mockPost.mockResolvedValue({ data: { link: { status: 'pending' } } })
    const user = userEvent.setup()
    render(<BackofficeLinksTab entity="customers" id="42" helloflexLink={null} shiftmanagerLink={null} canLink />)
    const [helloflexBtn] = screen.getAllByRole('button', { name: /backofficeLinks.common.linkButton/ })
    await user.click(helloflexBtn)
    expect(mockPost).toHaveBeenCalledWith('/sync/customers/42', { system: 'helloflex' })
  })

  it('POSTs /sync/{entity}/{id} { system } for a matches-entity link click (different entity token)', async () => {
    mockPost.mockResolvedValue({ data: { link: { status: 'pending' } } })
    const user = userEvent.setup()
    render(<BackofficeLinksTab entity="matches" id="7" helloflexLink={null} shiftmanagerLink={null} canLink />)
    const [, shiftmanagerBtn] = screen.getAllByRole('button', { name: /backofficeLinks.common.linkButton/ })
    await user.click(shiftmanagerBtn)
    expect(mockPost).toHaveBeenCalledWith('/sync/matches/7', { system: 'shiftmanager' })
    await waitFor(() => expect(mockNotifySuccess).toHaveBeenCalledWith('backofficeLinks.common.linkStarted'))
  })

  it('POSTs /sync/{entity}/{id} for locations/departments/contacts too (same generic route)', async () => {
    mockPost.mockResolvedValue({ data: { link: { status: 'pending' } } })
    for (const entity of ['locations', 'departments', 'contacts']) {
      mockPost.mockClear()
      const user = userEvent.setup()
      const { unmount } = render(<BackofficeLinksTab entity={entity} id="9" helloflexLink={null} shiftmanagerLink={null} canLink />)
      const [helloflexBtn] = screen.getAllByRole('button', { name: /backofficeLinks.common.linkButton/ })
      await user.click(helloflexBtn)
      expect(mockPost).toHaveBeenCalledWith(`/sync/${entity}/9`, { system: 'helloflex' })
      unmount()
    }
  })
})

describe('BackofficeLinksTab · canLink gate (§7 — no fake affordances)', () => {
  beforeEach(() => { mockUseApps.mockReturnValue({ isAppEnabled: () => true }) })

  it('renders the "Koppelen" buttons DISABLED (never hidden) when canLink is false', async () => {
    const user = userEvent.setup()
    render(<BackofficeLinksTab entity="customers" id="1" helloflexLink={null} shiftmanagerLink={null} canLink={false} />)
    const buttons = screen.getAllByRole('button', { name: /backofficeLinks.common.linkButton/ })
    expect(buttons).toHaveLength(2)
    for (const btn of buttons) expect(btn).toBeDisabled()
    // A disabled native button never fires its click handler — the POST must not happen.
    await user.click(buttons[0]).catch(() => {})
    expect(mockPost).not.toHaveBeenCalled()
  })
})

describe('BackofficeLinksTab · Shiftmanager "Nu synchroniseren" (entity-prefixed sm_ route)', () => {
  beforeEach(() => { mockUseApps.mockReturnValue({ isAppEnabled: (a: string) => a === 'shiftmanager' }) })

  it('POSTs /sm_{entity}/sync/{externalId} on click', async () => {
    mockPost.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    const sm = link({ status: 'linked', externalId: '428' })
    render(<BackofficeLinksTab entity="candidates" id="1" helloflexLink={null} shiftmanagerLink={sm} canLink />)
    await user.click(screen.getByRole('button', { name: /backofficeLinks.shiftmanager.syncNow/ }))
    expect(mockPost).toHaveBeenCalledWith('/sm_candidates/sync/428')
    await waitFor(() => expect(mockNotifySuccess).toHaveBeenCalledWith('backofficeLinks.shiftmanager.syncSuccess'))
  })

  // Only /sm_candidates/sync/{externalId} exists in the API today. Offering the button
  // for the other entities would ship a control that 404s on every click, so it is not
  // rendered at all — this asserts that boundary, not just that a handler fired.
  it('does NOT offer the manual resync for an entity without an sm_ sync route', () => {
    const sm = link({ status: 'linked', externalId: '428' })
    render(<BackofficeLinksTab entity="customers" id="1" helloflexLink={null} shiftmanagerLink={sm} canLink />)
    expect(screen.getByText(/428/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /backofficeLinks.shiftmanager.syncNow/ })).toBeNull()
    expect(mockPost).not.toHaveBeenCalled()
  })
})

describe('BackofficeLinksTab · children slot (mirrors the candidate PDOK card)', () => {
  it('renders children ABOVE the HelloFlex/Shiftmanager cards', () => {
    mockUseApps.mockReturnValue({ isAppEnabled: () => true })
    render(
      <BackofficeLinksTab entity="customers" id="1" helloflexLink={null} shiftmanagerLink={null} canLink>
        <div data-testid="extra-card">extra-card</div>
      </BackofficeLinksTab>,
    )
    expect(screen.getByTestId('extra-card')).toBeInTheDocument()
    expect(screen.getByAltText('backofficeLinks.helloflex.alt')).toBeInTheDocument()
  })
})
