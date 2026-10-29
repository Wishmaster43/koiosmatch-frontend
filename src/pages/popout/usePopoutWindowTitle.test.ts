import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePopoutWindowTitle } from './usePopoutWindowTitle'

describe('usePopoutWindowTitle', () => {
  let original = ''
  // Save the page title so each case starts and ends clean.
  beforeEach(() => { original = document.title; document.title = 'Original' })
  afterEach(() => { document.title = original })

  it('leaves the title alone without a record', () => {
    renderHook(() => usePopoutWindowTitle(null, 'Popout'))
    expect(document.title).toBe('Original')
  })

  it('sets the title for a loaded record and restores it on unmount', () => {
    const { unmount } = renderHook(() => usePopoutWindowTitle({ id: 1 }, 'Popout'))
    expect(document.title).toBe('Popout')
    unmount()
    expect(document.title).toBe('Original')
  })

  it('applies a new title on rerender and still restores the original', () => {
    const record = { id: 1 }
    const { rerender, unmount } = renderHook(({ t }) => usePopoutWindowTitle(record, t), { initialProps: { t: 'One' } })
    rerender({ t: 'Two' })
    expect(document.title).toBe('Two')
    unmount()
    expect(document.title).toBe('Original')
  })

  it('restores the title when the record goes away', () => {
    const { rerender } = renderHook(({ r }) => usePopoutWindowTitle(r, 'Popout'), { initialProps: { r: { id: 1 } as object | null } })
    expect(document.title).toBe('Popout')
    rerender({ r: null })
    expect(document.title).toBe('Original')
  })
})
