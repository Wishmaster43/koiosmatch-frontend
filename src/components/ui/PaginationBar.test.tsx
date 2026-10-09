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

// §3 no fake affordances: a rows-per-page dropdown that can change nothing
// (no handler, or a single option) must not render at all — the range text
// and the step buttons stay regardless.
describe('PaginationBar · rows-per-page control', () => {
  it('hides the control when there is no onPageSizeChange handler (server-fixed page size)', () => {
    const { queryByText } = render(
      <PaginationBar page={1} totalPages={2} totalRows={25} pageSize={20}
        onPageChange={vi.fn()} pageSizeOptions={[20]} />
    )
    const t = i18n.getFixedT(i18n.language, 'common')
    expect(queryByText(t('rowsPerPage'))).not.toBeInTheDocument()
  })

  it('hides the control when only one page-size option exists, even with a handler', () => {
    const { queryByText } = render(
      <PaginationBar page={1} totalPages={2} totalRows={25} pageSize={20}
        onPageChange={vi.fn()} onPageSizeChange={vi.fn()} pageSizeOptions={[20]} />
    )
    const t = i18n.getFixedT(i18n.language, 'common')
    expect(queryByText(t('rowsPerPage'))).not.toBeInTheDocument()
  })

  it('renders the control when a handler is given with the default multi-option list', () => {
    const { queryByText } = render(
      <PaginationBar page={1} totalPages={5} totalRows={100} pageSize={20}
        onPageChange={vi.fn()} onPageSizeChange={vi.fn()} />
    )
    const t = i18n.getFixedT(i18n.language, 'common')
    expect(queryByText(t('rowsPerPage'))).toBeInTheDocument()
  })
})

// N-010: the server range wins over the requested page size (the server clamps per_page silently).
describe('PaginationBar server range', () => {
  it('shows 101–104 of 104 on page 2 even when pageSize 500 was requested', () => {
    const { container } = render(
      <PaginationBar page={2} totalPages={2} totalRows={104} pageSize={500}
        rangeFrom={101} rangeTo={104} onPageChange={vi.fn()} />
    )
    expect(container.textContent).toMatch(/101.{1,3}104/)
  })

  it('falls back to the requested-size formula without a server range', () => {
    const { container } = render(
      <PaginationBar page={1} totalPages={2} totalRows={104} pageSize={50} onPageChange={vi.fn()} />
    )
    expect(container.textContent).toMatch(/1.{1,3}50/)
  })
})
