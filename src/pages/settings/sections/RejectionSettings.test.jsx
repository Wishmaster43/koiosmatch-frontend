/**
 * RejectionSettings — the rejection-reasons lookup now reorders (LOOKUP-REORDER-1: BE
 * ea4d2ebb added sort_order + PUT /candidate-rejection-reasons/reorder). Asserts the
 * drag-reorder REQUEST (§13), mirroring BlacklistReasonsSettings.test.jsx.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import api from '@/lib/api'
import RejectionSettings from './RejectionSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

const row = (over = {}) => ({ id: 'r1', name: 'No response', color: 'var(--text-muted)', in_use: false, ...over })

afterEach(() => vi.clearAllMocks())

describe('RejectionSettings', () => {
  it('drag-reorder is enabled and persists via PUT /candidate-rejection-reasons/reorder', async () => {
    api.get.mockResolvedValue({ data: [row({ id: 'r1', name: 'No response' }), row({ id: 'r2', name: 'Overqualified' })] })
    api.put.mockResolvedValue({ data: {} })
    render(<RejectionSettings />)

    await screen.findByText('Overqualified')
    const rowOf = (text) => screen.getByText(text).closest('div[draggable]')
    fireEvent.dragStart(rowOf('Overqualified'))
    fireEvent.dragOver(rowOf('No response'))
    fireEvent.drop(rowOf('No response'))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/candidate-rejection-reasons/reorder', { ids: ['r2', 'r1'] }))
  })
})
