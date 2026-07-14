/**
 * SmSyncButton (SYNC-1) — component-level states. ShiftManager is gated off for the
 * demo tenant in this environment (module not enabled — see the SYNC-1 report), so the
 * sync flow is verified here at the component level (RTL) rather than via a live
 * Playwright probe: permission gating, single-vs-multi connection, and the
 * queued/throttled/error feedback states.
 */
import '@/i18n'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SmSyncButton from './SmSyncButton'

const mockUseAuth        = vi.fn()
const mockUseSmConnections = vi.fn()
const mockUseSmSync      = vi.fn()
const mockSync           = vi.fn()

vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))
vi.mock('./useSmConnections', () => ({ useSmConnections: () => mockUseSmConnections() }))
vi.mock('./useSmSync', () => ({ useSmSync: () => mockUseSmSync() }))

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue({ hasPermission: () => true })
  mockUseSmConnections.mockReturnValue({ connections: [{ value: 'c1', label: 'demo — shiftmanager (host)' }], loading: false })
  mockUseSmSync.mockReturnValue({ syncing: false, result: null, sync: mockSync })
})

describe('SmSyncButton', () => {
  it('disables the button (never hides it) when the user lacks sync.refresh', () => {
    mockUseAuth.mockReturnValue({ hasPermission: () => false })
    render(<SmSyncButton />)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('disables the button when there is no active ShiftManager connection', () => {
    mockUseSmConnections.mockReturnValue({ connections: [], loading: false })
    render(<SmSyncButton />)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('syncs the single connection directly on click — no picker shown', () => {
    render(<SmSyncButton />)
    fireEvent.click(screen.getByRole('button'))
    expect(mockSync).toHaveBeenCalledWith('c1')
  })

  it('opens a picker instead of firing directly when several connections exist', () => {
    mockUseSmConnections.mockReturnValue({
      connections: [
        { value: 'c1', label: 'demo — shiftmanager (host-1)' },
        { value: 'c2', label: 'demo — shiftmanager (host-2)' },
      ],
      loading: false,
    })
    render(<SmSyncButton />)
    fireEvent.click(screen.getByRole('button'))
    expect(mockSync).not.toHaveBeenCalled()
    expect(screen.getByText(/Kies ShiftManager-account/i)).toBeInTheDocument()
  })

  it('shows the queued feedback after a successful sync', () => {
    mockUseSmSync.mockReturnValue({ syncing: false, result: { kind: 'queued' }, sync: mockSync })
    render(<SmSyncButton />)
    expect(screen.getByText(/Synchronisatie gestart/i)).toBeInTheDocument()
  })

  it('shows the throttle feedback with the retry delay', () => {
    mockUseSmSync.mockReturnValue({ syncing: false, result: { kind: 'throttled', retryAfter: 42 }, sync: mockSync })
    render(<SmSyncButton />)
    expect(screen.getByText(/42/)).toBeInTheDocument()
  })

  it('shows the error feedback', () => {
    mockUseSmSync.mockReturnValue({ syncing: false, result: { kind: 'error' }, sync: mockSync })
    render(<SmSyncButton />)
    expect(screen.getByText(/mislukt/i)).toBeInTheDocument()
  })
})
