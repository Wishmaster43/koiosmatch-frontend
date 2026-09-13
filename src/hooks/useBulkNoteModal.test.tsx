/**
 * useBulkNoteModal — the shared "bulk add note" modal slot, shared by every
 * bulk bar (see file doc). FloatingPanel renders nothing while `open` is
 * false, so the closed state needs no i18n/provider setup.
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook, render, act } from '@testing-library/react'
import { useBulkNoteModal } from './useBulkNoteModal'

const t = ((key: string) => key) as unknown as import('i18next').TFunction

describe('useBulkNoteModal', () => {
  it('starts closed and renders nothing (FloatingPanel is closed-mount-free)', () => {
    const onAddNote = vi.fn()
    const { result } = renderHook(() => useBulkNoteModal(onAddNote, t))
    expect(result.current.open).toBe(false)
    const { container } = render(<>{result.current.node}</>)
    expect(container.innerHTML).toBe('')
  })
  it('setOpen(true) flips the open flag', () => {
    const { result } = renderHook(() => useBulkNoteModal(vi.fn(), t))
    act(() => result.current.setOpen(true))
    expect(result.current.open).toBe(true)
  })
})
