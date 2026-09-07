/**
 * Shared filter-group builders — test coverage for archived, trash, and period
 * group factories. Verifies that builders return correct shape and maintain
 * DD-MM-YYYY date formatting (DATUM-1).
 */
import { describe, it, expect, vi } from 'vitest'
import {
  Opt,
  fmtD,
  archivedCheckboxGroup,
  trashCheckboxGroup,
  periodCreatedGroup,
} from './common'

describe('Shared filter-group builders', () => {
  // Translate mock.
  const t = (key: string) => {
    const map: Record<string, string> = {
      'filters.archived': 'Archived',
      'filters.trash': 'Trash',
      'filters.periodCreated': 'Created Period',
      'page.archivedView': 'Archived View',
      'view.archived': 'Archived',
    }
    return map[key] || key
  }

  describe('fmtD formatter — zero-pads single-digit dates (DATUM-1)', () => {
    it('formats ISO string to DD-MM-YYYY with zero padding', () => {
      expect(fmtD('2026-08-05T00:00:00')).toBe('05-08-2026')
      expect(fmtD('2026-12-31T23:59:59')).toBe('31-12-2026')
    })

    it('echoes unparseable input unchanged', () => {
      expect(fmtD('invalid-date')).toBe('invalid-date')
      expect(fmtD('')).toBe('')
    })
  })

  describe('archivedCheckboxGroup', () => {
    it('returns a checkbox group with correct shape', () => {
      const group = archivedCheckboxGroup(
        t,
        'Weergave',
        false,
        vi.fn(),
        'filters.archived',
      )

      expect(group).toEqual({
        key: 'archived',
        type: 'checkbox',
        category: 'Weergave',
        label: 'Archived',
        selected: [],
        options: [{ value: 'archived', label: 'Archived' }],
        onToggle: expect.any(Function),
      })
    })

    it('marks selected when showArchived is true', () => {
      const group = archivedCheckboxGroup(
        t,
        'Weergave',
        true,
        vi.fn(),
        'filters.archived',
      )
      expect(group.selected).toEqual(['archived'])
    })

    it('respects custom label key', () => {
      const group = archivedCheckboxGroup(
        t,
        'Weergave',
        false,
        vi.fn(),
        'page.archivedView',
      )
      expect(group.label).toBe('Archived View')
    })

    it('toggles archived state on onToggle call', () => {
      let state = false
      const setState = vi.fn((fn) => {
        state = fn(state)
      })
      const group = archivedCheckboxGroup(t, 'Weergave', state, setState)

      group.onToggle?.()
      expect(setState).toHaveBeenCalled()
    })
  })

  describe('trashCheckboxGroup', () => {
    it('returns a checkbox group with correct shape', () => {
      const group = trashCheckboxGroup(t, 'Weergave', false, vi.fn())

      expect(group).toEqual({
        key: 'trash',
        type: 'checkbox',
        category: 'Weergave',
        label: 'Trash',
        selected: [],
        options: [{ value: 'trash', label: 'Trash' }],
        onToggle: expect.any(Function),
      })
    })

    it('marks selected when showTrash is true', () => {
      const group = trashCheckboxGroup(t, 'Weergave', true, vi.fn())
      expect(group.selected).toEqual(['trash'])
    })

    it('toggles trash state on onToggle call', () => {
      let state = false
      const setState = vi.fn((fn) => {
        state = fn(state)
      })
      const group = trashCheckboxGroup(t, 'Weergave', state, setState)

      group.onToggle?.()
      expect(setState).toHaveBeenCalled()
    })
  })

  describe('periodCreatedGroup', () => {
    it('returns empty array when no dateRange', () => {
      const groups = periodCreatedGroup(t, 'Weergave', null, vi.fn())
      expect(groups).toEqual([])
    })

    it('returns one-item array with period group when dateRange present', () => {
      const groups = periodCreatedGroup(
        t,
        'Weergave',
        { from: '2026-08-05T00:00:00', to: '2026-08-09T00:00:00' },
        vi.fn(),
      )

      expect(groups).toHaveLength(1)
      expect(groups[0]).toEqual({
        key: 'period',
        type: 'search-select',
        category: 'Weergave',
        label: 'Created Period',
        selected: ['2026-08-05T00:00:00|2026-08-09T00:00:00'],
        options: [
          {
            value: '2026-08-05T00:00:00|2026-08-09T00:00:00',
            label: '05-08-2026 – 09-08-2026',
          },
        ],
        onToggle: expect.any(Function),
      })
    })

    it('formats dates with zero-padding in the period label', () => {
      const groups = periodCreatedGroup(
        t,
        'Weergave',
        { from: '2026-08-05T00:00:00', to: '2026-08-09T00:00:00' },
        vi.fn(),
      )

      const label = groups[0].options[0].label
      expect(label).toBe('05-08-2026 – 09-08-2026')
      expect(label).not.toContain('5-8-2026')
    })

    it('respects custom period param key', () => {
      const groups = periodCreatedGroup(
        t,
        'Weergave',
        { from: '2026-01-01T00:00:00', to: '2026-01-31T00:00:00' },
        vi.fn(),
        'filters.periodLastContact',
      )

      expect(groups).toHaveLength(1)
      // The custom key is used as labelKey, but since our mock t() doesn't have it,
      // it falls back to the key itself. This test just verifies it's passed through.
      expect(groups[0].label).toBe('filters.periodLastContact')
    })

    it('calls setDateRange(null) on onToggle', () => {
      const setDateRange = vi.fn()
      const groups = periodCreatedGroup(
        t,
        'Weergave',
        { from: '2026-08-05T00:00:00', to: '2026-08-09T00:00:00' },
        setDateRange,
      )

      groups[0].onToggle?.()
      expect(setDateRange).toHaveBeenCalledWith(null)
    })
  })

  describe('Opt type compliance', () => {
    it('validates Opt interface shape', () => {
      const opt: Opt = {
        value: 'test-value',
        label: 'Test Label',
        count: 5,
        color: 'rgb(59, 143, 212)',
      }
      expect(opt.value).toBe('test-value')
      expect(opt.label).toBe('Test Label')
      expect(opt.count).toBe(5)

      // Optional fields allowed.
      const partial: Opt = { label: 'Just label' }
      expect(partial.value).toBeUndefined()
    })
  })
})
