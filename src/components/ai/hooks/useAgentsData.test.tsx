import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import api from '@/lib/api'
import { useAgentsData } from './useAgentsData'

// useAgentsData fetches agents + the prompts/faqs option lists in parallel on mount.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

function Harness() {
  const h = useAgentsData()
  return (
    <>
      <div data-testid="prompts-count">{h.prompts.length}</div>
      <div data-testid="knowledge-count">{h.knowledgeItems.length}</div>
    </>
  )
}

describe('useAgentsData — requests /ai/agents plus the /ai/prompts, /ai/faqs and /ai/knowledge/lookup option lists', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/ai/agents') return Promise.resolve({ data: [{ id: 'a1', name: 'Kelly' }] })
      if (url === '/ai/prompts') return Promise.resolve({ data: [{ id: 'p1', name: 'Opening' }] })
      if (url === '/ai/faqs') return Promise.resolve({ data: [] })
      // KNOWLEDGE-SCOPE-1 (K-276): the agent-picker's own knowledge-item option list.
      if (url === '/ai/knowledge/lookup') return Promise.resolve({ data: [{ value: 'k1', label: 'CAO regels' }] })
      return Promise.resolve({ data: [] })
    })
  })

  it('fires all four GETs and exposes the loaded prompts + knowledge-item lists', async () => {
    render(<Harness />)
    await waitFor(() => expect(screen.getByTestId('prompts-count')).toHaveTextContent('1'))
    expect(screen.getByTestId('knowledge-count')).toHaveTextContent('1')
    expect(api.get).toHaveBeenCalledWith('/ai/agents')
    expect(api.get).toHaveBeenCalledWith('/ai/prompts')
    expect(api.get).toHaveBeenCalledWith('/ai/faqs')
    expect(api.get).toHaveBeenCalledWith('/ai/knowledge/lookup')
  })
})
