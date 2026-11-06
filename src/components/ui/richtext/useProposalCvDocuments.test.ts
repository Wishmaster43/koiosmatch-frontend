/**
 * useProposalCvDocuments (Y-002): asserts the REQUEST and the client-side filter.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import api from '@/lib/api'
import { useProposalCvDocuments } from './useProposalCvDocuments'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})

afterEach(() => vi.clearAllMocks())

describe('useProposalCvDocuments', () => {
  it('GETs the application documents and keeps only clean proposal_cv rows', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [
      { id: 'd1', type: 'proposal_cv', name: 'CV - Jan.pdf', scan_status: 'clean', created_at: '2026-11-01T10:00:00Z' },
      { id: 'd2', type: 'proposal_cv', name: 'CV - Pending.pdf', scan_status: 'pending' },
      { id: 'd3', type: 'contract', name: 'Contract.pdf', scan_status: 'clean' },
    ] } })
    const { result } = renderHook(() => useProposalCvDocuments('a1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(api.get).toHaveBeenCalledWith('/applications/a1/documents', expect.objectContaining({ signal: expect.anything() }))
    expect(result.current.docs).toEqual([{ id: 'd1', label: 'CV - Jan.pdf', uploadedAt: '2026-11-01T10:00:00Z' }])
    expect(result.current.error).toBe(false)
  })

  it('sends no request without an application id', () => {
    const { result } = renderHook(() => useProposalCvDocuments(undefined))
    expect(api.get).not.toHaveBeenCalled()
    expect(result.current).toEqual({ docs: [], loading: false, error: false })
  })

  it('reports an error state when the request fails', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useProposalCvDocuments('a1'))
    await waitFor(() => expect(result.current.error).toBe(true))
  })
})
