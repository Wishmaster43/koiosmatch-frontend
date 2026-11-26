// TeamsSettings: editor rows from GET /teams, members button gated on settings.update.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import TeamsSettings from './TeamsSettings'

const perm = vi.hoisted(() => ({ allowed: true }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: () => perm.allowed }) }))
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/queries', () => ({ useUserOptions: () => ({ data: [] }) }))
vi.mock('@/lib/notify', () => ({ notify: vi.fn(), notifyError: vi.fn(), notifySuccess: vi.fn() }))
const mockGet = api.get as unknown as ReturnType<typeof vi.fn>
const st = (k: string) => i18n.t(k, { ns: 'settings' })

beforeEach(() => {
  vi.clearAllMocks()
  perm.allowed = true
  mockGet.mockImplementation((url: string) => Promise.resolve({
    data: url === '/teams' ? [{ id: 't1', name: 'Planning', color: 'var(--color-primary)', in_use: false }] : [],
  }))
})

describe('TeamsSettings', () => {
  // The members button opens the modal, which loads that team's members.
  it('opens the members modal from a row', async () => {
    render(<TeamsSettings />)
    await screen.findByText('Planning')
    await userEvent.click(screen.getByRole('button', { name: new RegExp(st('teams.members')) }))
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/teams/t1/members', expect.anything()))
  })

  // Without settings.update there is no members button.
  it('hides the members button without settings.update', async () => {
    perm.allowed = false
    render(<TeamsSettings />)
    await screen.findByText('Planning')
    expect(screen.queryByRole('button', { name: new RegExp(st('teams.members')) })).toBeNull()
  })
})
