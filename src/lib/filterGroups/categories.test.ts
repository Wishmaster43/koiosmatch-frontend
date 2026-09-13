/**
 * filterCategoryLabels — the shared General/Organisation/Display category
 * label triplet used by every entity's filter-group builder (see file doc).
 */
import { describe, it, expect } from 'vitest'
import { filterCategoryLabels } from './categories'

describe('filterCategoryLabels', () => {
  it('resolves the three category keys via t()', () => {
    const t = ((key: string) => `translated:${key}`) as unknown as import('i18next').TFunction
    expect(filterCategoryLabels(t)).toEqual({
      catGeneral: 'translated:filters.categories.general',
      catOrg: 'translated:filters.categories.organisation',
      catDisplay: 'translated:filters.categories.display',
    })
  })
})
