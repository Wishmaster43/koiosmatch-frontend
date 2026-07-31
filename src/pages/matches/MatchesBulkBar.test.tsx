/**
 * MatchesBulkBar — a match is read-only (§3B), so the only bulk operation is
 * coupling the selection to an external backoffice. SYNC-BULK-1: permission
 * (matches.update — the SAME permission MatchDrawer's canLinkBackoffice checks,
 * never the non-existent `matches.couple` this bar used to be gated on) and
 * tenant app availability (hf/shiftmanager) are both resolved INSIDE this
 * component now, mirroring BackofficeLinksTab's own canLink/useApps checks.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MatchesBulkBar from './MatchesBulkBar'

const mockUseAuth = vi.fn()
const mockUseApps = vi.fn()
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))
vi.mock('@/context/AppsContext', () => ({ useApps: () => mockUseApps() }))

const baseProps = () => ({
  count: 2, onClear: vi.fn(), onCoupleHelloFlex: vi.fn(), onCoupleShiftmanager: vi.fn(),
})

describe('MatchesBulkBar · SYNC-BULK-1 permission + module gating', () => {
  it('shows "no permission" (never the menu) without matches.update, even with both systems enabled', async () => {
    mockUseAuth.mockReturnValue({ hasPermission: () => false })
    mockUseApps.mockReturnValue({ isAppEnabled: () => true })
    render(<MatchesBulkBar {...baseProps()} />)
    expect(screen.getByText('bulk.noPermission')).toBeInTheDocument()
    expect(screen.queryByText('bulk.actions')).toBeNull()
  })

  it('shows "not available" (not the permission message) when permitted but neither system is enabled', async () => {
    mockUseAuth.mockReturnValue({ hasPermission: () => true })
    mockUseApps.mockReturnValue({ isAppEnabled: () => false })
    render(<MatchesBulkBar {...baseProps()} />)
    expect(screen.getByText('bulk.coupleUnavailable')).toBeInTheDocument()
    expect(screen.queryByText('bulk.noPermission')).toBeNull()
  })

  it('offers only the enabled system and fires the matching callback', async () => {
    mockUseAuth.mockReturnValue({ hasPermission: () => true })
    mockUseApps.mockReturnValue({ isAppEnabled: (id: string) => id === 'shiftmanager' })
    const user = userEvent.setup()
    const props = baseProps()
    render(<MatchesBulkBar {...props} />)
    await user.click(screen.getByText('bulk.actions'))
    await user.click(screen.getByText('bulk.couple'))
    expect(screen.queryByText('bulk.target.helloflex')).toBeNull()
    await user.click(screen.getByText('bulk.target.shiftmanager'))
    expect(props.onCoupleShiftmanager).toHaveBeenCalledTimes(1)
    expect(props.onCoupleHelloFlex).not.toHaveBeenCalled()
  })

  it('offers both systems and fires HelloFlex when both are enabled', async () => {
    mockUseAuth.mockReturnValue({ hasPermission: () => true })
    mockUseApps.mockReturnValue({ isAppEnabled: () => true })
    const user = userEvent.setup()
    const props = baseProps()
    render(<MatchesBulkBar {...props} />)
    await user.click(screen.getByText('bulk.actions'))
    await user.click(screen.getByText('bulk.couple'))
    await user.click(screen.getByText('bulk.target.helloflex'))
    expect(props.onCoupleHelloFlex).toHaveBeenCalledTimes(1)
  })
})
