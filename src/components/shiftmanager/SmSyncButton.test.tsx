/**
 * SmSyncButton (SYNC-1) — component-level states. Shiftmanager is gated off for the
 * demo tenant in this environment (module not enabled — see the SYNC-1 report), so the
 * sync flow is verified here at the component level (RTL) rather than via a live
 * Playwright probe: permission gating, single-vs-multi connection, and the
 * queued/throttled/error feedback states.
 */
import '@/i18n'
import nlShiftmanager from '@/i18n/locales/nl/shiftmanager.json'
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
  mockUseAuth.mockReturnValue({ isSuperAdmin: () => true })
  mockUseSmConnections.mockReturnValue({ connections: [{ value: 'c1', label: 'demo — shiftmanager (host)' }], loading: false })
  mockUseSmSync.mockReturnValue({ syncing: false, awaitingSnapshot: false, result: null, sync: mockSync })
})

describe('SmSyncButton', () => {
  it('disables the button (never hides it) when the user is not a superadmin', () => {
    mockUseAuth.mockReturnValue({ isSuperAdmin: () => false })
    render(<SmSyncButton />)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('disables the button when there is no active Shiftmanager connection', () => {
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
    expect(screen.getByText(/Kies Shiftmanager-account/i)).toBeInTheDocument()
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
    mockUseSmSync.mockReturnValue({ syncing: false, awaitingSnapshot: false, result: { kind: 'error' }, sync: mockSync })
    render(<SmSyncButton />)
    // The real nl copy of the failure label, read from the locale file (never a Dutch literal in a test).
    expect(screen.getByText(nlShiftmanager.charts.sync.failed)).toBeInTheDocument()
  })

  // N007-POINT3-FIX-1: the button stays disabled with a "done" label while the
  // queued sync is still awaiting its landed snapshot — a repeat click must not
  // call sync() again.
  it('stays disabled with the "sync started" label while awaiting the snapshot, and a repeat click does not re-fire sync', () => {
    mockUseSmSync.mockReturnValue({ syncing: false, awaitingSnapshot: true, result: { kind: 'queued' }, sync: mockSync })
    render(<SmSyncButton />)
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    expect(screen.getByText(/Sync gestart/i)).toBeInTheDocument()
    fireEvent.click(button)
    expect(mockSync).not.toHaveBeenCalled()
  })
})
