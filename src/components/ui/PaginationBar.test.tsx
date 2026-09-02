/**
 * PaginationBar — a11y contract: the icon-only step buttons name themselves via
 * aria-label (not just the `title` tooltip), so a screen-reader user hears
 * "First page" / "Previous page" / etc, not a bare unnamed "button".
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import i18n from '@/i18n'
import PaginationBar from './PaginationBar'

describe('PaginationBar', () => {
  it('names each step button with an aria-label matching its i18n title (both are given to screen readers)', () => {
    const { getByRole } = render(
      <PaginationBar page={2} totalPages={5} totalRows={100} pageSize={20}
        onPageChange={vi.fn()} onPageSizeChange={vi.fn()} />
    )
    // Four step controls: first/prev/next/last — each accessible by its i18n name,
    // in whatever language i18n resolved to (never hardcoded English/Dutch here).
    const t = i18n.getFixedT(i18n.language, 'common')
    for (const key of ['firstPage', 'prevPage', 'nextPage', 'lastPage']) {
      const name = t(key)
      const btn = getByRole('button', { name })
      expect(btn).toHaveAttribute('title', name)
    }
  })
})
