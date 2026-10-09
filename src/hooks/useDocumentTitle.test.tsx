import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useDocumentTitle } from './useDocumentTitle'

describe('useDocumentTitle', () => {
  it('sets the suffixed title and restores it on unmount', () => {
    document.title = 'before'
    const { unmount } = renderHook(() => useDocumentTitle('Candidates'))
    expect(document.title).toBe('Candidates · KoiosMatch')
    unmount()
    expect(document.title).toBe('before')
  })

  it('leaves the title alone for a null title', () => {
    document.title = 'before'
    renderHook(() => useDocumentTitle(null))
    expect(document.title).toBe('before')
  })
})
