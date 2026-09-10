import { describe, it, expect, vi } from 'vitest'
import { makeOwnerMetaPicker } from './ownerMetaPicker'

describe('ownerMetaPicker', () => {
  it('returns the exact owner meta picker config shape (no extra/missing keys)', () => {
    const onUpdate = vi.fn()
    const options = [{ value: 'user1', label: 'User 1' }]

    const config = makeOwnerMetaPicker({
      entityId: 'entity-1',
      value: 'user1',
      options,
      onUpdate,
      label: 'Owner',
      clearLabel: 'Clear owner',
    })

    // toEqual on the WHOLE shape: a toMatchObject subset would not catch an
    // extra key (e.g. a placeholder leaking in when none was passed).
    expect(config).toEqual({
      key: 'owner',
      label: 'Owner',
      value: 'user1',
      options,
      onChange: expect.any(Function),
      menuWidth: 200,
      width: 190,
      clearable: true,
      clearLabel: 'Clear owner',
    })
  })

  it('calls onUpdate with correct payload on onChange', () => {
    const onUpdate = vi.fn()
    const config = makeOwnerMetaPicker({
      entityId: 'entity-1',
      value: null,
      options: [],
      onUpdate,
      label: 'Owner',
      clearLabel: 'Clear',
    })

    config.onChange('new-user')
    expect(onUpdate).toHaveBeenCalledWith('entity-1', { ownerId: 'new-user' })
  })

  it('clears owner when onChange called with empty string', () => {
    const onUpdate = vi.fn()
    const config = makeOwnerMetaPicker({
      entityId: 'entity-1',
      value: 'user1',
      options: [],
      onUpdate,
      label: 'Owner',
      clearLabel: 'Clear',
    })

    config.onChange('')
    expect(onUpdate).toHaveBeenCalledWith('entity-1', { ownerId: null })
  })

  it('includes placeholder when provided', () => {
    const config = makeOwnerMetaPicker({
      entityId: 'entity-1',
      value: null,
      options: [],
      onUpdate: vi.fn(),
      label: 'Owner',
      clearLabel: 'Clear',
      placeholder: 'Select owner',
    })

    expect(config.placeholder).toBe('Select owner')
  })
})
