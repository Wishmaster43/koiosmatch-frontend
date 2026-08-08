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

// Shared baseline mocks — file-level so every describe block below (including the
// masked-API-key one) gets a working GET /whatsapp-templates + PUT before its own
// test runs, not just the first describe (a per-describe beforeEach does NOT apply
// to sibling describes).
beforeEach(() => {
  vi.mocked(api.get).mockReset()
  vi.mocked(api.put).mockReset()
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/whatsapp-templates') return Promise.resolve({ data: { data: mockTemplates } })
    return Promise.resolve({ data: [] })
  })
  vi.mocked(api.put).mockResolvedValue({ data: mockAgent })
})

describe('AgentForm — WhatsApp intro template picker + FAQ/knowledge (WA_INTRO_TEMPLATE-1)', () => {
  // G34: the template picker is the house CreatableSelect (a <button>+popover), not
  // a native <select> — open it by its labelled accessible name and click the
  // wanted option row instead of firing a `change` event on a <select>.
  it('shows the synced WhatsApp templates and PUTs the chosen wa_intro_template', async () => {
    render(<AgentForm agent={mockAgent} prompts={[]} faqs={mockFaqs} onSaved={vi.fn()} onDelete={vi.fn()} />)

    // Real templates load from GET /whatsapp-templates — never a hardcoded name.
    const trigger = await screen.findByRole('button', { name: /WhatsApp-intro-template/ })
    fireEvent.click(trigger)
    fireEvent.click(await screen.findByRole('button', { name: 'welcome_nl (nl)' }))

    fireEvent.click(screen.getByRole('button', { name: 'Opslaan' }))

    await waitFor(() => expect(api.put).toHaveBeenCalled())
    const [url, body] = vi.mocked(api.put).mock.calls[0]
    expect(url).toBe('/ai/agents/a1')
    expect((body as Record<string, unknown>).wa_intro_template).toBe('welcome_nl')
  })

  it('is no longer a native <select> — the prompt and WA-template fields are the house CreatableSelect', async () => {
    const { container } = render(<AgentForm agent={mockAgent} prompts={[]} faqs={mockFaqs} onSaved={vi.fn()} onDelete={vi.fn()} />)
    await screen.findByRole('button', { name: /WhatsApp-intro-template/ })
    expect(container.querySelector('select')).toBeNull()
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

// Security audit finding D: the custom-LLM API key is write-only — the stored key
// must never round-trip back into the form, and a save must only send a NEW value
// the user actually typed (never the untouched masked placeholder).
describe('AgentForm — masked custom API key (write-only, security audit finding D)', () => {
  it('shows the "set" badge for an existing key, never prefilling the real value, and omits it from an untouched save', async () => {
    const agentWithKey: AiAgent = { ...mockAgent, has_custom_api_key: true }
    render(<AgentForm agent={agentWithKey} prompts={[]} faqs={[]} onSaved={vi.fn()} onDelete={vi.fn()} />)

    // The custom-API section auto-opens because a key is already configured; the
    // input starts empty — only the "✓ ingesteld" badge signals a stored key.
    const input = await screen.findByPlaceholderText('Laat leeg om de huidige sleutel te behouden') as HTMLInputElement
    expect(input.value).toBe('')
    expect(screen.getByText('✓ ingesteld')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Opslaan' }))

    await waitFor(() => expect(api.put).toHaveBeenCalled())
    const [, body] = vi.mocked(api.put).mock.calls[0]
    expect(body as Record<string, unknown>).not.toHaveProperty('custom_api_key')
  })

  it('sends the new key only when the user actually types one', async () => {
    const agentWithKey: AiAgent = { ...mockAgent, has_custom_api_key: true }
    render(<AgentForm agent={agentWithKey} prompts={[]} faqs={[]} onSaved={vi.fn()} onDelete={vi.fn()} />)

    const input = await screen.findByPlaceholderText('Laat leeg om de huidige sleutel te behouden')
    fireEvent.change(input, { target: { value: 'sk-new-secret' } })
    fireEvent.click(screen.getByRole('button', { name: 'Opslaan' }))

    await waitFor(() => expect(api.put).toHaveBeenCalled())
    const [, body] = vi.mocked(api.put).mock.calls[0]
    expect((body as Record<string, unknown>).custom_api_key).toBe('sk-new-secret')
  })

  it('never prefills the input from a plain custom_api_key field either (write-only contract)', async () => {
    // Defensive: even if a stale/legacy payload carried the real key, the form must
    // not echo it back into the input — only has_custom_api_key drives the UI.
    const agentWithLegacyField = { ...mockAgent, custom_endpoint: 'https://api.example.com/v1', custom_api_key: 'sk-leaked' } as AiAgent
    render(<AgentForm agent={agentWithLegacyField} prompts={[]} faqs={[]} onSaved={vi.fn()} onDelete={vi.fn()} />)

    const input = await screen.findByPlaceholderText('sk-...') as HTMLInputElement
    expect(input.value).toBe('')
  })
})

// Audit 2026-07-28: a failed save used to hit an empty `catch {}` — no toast, no
// visible change at all, so a recruiter editing an agent's config had no signal
// their edit was lost. Assert the real failure now surfaces the same way every
// other mutation in this module does.
describe('AgentForm — save failure must notify (was a silent catch)', () => {
  it('toasts an error and never shows the saved confirmation when PUT rejects', async () => {
    vi.mocked(api.put).mockRejectedValue(new Error('network error'))
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')

    render(<AgentForm agent={mockAgent} prompts={[]} faqs={[]} onSaved={vi.fn()} onDelete={vi.fn()} />)
    await screen.findByDisplayValue('Kelly')

    fireEvent.click(screen.getByRole('button', { name: 'Opslaan' }))

    await waitFor(() => expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
      detail: { type: 'error', message: 'Actie mislukt — probeer het opnieuw.' },
    })))
    expect(screen.queryByText('Opgeslagen')).toBeNull()
  })
})

// Audit 2026-07-28 (§6 icon-only buttons need an accessible name): the delete-agent
// button in the form header used to render a bare Trash2 icon with no aria-label/title.
describe('AgentForm — delete button accessible name', () => {
  it('exposes an accessible name on the icon-only delete button', async () => {
    render(<AgentForm agent={mockAgent} prompts={[]} faqs={[]} onSaved={vi.fn()} onDelete={vi.fn()} />)
    await screen.findByDisplayValue('Kelly')
    expect(screen.getByRole('button', { name: 'Verwijderen' })).toBeInTheDocument()
  })
})
