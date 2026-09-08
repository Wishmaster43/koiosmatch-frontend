import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useBulkDocumentDelete } from './useBulkDocumentDelete'
import type { EntityDoc } from '@/hooks/useEntityDocuments'

describe('useBulkDocumentDelete', () => {
  const mockDoc: EntityDoc = { id: '1', name: 'test.pdf', file_name: 'test.pdf', type: 'cv' } as EntityDoc

  it('initializes with null confirmDelete', () => {
    const { result } = renderHook(() => useBulkDocumentDelete(vi.fn(), vi.fn()))
    expect(result.current.confirmDelete).toBeNull()
  })

  it('sets confirmDelete for single delete', () => {
    const { result } = renderHook(() => useBulkDocumentDelete(vi.fn(), vi.fn()))
    act(() => {
      result.current.setConfirmDelete({ kind: 'one', doc: mockDoc, index: 0 })
    })
    expect(result.current.confirmDelete?.kind).toBe('one')
    expect(result.current.confirmDeleteName).toBe('test.pdf')
  })

  it('sets confirmDelete for bulk delete', () => {
    const { result } = renderHook(() => useBulkDocumentDelete(vi.fn(), vi.fn()))
    act(() => {
      result.current.setConfirmDelete({ kind: 'many' })
    })
    expect(result.current.confirmDelete?.kind).toBe('many')
    expect(result.current.confirmDeleteName).toBe('')
  })

  it('calls onConfirmOne with doc and index', () => {
    const onConfirmOne = vi.fn()
    const { result } = renderHook(() => useBulkDocumentDelete(onConfirmOne, vi.fn()))
    act(() => {
      result.current.setConfirmDelete({ kind: 'one', doc: mockDoc, index: 5 })
    })
    act(() => {
      result.current.confirmDeleteAction()
    })
    expect(onConfirmOne).toHaveBeenCalledWith(mockDoc, 5)
    expect(result.current.confirmDelete).toBeNull()
  })

  it('calls onConfirmMany on bulk delete', () => {
    const onConfirmMany = vi.fn()
    const { result } = renderHook(() => useBulkDocumentDelete(vi.fn(), onConfirmMany))
    act(() => {
      result.current.setConfirmDelete({ kind: 'many' })
    })
    act(() => {
      result.current.confirmDeleteAction()
    })
    expect(onConfirmMany).toHaveBeenCalled()
    expect(result.current.confirmDelete).toBeNull()
  })

  it('cancels delete by setting confirmDelete to null', () => {
    const { result } = renderHook(() => useBulkDocumentDelete(vi.fn(), vi.fn()))
    act(() => {
      result.current.setConfirmDelete({ kind: 'one', doc: mockDoc, index: 0 })
    })
    expect(result.current.confirmDelete?.kind).toBe('one')
    act(() => {
      result.current.setConfirmDelete(null)
    })
    expect(result.current.confirmDelete).toBeNull()
  })
})
