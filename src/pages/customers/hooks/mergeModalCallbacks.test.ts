import { describe, it, expect, vi } from 'vitest'
import { mergeModalCallbacks } from './mergeModalCallbacks'
import type { Id } from '@/types/common'

describe('mergeModalCallbacks', () => {
  it('onClose only hides the modal, never touching the host onMerged', () => {
    const setMerging = vi.fn()
    const onMerged = vi.fn()
    const { onClose } = mergeModalCallbacks(setMerging, onMerged)

    onClose()

    expect(setMerging).toHaveBeenCalledWith(false)
    expect(onMerged).not.toHaveBeenCalled()
  })

  it('onMerged hides the modal AND forwards the survivor id to the host', () => {
    const setMerging = vi.fn()
    const onMerged = vi.fn()
    const { onMerged: handleMerged } = mergeModalCallbacks(setMerging, onMerged)

    handleMerged('survivor-1' as Id)

    expect(setMerging).toHaveBeenCalledWith(false)
    expect(onMerged).toHaveBeenCalledWith('survivor-1')
  })

  it('onMerged tolerates a missing host callback (onMerged is optional on the detail props)', () => {
    const setMerging = vi.fn()
    const { onMerged: handleMerged } = mergeModalCallbacks(setMerging, undefined)

    expect(() => handleMerged('survivor-1' as Id)).not.toThrow()
    expect(setMerging).toHaveBeenCalledWith(false)
  })
})
