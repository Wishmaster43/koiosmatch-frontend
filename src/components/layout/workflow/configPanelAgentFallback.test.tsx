/**
 * configPanelAgentFallback.test — verdict findings 2 & 5: ai_agent's `agent_id`
 * field (a real id-valued lookup) falls back to displaying a legacy
 * name-valued `config.agent` for a step saved before the CMBE 2026-08-30
 * rename, and picking a NEW agent dual-writes both `agent_id` and the legacy
 * `agent` (name) key — the engine still resolves by the legacy name today
 * (AiAgentModule.php:154), see ai_agent.ts's docblock. Real i18n is not
 * initialized here (mirrors configPanelWaWeb.test.tsx), so `t()` returns the
 * raw key and field labels render as the schema's literal (Dutch) label text.
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

describe('ConfigPanel · ai_agent legacy `agent` display fallback', () => {
  it('shows the legacy name-valued config.agent when agent_id is absent', () => {
    render(<ConfigPanel node={node} onUpdate={vi.fn()} onDelete={vi.fn()} />)
    // CreatableSelect's trigger falls back to the raw stored value when nothing
    // in its (async, not-yet-loaded) options list matches it.
    expect(screen.getByText('Kelly')).toBeInTheDocument()
  })

  it('picking a new agent writes BOTH agent_id and the legacy agent name', async () => {
    const onUpdate = vi.fn()
    render(<ConfigPanel node={node} onUpdate={onUpdate} onDelete={vi.fn()} />)
    openAgentSelect()
    const opt = await screen.findByText('Michelle')
    fireEvent.click(opt)
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith('n1', 'agent_id', 'a-2'))
    expect(onUpdate).toHaveBeenCalledWith('n1', 'agent', 'Michelle')
  })
})
