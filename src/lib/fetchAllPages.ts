/**
 * fetchAllPages — load all pages of a paginated endpoint, concatenating rows.
 * Requests page 1 with per_page=100, then pages 2..lastPage sequentially if
 * needed. Returns the concatenated result with row count + pagination metadata
 * from the first page (total/page/lastPage/perPage stay the first page's values).
 */
import api, { unwrapList } from './api'
import type { ListResult } from '@/types/api'

/**
 * Load all pages of a paginated endpoint.
 * @param path API endpoint path (e.g. '/locations')
 * @param params Additional query params (e.g. { status: 'active' })
 * @param signal Optional AbortController signal to cancel the fetch
 * @returns ListResult with all rows from all pages concatenated
 */
export async function fetchAllPages<T = unknown>(
  path: string,
  params: Record<string, unknown> = {},
  signal?: AbortSignal
): Promise<ListResult<T>> {
  const PER_PAGE = 100

  // Fetch the first page to determine how many pages exist.
  const firstResponse = await api.get(path, { params: { ...params, per_page: PER_PAGE }, signal })
  const firstPage = unwrapList<T>(firstResponse)
  const { rows, total, lastPage, perPage } = firstPage

  // If there is only one page, return it as-is.
  if (lastPage <= 1) {
    return firstPage
  }

  // Fetch remaining pages sequentially and concatenate rows.
  const allRows = [...rows]
  for (let page = 2; page <= lastPage; page++) {
    const res = await api.get(path, { params: { ...params, per_page: PER_PAGE, page }, signal })
    const result = unwrapList<T>(res)
    allRows.push(...result.rows)
  }

  // Return the concatenated result with metadata from the first page.
  return { rows: allRows, total, page: 1, lastPage, perPage }
}
