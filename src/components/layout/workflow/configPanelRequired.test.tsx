/**
 * configPanelRequired.test — SCHERMWAARHEID-1: `required: true` used to be
 * display-only on the ai_agent tab path; the settings path silently dropped the
 * asterisk. whatsapp_send's new `channel` field (required, no default) proves
 * both: the asterisk renders and a required-but-empty select shows the hint.
 * Real i18n is not initialized here (mirrors WorkflowEditorHeader.test.tsx), so
 * `t()` returns the raw key.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ConfigPanel from './ConfigPanel'
import type { FlowNode } from '@/types/workflow'

const node: FlowNode = {
  id: 'n1', position: { x: 0, y: 0 },
  data: { type: 'whatsapp_send', config: {} },
}

describe('ConfigPanel · required-field honesty on the settings tab', () => {
  it('renders the asterisk next to a required field label', () => {
    render(<ConfigPanel node={node} onUpdate={vi.fn()} onDelete={vi.fn()} />)
    // 'channel' is required — its label row carries the '*' marker.
    expect(screen.getByText('*')).toBeInTheDocument()
  })

  it('shows the required hint under a required field that is still empty', () => {
    render(<ConfigPanel node={node} onUpdate={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('fields.requiredHint')).toBeInTheDocument()
  })

  it('hides the required hint once the field carries a value', () => {
    const filled: FlowNode = { ...node, data: { type: 'whatsapp_send', config: { channel: 'waba' } } }
    render(<ConfigPanel node={filled} onUpdate={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.queryByText('fields.requiredHint')).not.toBeInTheDocument()
  })
})
