import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { handleSubEntityDelete } from './subEntityDelete'
import type { DeleteResult } from './subEntityDelete'
import type { Id } from '@/types/common'

describe('handleSubEntityDelete', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('closes on successful delete', async () => {
    const onDelete = vi.fn(async () => ({ ok: true }) as DeleteResult)
    const close = vi.fn()
    const setBlockedCounts = vi.fn()
    const entityId = 'entity-1' as Id

    handleSubEntityDelete(onDelete, entityId, close, setBlockedCounts)
    await vi.runAllTimersAsync()

    expect(onDelete).toHaveBeenCalledWith(entityId)
    expect(close).toHaveBeenCalled()
    expect(setBlockedCounts).not.toHaveBeenCalled()
  })

  it('sets blocked counts on 409 race', async () => {
    const counts = { vacancies: 2, applications: 1 }
    const onDelete = vi.fn(async () => ({
      ok: false,
      blocked: { counts },
    }) as DeleteResult)
    const close = vi.fn()
    const setBlockedCounts = vi.fn()
    const entityId = 'entity-2' as Id

    handleSubEntityDelete(onDelete, entityId, close, setBlockedCounts)
    await vi.runAllTimersAsync()

    expect(onDelete).toHaveBeenCalledWith(entityId)
    expect(close).not.toHaveBeenCalled()
    expect(setBlockedCounts).toHaveBeenCalledWith(counts)
  })

  it('handles legacy void return', async () => {
    const onDelete = vi.fn(() => undefined)
    const close = vi.fn()
    const setBlockedCounts = vi.fn()
    const entityId = 'entity-3' as Id

    handleSubEntityDelete(onDelete, entityId, close, setBlockedCounts)
    await vi.runAllTimersAsync()

    expect(close).toHaveBeenCalled()
    expect(setBlockedCounts).not.toHaveBeenCalled()
  })
})
