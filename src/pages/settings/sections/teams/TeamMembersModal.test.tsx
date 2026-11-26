// TeamMembersModal: load on open, PUT the exact body, inline 422 line, close on success.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import TeamMembersModal from './TeamMembersModal'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/queries', () => ({ useUserOptions: () => ({ data: [{ id: 'u1', name: 'Ann Ash' }, { id: 'u2', name: 'Bo Birch' }] }) }))
vi.mock('@/lib/notify', () => ({ notify: vi.fn(), notifyError: vi.fn(), notifySuccess: vi.fn() }))
const mockGet = api.get as unknown as ReturnType<typeof vi.fn>
const mockPut = api.put as unknown as ReturnType<typeof vi.fn>
const st = (k: string) => i18n.t(k, { ns: 'settings' })

beforeEach(() => {
  vi.clearAllMocks()
  mockGet.mockResolvedValue({ data: [{ id: 'm1', user_id: 'u1', name: 'Ann Ash' }] })
})

describe('TeamMembersModal', () => {
  // Open loads the members, a toggle plus Save PUTs exactly { user_ids } and closes.
  it('GETs on open, PUTs the toggled selection and closes', async () => {
    mockPut.mockResolvedValue({ data: [] })
    const onClose = vi.fn()
    render(<TeamMembersModal team={{ id: 't1', name: 'Planning' }} onClose={onClose} />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/teams/t1/members', expect.anything()))
    await userEvent.click(await screen.findByText('Bo Birch'))
    await userEvent.click(screen.getByRole('button', { name: st('teams.save') }))
    await waitFor(() => expect(mockPut).toHaveBeenCalledWith('/teams/t1/members', { user_ids: ['u1', 'u2'] }, { quietStatuses: [422] }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  // A non-bureau user renders the translated line and keeps the popup open.
  it('shows the not-a-bureau-user line on a 422 and does not close', async () => {
    mockPut.mockRejectedValue({ response: { status: 422, data: { ok: false, reason_code: 'team_member_not_a_bureau_user' } } })
    const onClose = vi.fn()
    render(<TeamMembersModal team={{ id: 't1', name: 'Planning' }} onClose={onClose} />)
    await screen.findByText('Ann Ash')
    await userEvent.click(screen.getByRole('button', { name: st('teams.save') }))
    await waitFor(() => expect(mockPut).toHaveBeenCalledWith('/teams/t1/members', { user_ids: ['u1'] }, { quietStatuses: [422] }))
    expect(await screen.findByText(st('teams.notBureauUser'))).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
  })

  // A non-422 failure is toasted by the interceptor: no inline line, popup stays open.
  it('renders no inline line on a 500 and does not close', async () => {
    mockPut.mockRejectedValue({ response: { status: 500, data: {} } })
    const onClose = vi.fn()
    render(<TeamMembersModal team={{ id: 't1', name: 'Planning' }} onClose={onClose} />)
    await screen.findByText('Ann Ash')
    await userEvent.click(screen.getByRole('button', { name: st('teams.save') }))
    await waitFor(() => expect(mockPut).toHaveBeenCalled())
    expect(screen.queryByText(st('teams.saveError'))).toBeNull()
    expect(screen.queryByText(st('teams.notBureauUser'))).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
  })

  // A failed load shows the error; Retry fires a second GET.
  it('retries the load after a failure', async () => {
    mockGet.mockRejectedValueOnce(new Error('boom'))
    render(<TeamMembersModal team={{ id: 't1', name: 'Planning' }} onClose={vi.fn()} />)
    await userEvent.click(await screen.findByRole('button', { name: st('teams.retry') }))
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('Ann Ash')).toBeTruthy()
  })

  // The hint shows with an empty selection and goes once a chip is toggled on.
  it('shows the no-members hint until a chip is toggled on', async () => {
    mockGet.mockResolvedValue({ data: [] })
    render(<TeamMembersModal team={{ id: 't1', name: 'Planning' }} onClose={vi.fn()} />)
    expect(await screen.findByText(st('teams.noMembersHint'))).toBeTruthy()
    await userEvent.click(screen.getByText('Bo Birch'))
    expect(screen.queryByText(st('teams.noMembersHint'))).toBeNull()
  })

  // A member missing from the staff options still renders as a chip and can be removed.
  it('keeps a member outside the options visible and removable', async () => {
    mockGet.mockResolvedValue({ data: [{ id: 'm9', user_id: 'u9', name: 'Gone Gus' }] })
    mockPut.mockResolvedValue({ data: [] })
    render(<TeamMembersModal team={{ id: 't1', name: 'Planning' }} onClose={vi.fn()} />)
    await userEvent.click(await screen.findByText('Gone Gus'))
    await userEvent.click(screen.getByRole('button', { name: st('teams.save') }))
    await waitFor(() => expect(mockPut).toHaveBeenCalledWith('/teams/t1/members', { user_ids: [] }, { quietStatuses: [422] }))
  })
})
