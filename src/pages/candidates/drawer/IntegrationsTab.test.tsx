/**
 * IntegrationsTab — module/app visibility gating (PDOK always, HelloFlex/Shiftmanager
 * OR-gated), the honest not-linked/pending/failed/linked states (KOPPELINGEN-META-1),
 * the shared "Koppelen" POST both systems fire, and the Shiftmanager "Nu synchroniseren"
 * mutation (§13: asserts the real POST route/body, never just that a callback fired).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import IntegrationsTab from './IntegrationsTab'
import type { Candidate, CandidateBackofficeLink } from '@/types/candidate'

const mockUseAuth = vi.fn()
const mockUseApps = vi.fn()
const mockPost = vi.fn()
const mockNotifySuccess = vi.fn()
const mockNotifyError = vi.fn()

vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))
vi.mock('@/context/AppsContext', () => ({ useApps: () => mockUseApps() }))
vi.mock('@/lib/api', () => ({ default: { post: (...args: unknown[]) => mockPost(...args) } }))
vi.mock('@/lib/notify', () => ({ notifySuccess: (...a: unknown[]) => mockNotifySuccess(...a), notifyError: (...a: unknown[]) => mockNotifyError(...a) }))
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => v, formatDateTime: (v: string) => `fmt(${v})` }) }))

// Base candidate — no module/app enabled, no coordinates, no backoffice links.
const baseCandidate = (overrides: Partial<Candidate> = {}): Candidate =>
  ({ id: 1, lat: null, lng: null, shiftmanagerLink: null, helloflexLink: null, ...overrides } as unknown as Candidate)

const link = (overrides: Partial<CandidateBackofficeLink> = {}): CandidateBackofficeLink => ({
  status: null, externalId: null, lastError: null, lastSyncedAt: null, linkedAt: null, linkedBy: null, ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue({ hasModule: () => false })
  mockUseApps.mockReturnValue({ isAppEnabled: () => false })
})

describe('IntegrationsTab · PDOK (always visible)', () => {
  it('shows the "not geocoded" fallback when lat/lng are null', () => {
    render(<IntegrationsTab c={baseCandidate()} />)
    expect(screen.getByText('integrations.pdok.notGeocoded')).toBeInTheDocument()
  })

  it('shows the "linked" chip + coordinates once lat/lng are known', () => {
    render(<IntegrationsTab c={baseCandidate({ lat: 52.3676, lng: 4.9041 })} />)
    expect(screen.getByText('integrations.pdok.linked')).toBeInTheDocument()
    expect(screen.getByText('52.36760, 4.90410')).toBeInTheDocument()
  })

  it('renders even when no module/app is enabled', () => {
    render(<IntegrationsTab c={baseCandidate()} />)
    expect(screen.getByAltText('integrations.pdok.alt')).toBeInTheDocument()
  })
})

describe('IntegrationsTab · HelloFlex card visibility (module OR app)', () => {
  it('stays hidden when neither the module nor the app flag is on', () => {
    render(<IntegrationsTab c={baseCandidate()} />)
    expect(screen.queryByAltText('integrations.helloflex.alt')).toBeNull()
  })

  it('shows via the module flag alone, with a "Koppelen" button when not linked', () => {
    mockUseAuth.mockReturnValue({ hasModule: (m: string) => m === 'hf' })
    render(<IntegrationsTab c={baseCandidate()} />)
    expect(screen.getByAltText('integrations.helloflex.alt')).toBeInTheDocument()
    expect(screen.getByText('integrations.helloflex.notLinked')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /integrations.common.linkButton/ })).toBeInTheDocument()
  })

  it('shows via the app/koppeling flag alone', () => {
    mockUseApps.mockReturnValue({ isAppEnabled: (a: string) => a === 'helloflex' })
    render(<IntegrationsTab c={baseCandidate()} />)
    expect(screen.getByAltText('integrations.helloflex.alt')).toBeInTheDocument()
  })
})

describe('IntegrationsTab · Shiftmanager card visibility (module OR app)', () => {
  it('stays hidden when neither signal is on', () => {
    render(<IntegrationsTab c={baseCandidate()} />)
    expect(screen.queryByAltText('integrations.shiftmanager.alt')).toBeNull()
  })

  it('shows via the module flag alone', () => {
    mockUseAuth.mockReturnValue({ hasModule: (m: string) => m === 'sm' })
    render(<IntegrationsTab c={baseCandidate()} />)
    expect(screen.getByAltText('integrations.shiftmanager.alt')).toBeInTheDocument()
  })

  it('shows via the app/koppeling flag alone', () => {
    mockUseApps.mockReturnValue({ isAppEnabled: (a: string) => a === 'shiftmanager' })
    render(<IntegrationsTab c={baseCandidate()} />)
    expect(screen.getByAltText('integrations.shiftmanager.alt')).toBeInTheDocument()
  })
})

describe('IntegrationsTab · not-linked state — real "Koppelen" button, never auto-fires', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ hasModule: () => true })
  })

  it('shows a "Koppelen" button for both systems and never calls the API on mount', () => {
    render(<IntegrationsTab c={baseCandidate()} />)
    expect(screen.getAllByRole('button', { name: /integrations.common.linkButton/ })).toHaveLength(2)
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('POSTs /sync/candidates/{id} { system: "shiftmanager" } only on click', async () => {
    mockPost.mockResolvedValue({ data: { link: { system: 'shiftmanager', status: 'pending' } } })
    const user = userEvent.setup()
    render(<IntegrationsTab c={baseCandidate()} />)
    const buttons = screen.getAllByRole('button', { name: /integrations.common.linkButton/ })
    // Shiftmanager card is the second SectionCard rendered (HelloFlex first).
    await user.click(buttons[1])
    expect(mockPost).toHaveBeenCalledTimes(1)
    expect(mockPost).toHaveBeenCalledWith('/sync/candidates/1', { system: 'shiftmanager' })
    await waitFor(() => expect(mockNotifySuccess).toHaveBeenCalledWith('integrations.common.linkStarted'))
    // Optimistic overlay: the card now reads "pending", not "not linked" anymore.
    expect(screen.getByText('integrations.common.statusPending')).toBeInTheDocument()
  })

  it('POSTs { system: "helloflex" } for the HelloFlex card', async () => {
    mockPost.mockResolvedValue({ data: { link: { system: 'helloflex', status: 'pending' } } })
    const user = userEvent.setup()
    render(<IntegrationsTab c={baseCandidate()} />)
    const buttons = screen.getAllByRole('button', { name: /integrations.common.linkButton/ })
    await user.click(buttons[0])
    expect(mockPost).toHaveBeenCalledWith('/sync/candidates/1', { system: 'helloflex' })
  })

  it('shows an error toast when the link POST fails, without crashing', async () => {
    mockPost.mockRejectedValue({ response: { data: { message: 'Geen rechten' } } })
    const user = userEvent.setup()
    render(<IntegrationsTab c={baseCandidate()} />)
    const buttons = screen.getAllByRole('button', { name: /integrations.common.linkButton/ })
    await user.click(buttons[1])
    await waitFor(() => expect(mockNotifyError).toHaveBeenCalledWith('Geen rechten'))
  })
})

describe('IntegrationsTab · failed state (KOPPELINGEN-META-1 last_error)', () => {
  it('shows the failed chip, the last_error reason and a retry button', () => {
    mockUseAuth.mockReturnValue({ hasModule: (m: string) => m === 'hf' })
    const c = baseCandidate({ helloflexLink: link({ status: 'failed', lastError: 'HelloFlex-credentials ontbreken (Settings → Integraties)' }) })
    render(<IntegrationsTab c={c} />)
    expect(screen.getByText('integrations.common.statusFailed')).toBeInTheDocument()
    expect(screen.getByText('HelloFlex-credentials ontbreken (Settings → Integraties)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /integrations.common.retry/ })).toBeInTheDocument()
  })
})

describe('IntegrationsTab · Shiftmanager linked state (who/when + manual sync)', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ hasModule: (m: string) => m === 'sm' })
  })

  const linkedCandidate = () => baseCandidate({
    shiftmanagerLink: link({
      status: 'linked', externalId: '428', lastSyncedAt: '2026-07-18T09:00:00Z',
      linkedAt: '2026-07-10T08:00:00Z', linkedBy: { id: 7, name: 'Bente de Jong' },
    }),
  })

  it('shows the external id, "Gekoppeld door … op …", the last-synced date and a sync button', () => {
    render(<IntegrationsTab c={linkedCandidate()} />)
    expect(screen.getByText(/428/)).toBeInTheDocument()
    expect(screen.getByText('integrations.common.linkedByOn')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /integrations.shiftmanager.syncNow/ })).toBeInTheDocument()
    expect(screen.getByText('integrations.shiftmanager.lastSynced')).toBeInTheDocument()
    // The generic "Koppelen" button never shows once truly linked.
    expect(screen.queryByRole('button', { name: /integrations.common.linkButton/ })).toBeNull()
  })

  it('calls POST /sm_candidates/sync/{externalId} on click and shows a success toast', async () => {
    mockPost.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<IntegrationsTab c={linkedCandidate()} />)
    await user.click(screen.getByRole('button', { name: /integrations.shiftmanager.syncNow/ }))
    // Assert the REQUEST itself (§13) — route + no accidental body — not just that
    // a callback fired.
    expect(mockPost).toHaveBeenCalledWith('/sm_candidates/sync/428')
    await waitFor(() => expect(mockNotifySuccess).toHaveBeenCalledWith('integrations.shiftmanager.syncSuccess'))
  })

  it('shows an error toast when the sync call fails', async () => {
    mockPost.mockRejectedValue({ response: { data: { message: 'Niet gevonden' } } })
    const user = userEvent.setup()
    render(<IntegrationsTab c={linkedCandidate()} />)
    await user.click(screen.getByRole('button', { name: /integrations.shiftmanager.syncNow/ }))
    await waitFor(() => expect(mockNotifyError).toHaveBeenCalledWith('Niet gevonden'))
  })
})
