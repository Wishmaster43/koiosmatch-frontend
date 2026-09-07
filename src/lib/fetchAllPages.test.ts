/**
 * fetchAllPages — test pagination across multiple pages.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AxiosRequestConfig } from 'axios'
import api from './api'
import { fetchAllPages } from './fetchAllPages'

vi.mock('./api', async () => {
  const actual = await vi.importActual('./api')
  return { ...actual, default: { get: vi.fn(() => Promise.resolve({})) } }
})

describe('fetchAllPages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches all pages and concatenates rows when lastPage > 1', async () => {
    type Row = { id: number; name: string }
    type MockResponse = { data: { data: Row[]; meta: Record<string, unknown> } }
    const page1Rows: Row[] = [{ id: 1, name: 'Row 1' }, { id: 2, name: 'Row 2' }]
    const page2Rows: Row[] = [{ id: 3, name: 'Row 3' }]

    vi.mocked(api.get).mockImplementation((_path: unknown, config: unknown) => {
      const cfg = config as AxiosRequestConfig | undefined
      const currentPage = (cfg?.params as Record<string, unknown>)?.page ?? 1
      if (currentPage === 1) {
        return Promise.resolve({
          data: {
            data: page1Rows,
            meta: { total: 3, current_page: 1, per_page: 100, last_page: 2 },
          },
        } as MockResponse)
      }
      return Promise.resolve({
        data: {
          data: page2Rows,
          meta: { total: 3, current_page: 2, per_page: 100, last_page: 2 },
        },
      } as MockResponse)
    })

    const result = await fetchAllPages('/test', {})

    // Both pages should have been fetched.
    expect(api.get).toHaveBeenCalledTimes(2)
    // All rows concatenated.
    expect(result.rows).toHaveLength(3)
    expect((result.rows[0] as Row)?.id).toBe(1)
    expect((result.rows[1] as Row)?.id).toBe(2)
    expect((result.rows[2] as Row)?.id).toBe(3)
    // Metadata from first page.
    expect(result.total).toBe(3)
    expect(result.lastPage).toBe(2)
  })

  it('fetches single page when lastPage is 1', async () => {
    type Row = { id: number; name: string }
    type MockResponse = { data: { data: Row[]; meta: Record<string, unknown> } }
    const rows: Row[] = [{ id: 1, name: 'Row 1' }]
    vi.mocked(api.get).mockResolvedValue({
      data: {
        data: rows,
        meta: { total: 1, current_page: 1, per_page: 100, last_page: 1 },
      },
    } as MockResponse)

    const result = await fetchAllPages('/test', {})

    // Only one call for page 1.
    expect(api.get).toHaveBeenCalledTimes(1)
    expect(result.rows).toEqual(rows)
  })

  it('passes through additional params to every page request', async () => {
    type MockResponse = { data: { data: unknown[]; meta: Record<string, unknown> } }
    vi.mocked(api.get).mockResolvedValue({
      data: {
        data: [],
        meta: { total: 0, current_page: 1, per_page: 100, last_page: 1 },
      },
    } as MockResponse)

    await fetchAllPages('/test', { status: 'active', role: 'admin' })

    expect(api.get).toHaveBeenCalledWith('/test', {
      params: { status: 'active', role: 'admin', per_page: 100 },
      signal: undefined,
    })
  })

  it('respects the AbortController signal', async () => {
    type MockResponse = { data: { data: unknown[]; meta: Record<string, unknown> } }
    const signal = new AbortController().signal

    vi.mocked(api.get).mockResolvedValue({
      data: {
        data: [],
        meta: { total: 0, current_page: 1, per_page: 100, last_page: 1 },
      },
    } as MockResponse)

    await fetchAllPages('/test', {}, signal)

    expect(api.get).toHaveBeenCalledWith('/test', expect.objectContaining({ signal }))
  })
})
