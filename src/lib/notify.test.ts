import { describe, it, expect, vi } from 'vitest'
import { notifyError, notifySuccess } from './notify'

describe('notify', () => {
  it('dispatches a km:toast event with the type + message', () => {
    const handler = vi.fn()
    window.addEventListener('km:toast', handler)
    try {
      notifyError('save failed')
      notifySuccess('saved')
      expect(handler).toHaveBeenCalledTimes(2)
      expect((handler.mock.calls[0][0] as CustomEvent).detail).toEqual({ type: 'error', message: 'save failed' })
      expect((handler.mock.calls[1][0] as CustomEvent).detail).toEqual({ type: 'success', message: 'saved' })
    } finally {
      window.removeEventListener('km:toast', handler)
    }
  })
})
