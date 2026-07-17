/**
 * EditUserModal — regression tests for the branch-coupling section
 * (USERS-ROLES-LOC-1): current branches render through the shared
 * ChipMultiSelect, toggling PUTs a replace-set, and a failed PUT reverts +
 * surfaces notifyError — mirrors RoleBranchTemplate in RolesSettings.jsx.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EditUserModal from './EditUserModal'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
import type { ManagedUser } from '@/types/api'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn() }))
vi.mock('@/lib/useLocations', () => ({
  useLocations: () => ([{ value: 'loc-1', label: 'Amsterdam' }, { value: 'loc-2', label: 'Rotterdam' }]),
}))
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), put: vi.fn(), patch: vi.fn() },
  unwrap: (r: { data?: { data?: unknown } }) => r?.data?.data,
  unwrapList: (r: { data?: { data?: unknown[] } }) => ({ rows: r?.data?.data ?? [] }),
}))

const testUser: ManagedUser = { id: 'u1', firstname: 'Jan', lastname: 'Jansen', email: 'jan@bedrijf.nl' }
const noop = () => {}

describe('EditUserModal · branches', () => {
  it('shows the honest empty hint when the user has no branches yet', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [] } })
    render(<EditUserModal user={testUser} onClose={noop} onSaved={noop} />)
    expect(await screen.findByText('branches.emptyHint')).toBeInTheDocument()
  })

  it('toggling a branch chip PUTs the full replace-set', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [] } })
    vi.mocked(api.put).mockResolvedValueOnce({ data: { data: [{ location_id: 'loc-1', name: 'Amsterdam' }] } })
    const user = userEvent.setup()
    render(<EditUserModal user={testUser} onClose={noop} onSaved={noop} />)

    await screen.findByText('Amsterdam')
    await user.click(screen.getByText('Amsterdam'))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/users/u1/branches', { location_ids: ['loc-1'] }))
  })

  it('reverts and notifies on a failed toggle', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [] } })
    vi.mocked(api.put).mockRejectedValueOnce(new Error('network'))
    const user = userEvent.setup()
    render(<EditUserModal user={testUser} onClose={noop} onSaved={noop} />)

    await screen.findByText('Amsterdam')
    await user.click(screen.getByText('Amsterdam'))

    await waitFor(() => expect(notifyError).toHaveBeenCalledWith('branches.saveFailed'))
    // Reverted to zero branches — the honest empty hint is back.
    expect(await screen.findByText('branches.emptyHint')).toBeInTheDocument()
  })
})
