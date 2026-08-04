/**
 * BlacklistReasonsSettings — two sub-tabs (candidate/customer), each a StatusListEditor
 * against its own endpoint. Asserts each tab hits its OWN route (the key regression
 * risk of one component sharing two endpoints) and the create REQUEST (§13).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import BlacklistReasonsSettings from './BlacklistReasonsSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

// eslint-disable-next-line no-restricted-syntax -- DATA: fixture row's tenant colour, not a style rule.
const row = (over = {}) => ({ id: 'b1', name: 'No-show', color: '#D98A8A', in_use: false, ...over })

afterEach(() => vi.clearAllMocks())

describe('BlacklistReasonsSettings', () => {
  it('defaults to the candidate tab, GETting /candidate-blacklist-reasons', async () => {
    api.get.mockResolvedValue({ data: [row()] })
    render(<BlacklistReasonsSettings />)

    await screen.findByText('No-show')
    expect(api.get).toHaveBeenCalledWith('/candidate-blacklist-reasons', undefined)
  })

  it('switching to the customer tab GETs /customer-blacklist-reasons', async () => {
    api.get.mockResolvedValue({ data: [row()] })
    const user = userEvent.setup()
    render(<BlacklistReasonsSettings />)

    await screen.findByText('No-show')
    await user.click(screen.getByRole('tab', { name: st('blacklistReasons.tabs.customer') }))

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/customer-blacklist-reasons', undefined))
  })

  it('creating a candidate blacklist reason POSTs to /candidate-blacklist-reasons', async () => {
    api.get.mockResolvedValue({ data: [row()] })
    api.post.mockResolvedValue({ data: row({ id: 'b2', name: 'Agressie' }) })
    const user = userEvent.setup()
    render(<BlacklistReasonsSettings />)

    await screen.findByText('No-show')
    await user.click(screen.getByRole('button', { name: st('blacklistReasons.add') }))
    await user.type(screen.getByPlaceholderText(st('statusList.namePlaceholder')), 'Agressie')
    await user.click(screen.getByRole('button', { name: st('statusList.addBtn') }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/candidate-blacklist-reasons', expect.objectContaining({ name: 'Agressie' })))
  })
})
