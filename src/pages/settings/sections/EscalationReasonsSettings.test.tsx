/**
 * EscalationReasonsSettings — thin StatusListEditor wrapper against
 * /escalation-reasons. Asserts the create REQUEST (§13).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
// vi.mocked() gives the mocked-module factory's plain vi.fn()s their real Mock typing at every call site.
const mockedApi = vi.mocked(api, true)
import EscalationReasonsSettings from './EscalationReasonsSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

const st = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

// eslint-disable-next-line no-restricted-syntax -- DATA: fixture row's tenant colour, not a style rule.
const row = (over = {}) => ({ id: 'e1', name: 'Boos', color: '#D98A8A', in_use: false, ...over })

afterEach(() => vi.clearAllMocks())

describe('EscalationReasonsSettings', () => {
  it('loads the list from /escalation-reasons', async () => {
    mockedApi.get.mockResolvedValue({ data: [row()] })
    render(<EscalationReasonsSettings />)

    await screen.findByText('Boos')
    expect(mockedApi.get).toHaveBeenCalledWith('/escalation-reasons', undefined)
  })

  it('creating a reason POSTs name to /escalation-reasons', async () => {
    mockedApi.get.mockResolvedValue({ data: [row()] })
    mockedApi.post.mockResolvedValue({ data: row({ id: 'e2', name: 'Ziek' }) })
    const user = userEvent.setup()
    render(<EscalationReasonsSettings />)

    await screen.findByText('Boos')
    await user.click(screen.getByRole('button', { name: st('escalationReasons.add') }))
    await user.type(screen.getByPlaceholderText(st('statusList.namePlaceholder')), 'Ziek')
    await user.click(screen.getByRole('button', { name: st('statusList.addBtn') }))

    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledWith('/escalation-reasons', expect.objectContaining({ name: 'Ziek' })))
  })

  // REASON-REORDER-1 (backend landed 04-08): EscalationReasonController gained
  // PUT /escalation-reasons/reorder that day — the editor no longer opts out of
  // it (LOOKUP-GAP-1(d) verification 08-08 caught the stale reorderable={false}).
  it('drag-reorder is enabled and persists via PUT /escalation-reasons/reorder', async () => {
    mockedApi.get.mockResolvedValue({ data: [row({ id: 'e1', name: 'Boos' }), row({ id: 'e2', name: 'Ziek' })] })
    mockedApi.put.mockResolvedValue({ data: {} })
    render(<EscalationReasonsSettings />)

    await screen.findByText('Ziek')
    const rowOf = (text: string) => screen.getByText(text).closest('div[draggable]')
    fireEvent.dragStart(rowOf('Ziek')!)
    fireEvent.dragOver(rowOf('Boos')!)
    fireEvent.drop(rowOf('Boos')!)

    await waitFor(() => expect(mockedApi.put).toHaveBeenCalledWith('/escalation-reasons/reorder', { ids: ['e2', 'e1'] }))
  })

  // LOOKUP-ICONS-FE-2 fix (13-09): EscalationReasonController has no icon
  // column/validation — the mark stays colour-only ('dialog', not 'menu').
  it('the value mark stays colour-only', async () => {
    mockedApi.get.mockResolvedValue({ data: [row()] })
    mockedApi.put.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<EscalationReasonsSettings />)

    await screen.findByText('Boos')
    const trigger = screen.getByRole('button', { name: st('statusList.colorMark', { label: 'Boos' }) })
    await user.click(trigger)
    expect(screen.getByRole('dialog', { name: st('statusList.colorMark', { label: 'Boos' }) })).toBeInTheDocument()
  })
})
