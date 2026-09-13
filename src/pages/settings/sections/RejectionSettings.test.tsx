/**
 * RejectionSettings — the rejection-reasons lookup now reorders (LOOKUP-REORDER-1: BE
 * ea4d2ebb added sort_order + PUT /candidate-rejection-reasons/reorder). Asserts the
 * drag-reorder REQUEST (§13), mirroring BlacklistReasonsSettings.test.jsx.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import apiClient from '@/lib/api'
import RejectionSettings from './RejectionSettings'

const st = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

// The mocked axios instance, typed as its four mocked methods (established pattern).
const api = apiClient as unknown as { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> }

// A fixture rejection-reason row, overridable per test.
interface RowFixture { id: string; name: string; color: string; in_use: boolean }
const row = (over: Partial<RowFixture> = {}): RowFixture => ({ id: 'r1', name: 'No response', color: 'var(--text-muted)', in_use: false, ...over })

afterEach(() => vi.clearAllMocks())

describe('RejectionSettings', () => {
  it('drag-reorder is enabled and persists via PUT /candidate-rejection-reasons/reorder', async () => {
    api.get.mockResolvedValue({ data: [row({ id: 'r1', name: 'No response' }), row({ id: 'r2', name: 'Overqualified' })] })
    api.put.mockResolvedValue({ data: {} })
    render(<RejectionSettings />)

    await screen.findByText('Overqualified')
    const rowOf = (text: string) => screen.getByText(text).closest('div[draggable]') as HTMLElement
    fireEvent.dragStart(rowOf('Overqualified'))
    fireEvent.dragOver(rowOf('No response'))
    fireEvent.drop(rowOf('No response'))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/candidate-rejection-reasons/reorder', { ids: ['r2', 'r1'] }))
  })

  // LOOKUP-ICONS-FE-2 fix (13-09): CandidateRejectionReasonController has no icon
  // column/validation — the mark stays colour-only.
  it('the value mark stays colour-only', async () => {
    api.get.mockResolvedValue({ data: [row()] })
    api.put.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<RejectionSettings />)

    await screen.findByText('No response')
    const trigger = screen.getByRole('button', { name: st('statusList.colorMark', { label: 'No response' }) })
    await user.click(trigger)
    expect(screen.getByRole('dialog', { name: st('statusList.colorMark', { label: 'No response' }) })).toBeInTheDocument()
  })
})
