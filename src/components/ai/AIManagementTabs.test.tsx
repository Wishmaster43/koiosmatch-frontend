import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import api from '@/lib/api'
import { AgentsTab } from './AIManagementTabs'
import type { AiAgent } from '@/types/ai'

// AgentsTab fetches agents/prompts/faqs on mount and posts/puts through the same
// client on save — stub the whole default client (keep unwrap/unwrapList real).
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

// One agent shaped like the real GET /ai/agents response (AI-AGENTS-2/3, BE commit
// 4449103): the linked recruiter user, the carried interview flow, and its webhook.
const mockAgent: AiAgent = {
  id: 'a1',
  name: 'Kelly',
  prompt_id: '', faq_ids: [], use_knowledge: true, max_history: 30,
  user: { id: 'u1', name: 'Kelly Jansen' },
  interview_flow: {
    id: 'f1', name: 'Zorgintake (9 stappen)', active: true,
    intro_template: 'Hoi {{first_name}}!',
    system_prompt: 'Je bent Kelly, recruiter bij Yesway...',
    statuses: ['INTRO_SENT', 'COMPLETED'],
    output_fields: { first_name: 'string', city: 'string' },
  },
  webhook_url: 'https://koiosmatch-api.test/api/ai/webhook/tenant-1/abc123token',
}

describe('AgentsTab — AI-AGENTS-2/3 fields', () => {
  // jsdom has no clipboard API by default — stub it so the copy button is testable.
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    vi.mocked(api.post).mockReset()
    vi.mocked(api.put).mockReset()
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/ai/agents') return Promise.resolve({ data: [mockAgent] })
      return Promise.resolve({ data: [] })
    })
  })

  it('renders the linked recruiter, the carried interview flow, and the webhook URL from GET /ai/agents', async () => {
    render(<AgentsTab />)

    // Linked recruiter — same name in the list row and the form header (same Avatar component).
    expect((await screen.findAllByText('Kelly Jansen')).length).toBeGreaterThanOrEqual(2)

    // Interview flow section — name + active badge (nl: "Actief") + intro text + statuses
    // + dossier fields. This test tree pulls in lib/datetime (VersionList), which loads the
    // real i18n runtime — so assertions use the actual translated nl copy, not raw keys.
    expect(screen.getByText('Zorgintake (9 stappen)')).toBeInTheDocument()
    expect(screen.getByText('Actief')).toBeInTheDocument()
    expect(screen.getByText('Hoi {{first_name}}!')).toBeInTheDocument()
    expect(screen.getByText('INTRO_SENT')).toBeInTheDocument()
    expect(screen.getByText('COMPLETED')).toBeInTheDocument()
    expect(screen.getByText('first_name')).toBeInTheDocument()
    expect(screen.getByText('city')).toBeInTheDocument()

    // The system prompt is collapsed by default, then reveals on click (no fake affordance).
    expect(screen.queryByText(/Je bent Kelly/)).toBeNull()
    fireEvent.click(screen.getByText('Toon systeemprompt'))
    expect(screen.getByText(/Je bent Kelly/)).toBeInTheDocument()

    // Webhook URL — read-only row.
    expect(screen.getByText(mockAgent.webhook_url as string)).toBeInTheDocument()
  })

  it('copies the webhook URL to the clipboard and fires a success toast', async () => {
    render(<AgentsTab />)
    await screen.findByText(mockAgent.webhook_url as string)

    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    fireEvent.click(screen.getByRole('button', { name: 'Kopieer webhook-URL' }))

    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockAgent.webhook_url))
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
      detail: { type: 'success', message: 'Webhook-URL gekopieerd' },
    }))
  })

  it('never sends a model key when saving an agent (MODEL-1 — the per-agent picker is gone)', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: mockAgent })
    render(<AgentsTab />)
    await screen.findByText('Zorgintake (9 stappen)')

    fireEvent.click(screen.getByRole('button', { name: 'Opslaan' }))

    await waitFor(() => expect(api.put).toHaveBeenCalled())
    const [url, body] = vi.mocked(api.put).mock.calls[0]
    expect(url).toBe('/ai/agents/a1')
    expect(body).not.toHaveProperty('model')
    expect(Object.keys(body as object)).toEqual(expect.arrayContaining([
      'name', 'prompt_id', 'faq_ids', 'use_knowledge', 'max_history', 'custom_endpoint', 'custom_api_key',
    ]))
  })
})
