// useTextBlockPopout — asserts the exact options handed to useTextPopoutHost and
// that changeDraft/openPopout wire into the given setters (DRY round 11, NOTES2).
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

vi.mock('./useTextPopoutHost', () => ({ useTextPopoutHost: vi.fn() }))
import { useTextPopoutHost } from './useTextPopoutHost'
import { useTextBlockPopout } from './useTextBlockPopout'

const mockedUseTextPopoutHost = useTextPopoutHost as unknown as ReturnType<typeof vi.fn>

describe('useTextBlockPopout', () => {
  it('passes entity/id/field/value/dirty and wires onDraft/onSaved into the given setters', () => {
    let capturedOpts: {
      entity: string; id: string; field: string; value: string; dirty: boolean
      onDraft: (html: string) => void; onSaved: (html: string) => void
    } | undefined
    const open = vi.fn()
    const publishDraft = vi.fn()
    mockedUseTextPopoutHost.mockImplementation((opts: typeof capturedOpts) => { capturedOpts = opts; return { open, publishDraft, active: false } })

    const setDraft = vi.fn()
    const setShown = vi.fn()
    const setEditing = vi.fn()
    const { result } = renderHook(() => useTextBlockPopout({
      entity: 'match', id: 'm1', field: 'text', draft: 'draft-html', shown: 'shown-html', editing: true,
      setDraft, setShown, setEditing,
    }))

    expect(capturedOpts).toMatchObject({ entity: 'match', id: 'm1', field: 'text', value: 'draft-html', dirty: true })

    capturedOpts!.onDraft('new-draft')
    expect(setDraft).toHaveBeenCalledWith('new-draft')
    expect(setEditing).toHaveBeenCalledWith(true)

    capturedOpts!.onSaved('saved-html')
    expect(setShown).toHaveBeenCalledWith('saved-html')

    result.current.changeDraft('typed')
    expect(setDraft).toHaveBeenCalledWith('typed')
    expect(publishDraft).toHaveBeenCalledWith('typed')

    result.current.openPopout()
    expect(setEditing).toHaveBeenCalledWith(true)
    expect(open).toHaveBeenCalledTimes(1)
  })

  it('treats a missing shown value as empty for the dirty check', () => {
    let capturedOpts: { dirty: boolean } | undefined
    mockedUseTextPopoutHost.mockImplementation((opts: typeof capturedOpts) => { capturedOpts = opts; return { open: vi.fn(), publishDraft: vi.fn(), active: false } })
    renderHook(() => useTextBlockPopout({
      entity: 'match', id: 'm1', field: 'text', draft: 'x', shown: null, editing: true,
      setDraft: vi.fn(), setShown: vi.fn(), setEditing: vi.fn(),
    }))
    expect(capturedOpts?.dirty).toBe(true)
  })

  it('openPopout does nothing when id is null', () => {
    const open = vi.fn()
    mockedUseTextPopoutHost.mockReturnValue({ open, publishDraft: vi.fn(), active: false })
    const setEditing = vi.fn()
    const { result } = renderHook(() => useTextBlockPopout({
      entity: 'opportunity', id: undefined, field: 'description', draft: '', shown: '', editing: false,
      setDraft: vi.fn(), setShown: vi.fn(), setEditing,
    }))
    result.current.openPopout()
    expect(setEditing).not.toHaveBeenCalled()
    expect(open).not.toHaveBeenCalled()
  })
})
