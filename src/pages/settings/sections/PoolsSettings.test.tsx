/**
 * PoolsSettings — SMZ-06 regression: the editor no longer offers a `context`
 * picker, because GET /pools (no query params, exactly what StatusListEditor
 * sends) defaults the backend to context=recruitment — a pool created here as
 * "planning" would be permanently unreachable from this screen (SMZ-06).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import apiClient from '@/lib/api'
import PoolsSettings from './PoolsSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

// The mocked axios instance, typed as its four mocked methods (established pattern).
const api = apiClient as unknown as { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> }

const st = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

// A fixture pool row, overridable per test.
interface PoolFixture { id: string; name: string; color: string; icon: string; in_use: boolean }
const pool = (over: Partial<PoolFixture> = {}): PoolFixture => ({ id: 'p1', name: 'Zorg pool', color: 'var(--color-primary)', icon: '', in_use: false, ...over })

afterEach(() => vi.clearAllMocks())

describe('PoolsSettings', () => {
  it('loads the list from /pools with no query params (the vocabulary GET reads)', async () => {
    api.get.mockResolvedValue({ data: [pool()] })
    render(<PoolsSettings />)

    await screen.findByText('Zorg pool')
    expect(api.get).toHaveBeenCalledWith('/pools', undefined)
  })

  // SMZ-06: no context picker is offered — the field never renders, so a pool
  // created here can only ever be a recruitment pool, matching what /pools
  // (no params) reads back.
  it('never renders a context picker', async () => {
    api.get.mockResolvedValue({ data: [pool()] })
    render(<PoolsSettings />)

    await screen.findByText('Zorg pool')
    expect(screen.queryByText(st('poolsSettings.contextLabel'))).not.toBeInTheDocument()
  })

  it('creating a pool POSTs name/color to /pools without a context field', async () => {
    api.get.mockResolvedValue({ data: [pool()] })
    api.post.mockResolvedValue({ data: pool({ id: 'p2', name: 'Techniek pool' }) })
    const user = userEvent.setup()
    render(<PoolsSettings />)

    await screen.findByText('Zorg pool')
    await user.click(screen.getByRole('button', { name: st('poolsSettings.add') }))
    await user.type(screen.getByPlaceholderText(st('statusList.namePlaceholder')), 'Techniek pool')
    await user.click(screen.getByRole('button', { name: st('statusList.addBtn') }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/pools',
      expect.objectContaining({ name: 'Techniek pool' })))
    const [, body] = api.post.mock.calls[0]
    expect(body).not.toHaveProperty('context')
  })
})
