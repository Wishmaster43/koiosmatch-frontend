import { describe, it, expect, vi } from 'vitest'
import { archiveNode, mergeNode, removeTagNode, detachNode, pickById, pickPool } from './bulkNodes'
import type { Id } from '@/types/common'

// Mock translation function — returns the key itself so assertions can work on keys.
const t = (key: string) => key

describe('bulkNodes builders', () => {
  describe('archiveNode', () => {
    it('returns an archive node when canArchive is true', () => {
      const onArchive = () => {}
      const result = archiveNode(t, { canArchive: true, onArchive })
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        key: 'archive',
        label: 'bulk.archive',
        danger: true,
      })
    })

    it('returns an empty array when canArchive is false', () => {
      const result = archiveNode(t, { canArchive: false, onArchive: () => {} })
      expect(result).toEqual([])
    })

    it('returns an empty array when canArchive is undefined', () => {
      const result = archiveNode(t, { onArchive: () => {} })
      expect(result).toEqual([])
    })
  })

  describe('mergeNode', () => {
    it('returns a merge node when count is 2 and canMerge is true', () => {
      const onMerge = () => {}
      const result = mergeNode(t, { count: 2, canMerge: true, onMerge })
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        key: 'merge',
        label: 'bulk.merge',
      })
    })

    it('returns an empty array when count is not 2', () => {
      const result = mergeNode(t, { count: 1, canMerge: true, onMerge: () => {} })
      expect(result).toEqual([])
    })

    it('returns an empty array when canMerge is false', () => {
      const result = mergeNode(t, { count: 2, canMerge: false, onMerge: () => {} })
      expect(result).toEqual([])
    })

    it('returns an empty array when onMerge is undefined', () => {
      const result = mergeNode(t, { count: 2, canMerge: true })
      expect(result).toEqual([])
    })
  })

  describe('removeTagNode', () => {
    it('returns a tag removal node with default options', () => {
      const tagOptions = [{ value: 'tag1', label: 'Tag 1' }]
      const result = removeTagNode(t, { tagOptions, onRemoveTag: () => {} })
      expect(result).toMatchObject({
        key: 'tag',
        label: 'bulk.removeTag',
        searchPlaceholder: 'bulk.searchTag',
        emptyText: 'bulk.noTags',
        options: tagOptions,
      })
    })

    it('returns a tag removal node with custom options', () => {
      const tagOptions = [{ value: 'tag1', label: 'Tag 1' }]
      const result = removeTagNode(
        t,
        { tagOptions, onRemoveTag: () => {} },
        { key: 'remove-tag', labelKey: 'bulk.removeTag' },
      )
      expect(result).toMatchObject({
        key: 'remove-tag',
        label: 'bulk.removeTag',
      })
    })

    it('fires onRemoveTag on pick with string value', () => {
      const onRemoveTag = vi.fn()
      const tagOptions = [{ value: 'tag1', label: 'Tag 1' }]
      const result = removeTagNode(t, { tagOptions, onRemoveTag })
      if (result.onPick) {
        result.onPick('tag1')
        expect(onRemoveTag).toHaveBeenCalledWith('tag1')
      }
    })

    it('fires onRemoveTag on pick with number value', () => {
      const onRemoveTag = vi.fn()
      const tagOptions = [{ value: 'tag1', label: 'Tag 1' }]
      const result = removeTagNode(t, { tagOptions, onRemoveTag })
      if (result.onPick) {
        result.onPick(123)
        expect(onRemoveTag).toHaveBeenCalledWith('123')
      }
    })
  })

  describe('detachNode', () => {
    it('returns a detach node when canManage is true', () => {
      const onDetach = () => {}
      const result = detachNode(t, { canManage: true, onDetach })
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        key: 'detach',
        label: 'bulk.detach',
        danger: true,
        input: true,
      })
    })

    it('returns an empty array when canManage is false', () => {
      const result = detachNode(t, { canManage: false, onDetach: () => {} })
      expect(result).toEqual([])
    })

    it('fires onDetach on submit with string value', () => {
      const onDetach = vi.fn()
      const result = detachNode(t, { canManage: true, onDetach })
      if (result[0] && result[0].onSubmit) {
        result[0].onSubmit('reason text')
        expect(onDetach).toHaveBeenCalledWith('reason text')
      }
    })

    it('fires onDetach on submit with array value', () => {
      const onDetach = vi.fn()
      const result = detachNode(t, { canManage: true, onDetach })
      if (result[0] && result[0].onSubmit) {
        result[0].onSubmit(['reason1', 'reason2'])
        expect(onDetach).toHaveBeenCalledWith('reason1,reason2')
      }
    })
  })

  describe('pickById', () => {
    it('resolves a matching user by id and calls the handler', () => {
      const handler = vi.fn()
      const users = [
        { id: '1', name: 'Alice' },
        { id: '2', name: 'Bob' },
      ]
      const picker = pickById(users, handler)
      picker('2')
      expect(handler).toHaveBeenCalledWith({ id: '2', name: 'Bob' })
    })

    it('does not call the handler if no user matches', () => {
      const handler = vi.fn()
      const users = [{ id: '1', name: 'Alice' }]
      const picker = pickById(users, handler)
      picker('999')
      expect(handler).not.toHaveBeenCalled()
    })

    it('works with numeric id', () => {
      const handler = vi.fn()
      const numId: Id = 1
      const users = [{ id: numId, name: 'Alice' }]
      const picker = pickById(users, handler)
      picker(1)
      expect(handler).toHaveBeenCalledWith({ id: numId, name: 'Alice' })
    })
  })

  describe('pickPool', () => {
    it('resolves a matching pool by id or name and calls the handler', () => {
      const handler = vi.fn()
      const pools = [
        { id: 'p1', name: 'Pool A', color: 'red' },
        { id: 'p2', name: 'Pool B', color: 'blue' },
      ]
      const picker = pickPool(pools, handler)
      picker('p2')
      expect(handler).toHaveBeenCalledWith({ id: 'p2', name: 'Pool B', color: 'blue' })
    })

    it('falls back to name if id is not set', () => {
      const handler = vi.fn()
      const pools = [{ name: 'Pool A', color: 'red' }]
      const picker = pickPool(pools, handler)
      picker('Pool A')
      expect(handler).toHaveBeenCalledWith({ name: 'Pool A', color: 'red' })
    })

    it('does not call the handler if no pool matches', () => {
      const handler = vi.fn()
      const pools = [{ id: 'p1', name: 'Pool A' }]
      const picker = pickPool(pools, handler)
      picker('p999')
      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('pickById (customers)', () => {
    it('resolves a matching customer by id and calls the handler', () => {
      const handler = vi.fn()
      const customers = [
        { id: 'c1', name: 'Customer A' },
        { id: 'c2', name: 'Customer B' },
      ]
      const picker = pickById(customers, handler)
      picker('c2')
      expect(handler).toHaveBeenCalledWith({ id: 'c2', name: 'Customer B' })
    })

    it('does not call the handler if no customer matches', () => {
      const handler = vi.fn()
      const customers = [{ id: 'c1', name: 'Customer A' }]
      const picker = pickById(customers, handler)
      picker('c999')
      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('pickById (agents)', () => {
    it('resolves a matching agent by id and calls the handler', () => {
      const handler = vi.fn()
      const agents = [
        { id: 'a1', name: 'Agent A' },
        { id: 'a2', name: 'Agent B' },
      ]
      const picker = pickById(agents, handler)
      picker('a2')
      expect(handler).toHaveBeenCalledWith({ id: 'a2', name: 'Agent B' })
    })

    it('does not call the handler if no agent matches', () => {
      const handler = vi.fn()
      const agents = [{ id: 'a1', name: 'Agent A' }]
      const picker = pickById(agents, handler)
      picker('a999')
      expect(handler).not.toHaveBeenCalled()
    })
  })
})
