/**
 * SmPaginationBar.test — the wrapper's own behaviour: a page-size change resets
 * the page to 1, and the pagination props reach PaginationBar unchanged. The
 * shared PaginationBar itself (SelectMenu UI, row-range copy) is mocked so the
 * test exercises SmPaginationBar's own logic, not PaginationBar's rendering.
 */
import { render } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

const { captured } = vi.hoisted(() => ({ captured: { current: null as Record<string, unknown> | null } }))

vi.mock('@/components/ui/PaginationBar', () => ({
  default: (props: Record<string, unknown>) => { captured.current = props; return null },
}))

import { SmPaginationBar } from './SmPaginationBar'

describe('SmPaginationBar', () => {
  it('resets the page to 1 whenever the page size changes', () => {
    const calls: string[] = []
    const setPage = vi.fn((n: number) => { calls.push(`setPage(${n})`) })
    const setPageSize = vi.fn((n: number) => { calls.push(`setPageSize(${n})`) })
    render(<SmPaginationBar page={3} totalPages={5} totalRows={500} pageSize={50}
      onPageChange={vi.fn()} setPage={setPage} setPageSize={setPageSize} />)

    const onPageSizeChange = captured.current!.onPageSizeChange as (n: number) => void
    onPageSizeChange(100)

    // Size first, then back to page 1 — the order is the wrapper's whole point.
    expect(calls).toEqual(['setPageSize(100)', 'setPage(1)'])
  })

  it('forwards the pagination props to PaginationBar unchanged', () => {
    const onPageChange = vi.fn()
    render(<SmPaginationBar page={2} totalPages={9} totalRows={321} pageSize={100}
      onPageChange={onPageChange} setPage={vi.fn()} setPageSize={vi.fn()} />)

    const props = captured.current!
    expect(props.page).toBe(2)
    expect(props.totalPages).toBe(9)
    expect(props.totalRows).toBe(321)
    expect(props.pageSize).toBe(100)
    expect(props.onPageChange).toBe(onPageChange)
  })
})
