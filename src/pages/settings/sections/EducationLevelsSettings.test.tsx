/**
 * EducationLevelsSettings — thin StatusListEditor wrapper against
 * /education-levels (KAND-NIVEAU-1). Asserts the create REQUEST (§13).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
// vi.mocked() gives the mocked-module factory's plain vi.fn()s their real Mock typing at every call site.
const mockedApi = vi.mocked(api, true)
import EducationLevelsSettings from './EducationLevelsSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

const st = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

// eslint-disable-next-line no-restricted-syntax -- DATA: fixture row's tenant colour, not a style rule.
const row = (over = {}) => ({ id: 'l1', name: 'HBO', color: '#3B8FD4', in_use: false, ...over })

afterEach(() => vi.clearAllMocks())

describe('EducationLevelsSettings', () => {
  it('loads the list from /education-levels', async () => {
    mockedApi.get.mockResolvedValue({ data: [row()] })
    render(<EducationLevelsSettings />)

    await screen.findByText('HBO')
    expect(mockedApi.get).toHaveBeenCalledWith('/education-levels', undefined)
  })

  it('creating a level POSTs name to /education-levels', async () => {
    mockedApi.get.mockResolvedValue({ data: [row()] })
    mockedApi.post.mockResolvedValue({ data: row({ id: 'l2', name: 'MBO-4' }) })
    const user = userEvent.setup()
    render(<EducationLevelsSettings />)

    await screen.findByText('HBO')
    await user.click(screen.getByRole('button', { name: st('educationLevels.add') }))
    await user.type(screen.getByPlaceholderText(st('statusList.namePlaceholder')), 'MBO-4')
    await user.click(screen.getByRole('button', { name: st('statusList.addBtn') }))

    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledWith('/education-levels', expect.objectContaining({ name: 'MBO-4' })))
  })

  // Unlike the SimpleLookupController family (escalation/nationality reasons), the
  // backend DOES expose PUT /education-levels/reorder — drag-reorder stays on
  // (reorderable defaults to true), so a drop persists via that route.
  it('persists a drag-reorder via PUT /education-levels/reorder', async () => {
    mockedApi.get.mockResolvedValue({ data: [row({ id: 'l1', name: 'HBO' }), row({ id: 'l2', name: 'WO' })] })
    mockedApi.put.mockResolvedValue({ data: { ok: true } })
    const { container } = render(<EducationLevelsSettings />)

    await screen.findByText('WO')
    const rows = container.querySelectorAll('[draggable="true"]')
    expect(rows).toHaveLength(2)

    // Drag row 0 (HBO) onto row 1 (WO) to swap their order.
    fireEvent.dragStart(rows[0])
    fireEvent.dragOver(rows[1])
    fireEvent.drop(rows[1])
    fireEvent.dragEnd(rows[0])

    await waitFor(() => expect(mockedApi.put).toHaveBeenCalledWith('/education-levels/reorder', { ids: ['l2', 'l1'] }))
  })
})
