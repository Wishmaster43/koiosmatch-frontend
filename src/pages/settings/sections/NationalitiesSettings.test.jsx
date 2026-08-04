/**
 * NationalitiesSettings — thin StatusListEditor wrapper against /nationalities
 * (LOOKUP-GAP-1). Asserts the create REQUEST (§13): method/route/body, not just
 * that the button click "did something".
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import NationalitiesSettings from './NationalitiesSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

// eslint-disable-next-line no-restricted-syntax -- DATA: fixture row's tenant colour, not a style rule.
const row = (over = {}) => ({ id: 'n1', name: 'Nederlandse', color: '#3B8FD4', in_use: false, ...over })

afterEach(() => vi.clearAllMocks())

describe('NationalitiesSettings', () => {
  it('loads the list from /nationalities', async () => {
    api.get.mockResolvedValue({ data: [row()] })
    render(<NationalitiesSettings />)

    await screen.findByText('Nederlandse')
    expect(api.get).toHaveBeenCalledWith('/nationalities', undefined)
  })

  it('creating a nationality POSTs name to /nationalities', async () => {
    api.get.mockResolvedValue({ data: [row()] })
    api.post.mockResolvedValue({ data: row({ id: 'n2', name: 'Belgische' }) })
    const user = userEvent.setup()
    render(<NationalitiesSettings />)

    await screen.findByText('Nederlandse')
    await user.click(screen.getByRole('button', { name: st('nationalities.add') }))
    await user.type(screen.getByPlaceholderText(st('statusList.namePlaceholder')), 'Belgische')
    await user.click(screen.getByRole('button', { name: st('statusList.addBtn') }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/nationalities', expect.objectContaining({ name: 'Belgische' })))
  })
})
