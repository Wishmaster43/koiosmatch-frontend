/**
 * JargonSettings — thin StatusListEditor wrapper against /jargon-terms (K-155,
 * JARGON-SCHERM-1). Mirrors IndustrySettings/NationalitiesSettings: asserts the
 * REQUEST (§13), not just that a click "did something", and covers the four UI
 * states (loading/error/empty/success).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import JargonSettings from './JargonSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })
const ct = (key) => i18n.t(key, { ns: 'common' })

// Real /jargon-terms index shape: id/name/position only (active rows are
// pre-filtered server-side and the flag never rides in the payload).
const row = (over = {}) => ({ id: 't1', name: 'bfv', position: 1, ...over })

afterEach(() => vi.clearAllMocks())

describe('JargonSettings', () => {
  it('loads the list from /jargon-terms', async () => {
    api.get.mockResolvedValue({ data: [row()] })
    render(<JargonSettings />)

    await screen.findByText('bfv')
    expect(api.get).toHaveBeenCalledWith('/jargon-terms', undefined)
  })

  it('shows the calm loading state before the list resolves', () => {
    api.get.mockReturnValue(new Promise(() => {})) // never resolves
    render(<JargonSettings />)
    expect(screen.getByText(st('common.loadingShort'))).toBeInTheDocument()
  })

  it('shows the error notice on a load failure', async () => {
    api.get.mockRejectedValue({ response: { status: 500 } })
    render(<JargonSettings />)
    await screen.findByText(st('statusList.loadError'))
  })

  it('renders empty with the add affordance when the tenant has no terms yet', async () => {
    api.get.mockResolvedValue({ data: [] })
    render(<JargonSettings />)
    await waitFor(() => expect(api.get).toHaveBeenCalled())
    expect(screen.getByRole('button', { name: st('jargonSettings.add') })).toBeInTheDocument()
  })

  it('creating a term POSTs name to /jargon-terms', async () => {
    api.get.mockResolvedValue({ data: [row()] })
    api.post.mockResolvedValue({ data: row({ id: 't2', name: 'BHV' }) })
    const user = userEvent.setup()
    render(<JargonSettings />)

    await screen.findByText('bfv')
    await user.click(screen.getByRole('button', { name: st('jargonSettings.add') }))
    await user.type(screen.getByPlaceholderText(st('statusList.namePlaceholder')), 'BHV')
    await user.click(screen.getByRole('button', { name: st('statusList.addBtn') }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/jargon-terms', expect.objectContaining({ name: 'BHV' })))
  })

  it('deleting a term DELETEs /jargon-terms/{id} with no in-use guard', async () => {
    api.get.mockResolvedValue({ data: [row()] })
    api.delete.mockResolvedValue({})
    const user = userEvent.setup()
    render(<JargonSettings />)

    await screen.findByText('bfv')
    await user.click(screen.getByRole('button', { name: ct('delete') }))
    await user.click(screen.getByRole('button', { name: ct('confirm') }))

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/jargon-terms/t1'))
  })

  it('drag-reorder persists via PUT /jargon-terms/reorder', async () => {
    api.get.mockResolvedValue({ data: [row({ id: 't1', name: 'bfv' }), row({ id: 't2', name: 'BHV', position: 2 })] })
    api.put.mockResolvedValue({ data: {} })
    render(<JargonSettings />)

    await screen.findByText('BHV')
    const rowOf = (text) => screen.getByText(text).closest('div[draggable]')
    fireEvent.dragStart(rowOf('BHV'))
    fireEvent.dragOver(rowOf('bfv'))
    fireEvent.drop(rowOf('bfv'))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/jargon-terms/reorder', { ids: ['t2', 't1'] }))
  })
})
