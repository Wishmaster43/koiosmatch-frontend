/**
 * EscalationReasonsSettings — thin StatusListEditor wrapper against
 * /escalation-reasons. Asserts the create REQUEST (§13).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import EscalationReasonsSettings from './EscalationReasonsSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

// eslint-disable-next-line no-restricted-syntax -- DATA: fixture row's tenant colour, not a style rule.
const row = (over = {}) => ({ id: 'e1', name: 'Boos', color: '#D98A8A', in_use: false, ...over })

afterEach(() => vi.clearAllMocks())

describe('EscalationReasonsSettings', () => {
  it('loads the list from /escalation-reasons', async () => {
    api.get.mockResolvedValue({ data: [row()] })
    render(<EscalationReasonsSettings />)

    await screen.findByText('Boos')
    expect(api.get).toHaveBeenCalledWith('/escalation-reasons', undefined)
  })

  it('creating a reason POSTs name to /escalation-reasons', async () => {
    api.get.mockResolvedValue({ data: [row()] })
    api.post.mockResolvedValue({ data: row({ id: 'e2', name: 'Ziek' }) })
    const user = userEvent.setup()
    render(<EscalationReasonsSettings />)

    await screen.findByText('Boos')
    await user.click(screen.getByRole('button', { name: st('escalationReasons.add') }))
    await user.type(screen.getByPlaceholderText(st('statusList.namePlaceholder')), 'Ziek')
    await user.click(screen.getByRole('button', { name: st('statusList.addBtn') }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/escalation-reasons', expect.objectContaining({ name: 'Ziek' })))
  })
})
