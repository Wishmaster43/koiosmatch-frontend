/**
 * EscalationReasonsSettings — thin StatusListEditor wrapper against
 * /escalation-reasons. Asserts the create REQUEST (§13).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
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

  // REASON-REORDER-1 (backend landed 04-08): EscalationReasonController gained
  // PUT /escalation-reasons/reorder that day — the editor no longer opts out of
  // it (LOOKUP-GAP-1(d) verification 08-08 caught the stale reorderable={false}).
  it('drag-reorder is enabled and persists via PUT /escalation-reasons/reorder', async () => {
    api.get.mockResolvedValue({ data: [row({ id: 'e1', name: 'Boos' }), row({ id: 'e2', name: 'Ziek' })] })
    api.put.mockResolvedValue({ data: {} })
    render(<EscalationReasonsSettings />)

    await screen.findByText('Ziek')
    const rowOf = (text) => screen.getByText(text).closest('div[draggable]')
    fireEvent.dragStart(rowOf('Ziek'))
    fireEvent.dragOver(rowOf('Boos'))
    fireEvent.drop(rowOf('Boos'))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/escalation-reasons/reorder', { ids: ['e2', 'e1'] }))
  })
})
