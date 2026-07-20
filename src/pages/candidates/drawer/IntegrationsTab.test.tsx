/**
 * IntegrationsTab — module/app visibility gating (PDOK always, HelloFlex/Shiftmanager
 * OR-gated), the honest "not available"/"not linked" fallback states, and the
 * Shiftmanager "Nu synchroniseren" mutation (§13: asserts the real POST route, not
 * just that a callback fired).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import IntegrationsTab from './IntegrationsTab'
import type { Candidate } from '@/types/candidate'

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

// Base candidate — no module/app enabled, no coordinates, no Shiftmanager link.
const baseCandidate = (overrides: Partial<Candidate> = {}): Candidate =>
  ({ id: 1, lat: null, lng: null, ...overrides } as unknown as Candidate)

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

  it('shows via the module flag alone', () => {
    mockUseAuth.mockReturnValue({ hasModule: (m: string) => m === 'hf' })
    render(<IntegrationsTab c={baseCandidate()} />)
    expect(screen.getByAltText('integrations.helloflex.alt')).toBeInTheDocument()
    // No real endpoint yet — an honest disabled notice, never a dead button.
    expect(screen.getByText('integrations.helloflex.notAvailable')).toBeInTheDocument()
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

describe('IntegrationsTab · Shiftmanager linked state + manual sync', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ hasModule: (m: string) => m === 'sm' })
  })

  // No FE datapath yet (mapCandidate.ts doesn't forward backoffice_links) — a
  // candidate without the (future) shiftmanagerLink field reads as "not linked".
  it('shows the calm "not linked" notice when no Shiftmanager link is present', () => {
    render(<IntegrationsTab c={baseCandidate()} />)
    expect(screen.getByText('integrations.shiftmanager.notLinked')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  // Simulates the future mapped shape (same field names the gap note documents)
  // so the linked branch + sync button are exercised end to end.
  const linkedCandidate = () => baseCandidate({
    shiftmanagerLink: { status: 'linked', externalId: '428', lastSyncedAt: '2026-07-18T09:00:00Z' },
  } as unknown as Partial<Candidate>)

  it('shows the external id and a "Nu synchroniseren" button when linked', () => {
    render(<IntegrationsTab c={linkedCandidate()} />)
    expect(screen.getByText(/428/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /integrations.shiftmanager.syncNow/ })).toBeInTheDocument()
    expect(screen.getByText('integrations.shiftmanager.lastSynced')).toBeInTheDocument()
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
