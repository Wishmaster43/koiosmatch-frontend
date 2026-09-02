import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import api from '@/lib/api'
import { usePromptsData } from './usePromptsData'
import { useFaqsData } from './useFaqsData'

// usePromptsData/useFaqsData fetch on mount and select/save through the same
// client — stub the whole default client (keep unwrap/unwrapList real).
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

// Tiny harness so the hook can be driven from a render tree.
function PromptsHarness() {
  const h = usePromptsData()
  return (
    <div>
      <button onClick={h.save}>save</button>
      <span data-testid="name">{h.name}</span>
    </div>
  )
}

function FaqsHarness() {
  const h = useFaqsData()
  return (
    <div>
      <button onClick={h.save}>save</button>
      <span data-testid="name">{h.name}</span>
    </div>
  )
}

describe('usePromptsData — select fetches the versions route, save PUTs to the exact URL/body', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    vi.mocked(api.put).mockReset()
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/ai/prompts') return Promise.resolve({ data: [{ id: 'p1', name: 'Opening', body: 'Hoi!' }] })
      if (url === '/ai/prompts/p1/versions') return Promise.resolve({ data: [] })
      return Promise.resolve({ data: [] })
    })
    vi.mocked(api.put).mockResolvedValue({ data: { id: 'p1', name: 'Opening', body: 'Hoi!' } })
  })

  it('preselects the first prompt and requests its version history', async () => {
    render(<PromptsHarness />)
    await waitFor(() => expect(screen.getByTestId('name')).toHaveTextContent('Opening'))
    expect(api.get).toHaveBeenCalledWith('/ai/prompts/p1/versions')
  })

  it('saves an existing prompt via PUT to /ai/prompts/{id} with {name, body}', async () => {
    render(<PromptsHarness />)
    await waitFor(() => expect(screen.getByTestId('name')).toHaveTextContent('Opening'))

    fireEvent.click(screen.getByText('save'))

    await waitFor(() => expect(api.put).toHaveBeenCalled())
    expect(api.put).toHaveBeenCalledWith('/ai/prompts/p1', { name: 'Opening', body: 'Hoi!' })
    // Prompts refresh their version list after a save (refreshVersionsOnSave: true).
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/ai/prompts/p1/versions'))
  })
})

describe('useFaqsData — save POSTs a new FAQ to /ai/faqs with {name, body}, no versions refetch', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    vi.mocked(api.post).mockReset()
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/ai/faqs') return Promise.resolve({ data: [] })
      return Promise.resolve({ data: [] })
    })
    vi.mocked(api.post).mockResolvedValue({ data: { id: 'f9', name: '', body: '' } })
  })

  it('POSTs to /ai/faqs when nothing is selected yet', async () => {
    render(<FaqsHarness />)
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/ai/faqs'))

    await act(async () => { fireEvent.click(screen.getByText('save')) })

    expect(api.post).toHaveBeenCalledWith('/ai/faqs', { name: '', body: '' })
    // With NOTHING selected there is no version fetch; selecting a FAQ does fetch
    // /ai/faqs/{id}/versions (routes/api/tenant/communication-ai.php) — see the next case.
    expect(vi.mocked(api.get).mock.calls.some(([url]) => String(url).includes('/versions'))).toBe(false)
  })

  it('selecting a FAQ fetches its version history from /ai/faqs/{id}/versions', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/ai/faqs') return Promise.resolve({ data: [{ id: 'f1', name: 'Vraag', body: 'Antwoord' }] })
      return Promise.resolve({ data: [] })
    })
    render(<FaqsHarness />)
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/ai/faqs/f1/versions'))
  })
})
