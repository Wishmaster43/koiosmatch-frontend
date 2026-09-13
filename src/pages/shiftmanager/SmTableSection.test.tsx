/**
 * SmTableSection.test — the shared table+pagination tail of the Shiftmanager mirror
 * pages: children render inside the scroll area, the error banner and pagination bar
 * receive the props they were passed (mirrors SmPaginationBar.test.tsx's own approach).
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

const { bannerProps, paginationProps } = vi.hoisted(() => ({
  bannerProps: { current: null as Record<string, unknown> | null },
  paginationProps: { current: null as Record<string, unknown> | null },
}))

vi.mock('./SmLoadErrorBanner', () => ({
  SmLoadErrorBanner: (props: Record<string, unknown>) => { bannerProps.current = props; return null },
}))
vi.mock('./SmPaginationBar', () => ({
  SmPaginationBar: (props: Record<string, unknown>) => { paginationProps.current = props; return null },
}))

import { SmTableSection } from './SmTableSection'

describe('SmTableSection', () => {
  it('renders its children (the caller-supplied table) inside the scroll area', () => {
    render(
      <SmTableSection isError={false} onRetry={vi.fn()} page={1} totalPages={3}
        totalRows={30} pageSize={10} onPageChange={vi.fn()} setPage={vi.fn()} setPageSize={vi.fn()}>
        <div>the-table</div>
      </SmTableSection>,
    )
    expect(screen.getByText('the-table')).toBeInTheDocument()
  })

  it('forwards isError/onRetry to the error banner and the pagination props unchanged', () => {
    const onRetry = vi.fn()
    const onPageChange = vi.fn()
    render(
      <SmTableSection isError totalRows={99} page={2} totalPages={5} pageSize={20}
        onRetry={onRetry} onPageChange={onPageChange} setPage={vi.fn()} setPageSize={vi.fn()}>
        <div />
      </SmTableSection>,
    )
    expect(bannerProps.current).toMatchObject({ isError: true, onRetry })
    expect(paginationProps.current).toMatchObject({ page: 2, totalPages: 5, totalRows: 99, pageSize: 20, onPageChange })
  })
})
