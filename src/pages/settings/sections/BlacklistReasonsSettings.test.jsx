/**
 * BlacklistReasonsSettings — ONE entity per registration ("klant bij klant,
 * kandidaat bij kandidaat", Danny 2026-08-05): the entity prop picks the endpoint.
 * Asserts each entity hits its OWN route (the key regression risk of one component
 * serving two endpoints) and the create REQUEST (§13).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
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
  it('the candidate registration (default) GETs /candidate-blacklist-reasons', async () => {
    api.get.mockResolvedValue({ data: [row()] })
    render(<BlacklistReasonsSettings />)

    await screen.findByText('No-show')
    expect(api.get).toHaveBeenCalledWith('/candidate-blacklist-reasons', undefined)
  })

  it('the customer registration GETs /customer-blacklist-reasons', async () => {
    api.get.mockResolvedValue({ data: [row()] })
    render(<BlacklistReasonsSettings entity="customer" />)

    await screen.findByText('No-show')
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

  // Both blacklist controllers gained sort_order + PUT /{endpoint}/reorder on
  // 2026-08-04 (BE b649f8f0) — this guards the removal of the stale
  // reorderable={false} opt-out (LOOKUP-GAP-1(d) verification 08-08).
  it('drag-reorder is enabled and persists via PUT /candidate-blacklist-reasons/reorder', async () => {
    api.get.mockResolvedValue({ data: [row({ id: 'b1', name: 'No-show' }), row({ id: 'b2', name: 'Agressie' })] })
    api.put.mockResolvedValue({ data: {} })
    render(<BlacklistReasonsSettings />)

    await screen.findByText('Agressie')
    const rowOf = (text) => screen.getByText(text).closest('div[draggable]')
    fireEvent.dragStart(rowOf('Agressie'))
    fireEvent.dragOver(rowOf('No-show'))
    fireEvent.drop(rowOf('No-show'))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/candidate-blacklist-reasons/reorder', { ids: ['b2', 'b1'] }))
  })
})
