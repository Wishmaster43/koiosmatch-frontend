import { describe, it, expect } from 'vitest'
import { addContextRef, removeContextRef } from './contextRefs'
import type { KoiosContextRef } from '@/types/koios'

const ahmed: KoiosContextRef = { type: 'candidate', id: '1', label: 'Ahmed Vos' }
const nora:  KoiosContextRef = { type: 'candidate', id: '2', label: 'Nora Jansen' }

describe('addContextRef', () => {
  // Adding to an empty list just appends.
  it('adds a new ref', () => {
    expect(addContextRef([], ahmed)).toEqual([ahmed])
  })

  // Picking the same candidate again must not duplicate the chip/payload entry.
  it('dedupes by id — picking the same record twice is a no-op', () => {
    const once = addContextRef([], ahmed)
    const twice = addContextRef(once, ahmed)
    expect(twice).toEqual([ahmed])
    expect(twice).toHaveLength(1)
  })

  // A different id is a genuinely new ref, appended after the existing ones.
  it('appends a second, different ref', () => {
    const list = addContextRef([ahmed], nora)
    expect(list).toEqual([ahmed, nora])
  })

  // Dedupe is by id only — a same-id ref with a different label still counts
  // as "already tracked" (the id is the source of truth for the API payload).
  it('dedupes by id even if the label differs', () => {
    const renamed: KoiosContextRef = { type: 'candidate', id: '1', label: 'A. Vos' }
    expect(addContextRef([ahmed], renamed)).toEqual([ahmed])
  })
})

describe('removeContextRef', () => {
  // Removing an id drops just that entry, keeping the others + their order.
  it('removes the matching ref and keeps the rest', () => {
    expect(removeContextRef([ahmed, nora], '1')).toEqual([nora])
  })

  // Removing an id that isn't tracked is a no-op.
  it('is a no-op for an unknown id', () => {
    expect(removeContextRef([ahmed], 'missing')).toEqual([ahmed])
  })

  // Removing from an empty list stays empty.
  it('handles an empty list', () => {
    expect(removeContextRef([], '1')).toEqual([])
  })
})
