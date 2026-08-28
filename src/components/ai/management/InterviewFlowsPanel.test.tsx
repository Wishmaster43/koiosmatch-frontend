import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import api from '@/lib/api'
import { FlowsTab } from '../AIManagementTabs'
import type { InterviewFlow } from '@/types/ai'

// FlowsTab fetches flows on mount and posts/puts/deletes through the same client.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

// The Flows tab gates mutations on settings.update (§7) — hold it true for these tests.
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: () => true }) }))

const mockFlow: InterviewFlow = {
  id: 'f1', name: 'Zorgintake', active: true,
  intro_template: 'Hoi!', system_prompt: 'Je bent Kelly.',
  statuses: ['INTRO_SENT', 'COMPLETED'],
  output_fields: { first_name: 'string' },
}

const renderWithQuery = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><FlowsTab /></QueryClientProvider>)
}

describe('FlowsTab — interview-flow CRUD (live BE contract /ai/interview-flows)', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset(); vi.mocked(api.post).mockReset()
    vi.mocked(api.put).mockReset(); vi.mocked(api.delete).mockReset()
    vi.mocked(api.get).mockImplementation((url: string) => {
      // The LIST is lean; selecting fetches the FULL flow behind show (B1).
      if (url === '/ai/interview-flows') return Promise.resolve({ data: [{ id: mockFlow.id, name: mockFlow.name, channel: mockFlow.channel, active: mockFlow.active }] })
      if (url === `/ai/interview-flows/${mockFlow.id}`) return Promise.resolve({ data: mockFlow })
      if (url === '/ai/agents') return Promise.resolve({ data: [] })
      return Promise.resolve({ data: [] })
    })
  })

  // Editing the name and saving must PUT the exact wire shape — statuses/output_fields
  // collapsed back from the editor's row state, channel fixed 'whatsapp' (§ contract).
  it('PUTs the flow with the collapsed wire shape on save', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: { ...mockFlow, name: 'Zorgintake v2' } })
    renderWithQuery()
    await waitFor(() => expect(screen.getByDisplayValue('Zorgintake')).toBeTruthy())

    fireEvent.change(screen.getByDisplayValue('Zorgintake'), { target: { value: 'Zorgintake v2' } })
    fireEvent.click(screen.getByRole('button', { name: /opslaan/i }))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/ai/interview-flows/f1', {
      name: 'Zorgintake v2',
      ai_agent_id: null,
      channel: 'whatsapp',
      system_prompt: 'Je bent Kelly.',
      statuses: ['INTRO_SENT', 'COMPLETED'],
      output_fields: { first_name: 'string' },
      intro_template: 'Hoi!',
      active: true,
    }))
  })

  // A 422 on delete means the flow is still bound (in-use protection,
  // in-use message must show, and the flow must stay in the list (no optimistic removal).
  it('surfaces the in-use message on a 422 delete and keeps the flow listed', async () => {
    vi.mocked(api.delete).mockRejectedValue({ response: { status: 422, data: { message: 'Flow is in gebruik.' } } })
    renderWithQuery()
    await waitFor(() => expect(screen.getByDisplayValue('Zorgintake')).toBeTruthy())

    // Two "Verwijderen" (delete) buttons render: the list row's and the panel
    // header's — the panel header one (second) opens the confirm dialog.
    const deleteButtons = screen.getAllByRole('button', { name: /verwijderen/i })
    fireEvent.click(deleteButtons[1])
    // House confirm dialog: confirm the destructive action (default confirmLabel, distinct from "Verwijderen").
    const confirmBtn = await screen.findByRole('button', { name: /bevestigen|confirm/i })
    fireEvent.click(confirmBtn)

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/ai/interview-flows/f1'))
    expect(screen.getByDisplayValue('Zorgintake')).toBeTruthy()
  })
})
