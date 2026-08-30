/**
 * configPanelAgentFallback.test — MODULE-TERUG-1 (Danny 31-08): the ai_agent
 * step's `agent` field is the pre-P1 NAME-valued lookup again. A stored config
 * renders its agent name, and picking a new agent writes the NAME through the
 * one plain onUpdate path — no agent_id dual-write (that P1 rename is parked
 * until Danny approves it). Real i18n is not initialized here (mirrors
 * configPanelWaWeb.test.tsx), so field labels render as the schema's literal
 * (Dutch) label text.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react'
import ConfigPanel from './ConfigPanel'
import type { FlowNode } from '@/types/workflow'

// The GET /ai/agents lookup this field reads for its options.
vi.mock('@/lib/api', () => ({
  default: { get: (endpoint: string) => Promise.resolve(
    endpoint === '/ai/agents'
      ? { data: [{ id: 'a-1', name: 'Kelly' }, { id: 'a-2', name: 'Michelle' }] }
      : { data: [] },
  ) },
  unwrap: (res: { data: unknown }) => res.data,
  unwrapList: (res: { data: unknown }) => {
    const body = Array.isArray(res.data) ? res.data : []
    return { rows: body, total: body.length, page: 1, lastPage: 1, perPage: body.length }
  },
}))

function openAgentSelect() {
  const wrapper = screen.getByText('AI-agent', { selector: 'label' }).closest('div')!
  fireEvent.click(within(wrapper).getByRole('button'))
}

const node: FlowNode = { id: 'n1', position: { x: 0, y: 0 }, data: { type: 'ai_agent', config: { agent: 'Kelly' } } }

describe('ConfigPanel · ai_agent name-valued agent field (MODULE-TERUG-1)', () => {
  it('shows the stored config.agent name', () => {
    render(<ConfigPanel node={node} onUpdate={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('Kelly')).toBeInTheDocument()
  })

  it('picking a new agent writes the NAME to `agent` — and never an agent_id', async () => {
    const onUpdate = vi.fn()
    render(<ConfigPanel node={node} onUpdate={onUpdate} onDelete={vi.fn()} />)
    openAgentSelect()
    const opt = await screen.findByText('Michelle')
    fireEvent.click(opt)
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith('n1', 'agent', 'Michelle'))
    const keys = onUpdate.mock.calls.map(c => c[1])
    expect(keys).not.toContain('agent_id')
  })
})
