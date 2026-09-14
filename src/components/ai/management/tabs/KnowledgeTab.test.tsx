/**
 * KnowledgeTab — save posts/puts through the exact URL and body, including the
 * AUDIENCE-FE-1 `audience` field (§13: mutation tests assert method/route/body).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import api from '@/lib/api'
import { KnowledgeTab } from './KnowledgeTab'

// KnowledgeTab fetches on mount and posts/puts through the same client on save —
// stub the whole default client (keep unwrap/unwrapList real).
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

describe('KnowledgeTab — save POSTs/PUTs with {name, body, audience}', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    vi.mocked(api.post).mockReset()
    vi.mocked(api.put).mockReset()
  })

  it('POSTs a new item to /ai/knowledge with the default audience "both"', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/ai/knowledge') return Promise.resolve({ data: [] })
      return Promise.resolve({ data: [] })
    })
    vi.mocked(api.post).mockResolvedValue({ data: { id: 'k9', name: '', body: '', audience: 'both' } })
    render(<KnowledgeTab />)
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/ai/knowledge'))

    await act(async () => { fireEvent.click(screen.getByText('Opslaan')) })

    expect(api.post).toHaveBeenCalledWith('/ai/knowledge', { name: '', body: '', audience: 'both' })
  })

  it('preselects the served audience and PUTs it back verbatim on save', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/ai/knowledge') return Promise.resolve({ data: [{ id: 'k1', name: 'Verlofbeleid', body: 'Regels...', audience: 'internal' }] })
      return Promise.resolve({ data: [] })
    })
    vi.mocked(api.put).mockResolvedValue({ data: { id: 'k1', name: 'Verlofbeleid', body: 'Regels...', audience: 'internal' } })
    render(<KnowledgeTab />)
    await waitFor(() => expect(screen.getByDisplayValue('Verlofbeleid')).toBeInTheDocument())

    await act(async () => { fireEvent.click(screen.getByText('Opslaan')) })

    expect(api.put).toHaveBeenCalledWith('/ai/knowledge/k1', { name: 'Verlofbeleid', body: 'Regels...', audience: 'internal' })
  })
})
