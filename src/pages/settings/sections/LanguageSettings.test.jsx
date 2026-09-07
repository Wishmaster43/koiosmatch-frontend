/**
 * LanguageSettings — covers the language-levels reorder (B-39): when a level is
 * drag-reordered in the levels list, it should PUT /language-levels/reorder with
 * {ids:[...]} containing the reordered id set. The shared StatusListEditor drives
 * the reorder; this test verifies the endpoint and body shape are correct.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import api from '@/lib/api'
import { LanguageLevelSettings } from './LanguageSettings'

// Keep the real unwrap/unwrapList (importActual) — only the default client is stubbed.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))


afterEach(() => vi.clearAllMocks())

describe('LanguageSettings — language-levels reorder (B-39)', () => {
  it('PUTs /language-levels/reorder with {ids:[...]} when a level is reordered', async () => {
    const levels = [
      { id: 'level-1', name: 'Beginner', sort_order: 0 },
      { id: 'level-2', name: 'Intermediate', sort_order: 1 },
      { id: 'level-3', name: 'Advanced', sort_order: 2 },
    ]
    // Mock both the GET for languages and the GET for levels
    api.get.mockImplementation((path) => {
      if (path === '/languages') {
        return Promise.resolve({ data: { data: [] } })
      }
      if (path === '/language-levels') {
        return Promise.resolve({ data: { data: levels } })
      }
      return Promise.reject(new Error(`Unexpected path: ${path}`))
    })
    api.put.mockResolvedValue({ data: { reordered: 3 } })

    const { container } = render(<LanguageLevelSettings />)

    // Wait for levels to load
    await waitFor(() => expect(screen.getByText('Beginner')).toBeInTheDocument())

    // Drag Beginner (first row) to position after Advanced (to reverse the order)
    // The shared DragList uses HTML5 drag events
    const rows = container.querySelectorAll('[draggable="true"]')
    expect(rows).toHaveLength(3)

    // Drag first row (Beginner) to position 3 (after Advanced)
    fireEvent.dragStart(rows[0])
    fireEvent.dragOver(rows[2])
    fireEvent.drop(rows[2])
    fireEvent.dragEnd(rows[0])

    // Assert the PUT body contains the reordered ids
    await waitFor(() => expect(api.put).toHaveBeenCalledWith(
      '/language-levels/reorder',
      { ids: ['level-2', 'level-3', 'level-1'] }
    ))
  })
})
