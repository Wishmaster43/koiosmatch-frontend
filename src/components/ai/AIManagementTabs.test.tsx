import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import api from '@/lib/api'
import { AgentsTab, PromptsTab, FAQTab, ToolsTab } from './AIManagementTabs'
import type { AiAgent, AiItem } from '@/types/ai'

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
    // RAW-ENUM-LEAK fix (HUISSTIJL-1 batch G): statuses now go through the
    // shared i18n-first lookup, so the real nl copy shows, not the raw enum.
    expect(screen.getByText('Intro verzonden')).toBeInTheDocument()
    expect(screen.getByText('Afgerond')).toBeInTheDocument()
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
    // custom_api_key is write-only (security audit finding D) — it is only ever
    // included when the user actually types a new value, never on an untouched save.
    expect(body).not.toHaveProperty('custom_api_key')
    expect(Object.keys(body as object)).toEqual(expect.arrayContaining([
      'name', 'prompt_id', 'faq_ids', 'use_knowledge', 'max_history', 'custom_endpoint',
    ]))
  })
})

// Audit 2026-07-28 (mutation lying about success, §3/§13): AgentsTab/PromptsTab/FAQTab's
// delete handlers used to remove the row from local state UNCONDITIONALLY after the
// DELETE call, even inside the .catch — so a failed delete still made the record vanish
// from the UI while it stayed live on the backend. Assert the REQUEST fires and that a
// failure leaves the row exactly where it was (never only that a callback ran).
describe('AgentsTab — delete failure must not remove the agent from the list', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    vi.mocked(api.delete).mockReset()
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/ai/agents') return Promise.resolve({ data: [mockAgent] })
      return Promise.resolve({ data: [] })
    })
  })
  afterEach(() => vi.restoreAllMocks())

  it('keeps the agent on screen and toasts an error when DELETE rejects', async () => {
    vi.mocked(api.delete).mockRejectedValue(new Error('network error'))
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')

    render(<AgentsTab />)
    // The agent's name also appears as the linked-recruiter sublabel, twice on screen.
    await screen.findAllByText('Kelly Jansen')

    // Two delete affordances exist for the same agent (the side-list row and the
    // detail panel's own delete button) — both call the same handler; either works.
    fireEvent.click(screen.getAllByRole('button', { name: 'Verwijderen' })[0])

    // The delete only fires after the house ConfirmDialog's own button is pressed —
    // never a bare window.confirm() (§0 restschuld cleanup).
    fireEvent.click(await screen.findByRole('button', { name: 'Bevestigen' }))

    // Wait for the actual async signal (the toast fired from the .catch) rather than
    // the synchronous call args — the delete call is recorded before its promise settles.
    await waitFor(() => expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
      detail: { type: 'error', message: 'Actie mislukt. Probeer het opnieuw.' },
    })))
    expect(api.delete).toHaveBeenCalledWith('/ai/agents/a1')
    // The row must still be there — a failed delete is not a silent success.
    expect(screen.getAllByText('Kelly Jansen').length).toBeGreaterThan(0)
  })
})

// Shared fixtures for the Prompts/FAQ delete-failure regressions below.
const mockPrompt: AiItem = { id: 'p1', name: 'Openingsbericht', body: 'Hoi!' }
const mockFaq: AiItem = { id: 'f1', name: 'Vergoeding' }

describe('PromptsTab — delete failure must not remove the prompt from the list', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    vi.mocked(api.delete).mockReset()
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/ai/prompts') return Promise.resolve({ data: [mockPrompt] })
      if (url === `/ai/prompts/${mockPrompt.id}/versions`) return Promise.resolve({ data: [] })
      return Promise.resolve({ data: [] })
    })
  })
  afterEach(() => vi.restoreAllMocks())

  it('keeps the prompt on screen and toasts an error when DELETE rejects', async () => {
    vi.mocked(api.delete).mockRejectedValue(new Error('network error'))
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')

    render(<PromptsTab />)
    await screen.findByText('Openingsbericht')

    fireEvent.click(screen.getByRole('button', { name: 'Verwijderen' }))
    // The delete only fires after the house ConfirmDialog's own button is pressed.
    fireEvent.click(await screen.findByRole('button', { name: 'Bevestigen' }))

    await waitFor(() => expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
      detail: { type: 'error', message: 'Actie mislukt. Probeer het opnieuw.' },
    })))
    expect(api.delete).toHaveBeenCalledWith('/ai/prompts/p1')
    expect(screen.getByText('Openingsbericht')).toBeInTheDocument()
  })
})

describe('FAQTab — delete failure must not remove the FAQ from the list', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    vi.mocked(api.delete).mockReset()
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/ai/faqs') return Promise.resolve({ data: [mockFaq] })
      return Promise.resolve({ data: [] })
    })
  })
  afterEach(() => vi.restoreAllMocks())

  it('keeps the FAQ on screen and toasts an error when DELETE rejects', async () => {
    vi.mocked(api.delete).mockRejectedValue(new Error('network error'))
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')

    render(<FAQTab />)
    await screen.findByText('Vergoeding')

    fireEvent.click(screen.getByRole('button', { name: 'Verwijderen' }))
    // The delete only fires after the house ConfirmDialog's own button is pressed.
    fireEvent.click(await screen.findByRole('button', { name: 'Bevestigen' }))

    await waitFor(() => expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
      detail: { type: 'error', message: 'Actie mislukt. Probeer het opnieuw.' },
    })))
    expect(api.delete).toHaveBeenCalledWith('/ai/faqs/f1')
    expect(screen.getByText('Vergoeding')).toBeInTheDocument()
  })
})

// Audit 2026-07-28 (fake affordance, §3): the tool checklist used to be a live toggle
// whose state never left the component (no `tools` field on AiAgent, no persistence
// route). It must now render as an honest, disabled, read-only list instead of a
// control that looks like it saves per-agent tool access.
describe('ToolsTab — read-only honest notice (no backend endpoint exists yet)', () => {
  it('shows the "not available" notice and renders every tool row as disabled', () => {
    render(<ToolsTab />)

    expect(screen.getByText('Nog niet gekoppeld aan een agent. Deze keuzes worden niet opgeslagen.')).toBeInTheDocument()
    expect(screen.getByText('Dienst opzoeken')).toBeInTheDocument()
    // No button/checkbox role anywhere — there is nothing left to click.
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
  })
})
