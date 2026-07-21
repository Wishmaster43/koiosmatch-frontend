import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import api from '@/lib/api'
import { AgentForm } from './AgentForm'
import type { AiAgent, AiItem } from '@/types/ai'

// AgentForm fetches the tenant's WhatsApp templates on mount and PUTs the whole form
// on save — stub the whole default client (keep unwrap/unwrapList real), mirrors the
// mocking pattern already used in AIManagementTabs.test.tsx for this same module.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

// A saved agent shaped like the real GET /ai/agents response (WA_INTRO_TEMPLATE-1
// contract — CMBE has landed wa_intro_template/faq_ids/use_knowledge as real fields).
const mockAgent: AiAgent = {
  id: 'a1', name: 'Kelly',
  prompt_id: '', faq_ids: [], use_knowledge: false, max_history: 10,
  wa_intro_template: '',
}

const mockFaqs: AiItem[] = [
  { id: 'f1', name: 'Openingstijden' },
  { id: 'f2', name: 'Vergoeding' },
]

// Shaped like GET /whatsapp-templates (WaTemplateOption) — approved templates only.
const mockTemplates = [
  { value: 'welcome_nl', label: 'welcome_nl (nl)' },
  { value: 'welcome_en', label: 'welcome_en (en)' },
]

describe('AgentForm — WhatsApp intro template picker + FAQ/knowledge (WA_INTRO_TEMPLATE-1)', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    vi.mocked(api.put).mockReset()
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/whatsapp-templates') return Promise.resolve({ data: { data: mockTemplates } })
      return Promise.resolve({ data: [] })
    })
    vi.mocked(api.put).mockResolvedValue({ data: mockAgent })
  })

  it('shows the synced WhatsApp templates and PUTs the chosen wa_intro_template', async () => {
    render(<AgentForm agent={mockAgent} prompts={[]} faqs={mockFaqs} onSaved={vi.fn()} onDelete={vi.fn()} />)

    // Real templates load from GET /whatsapp-templates — never a hardcoded name.
    const select = await screen.findByDisplayValue('— Geen template —')
    fireEvent.change(select, { target: { value: 'welcome_nl' } })

    fireEvent.click(screen.getByRole('button', { name: 'Opslaan' }))

    await waitFor(() => expect(api.put).toHaveBeenCalled())
    const [url, body] = vi.mocked(api.put).mock.calls[0]
    expect(url).toBe('/ai/agents/a1')
    expect((body as Record<string, unknown>).wa_intro_template).toBe('welcome_nl')
  })

  it('shows a calm empty state when no WhatsApp templates are synced', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/whatsapp-templates') return Promise.resolve({ data: { data: [] } })
      return Promise.resolve({ data: [] })
    })
    render(<AgentForm agent={mockAgent} prompts={[]} faqs={[]} onSaved={vi.fn()} onDelete={vi.fn()} />)

    expect(await screen.findByText('Geen goedgekeurde templates gevonden. Controleer de WhatsApp-koppeling.')).toBeInTheDocument()
  })

  it('toggles the knowledge switch and a FAQ chip, and PUTs both fields', async () => {
    render(<AgentForm agent={mockAgent} prompts={[]} faqs={mockFaqs} onSaved={vi.fn()} onDelete={vi.fn()} />)
    await screen.findByText('Openingstijden')

    fireEvent.click(screen.getByRole('switch'))
    fireEvent.click(screen.getByText('Openingstijden'))
    fireEvent.click(screen.getByRole('button', { name: 'Opslaan' }))

    await waitFor(() => expect(api.put).toHaveBeenCalled())
    const [, body] = vi.mocked(api.put).mock.calls[0]
    expect((body as Record<string, unknown>).use_knowledge).toBe(true)
    expect((body as Record<string, unknown>).faq_ids).toEqual(['f1'])
  })
})
