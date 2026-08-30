/**
 * configPanelInstructionList.test — INTERVIEW-WORKFLOW-1 render seam: the
 * ai_agent step's config panel really renders the instruction-list control
 * (not just the schema object) and a row edit really reaches the node's
 * config.instructions through the SAME onUpdate path every other field uses.
 * Real i18n is not initialized here (mirrors configPanelRequired.test.tsx), so
 * `t()` returns the raw key.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ConfigPanel from './ConfigPanel'
import type { FlowNode } from '@/types/workflow'

const node: FlowNode = {
  id: 'n1', position: { x: 0, y: 0 },
  data: {
    type: 'ai_agent',
    config: {
      instructions: [
        { id: 'q1', text: 'Wat is je naam?', required: true },
      ],
    },
  },
}

describe('ConfigPanel · ai_agent instruction list', () => {
  it('renders the instruction-list control on its OWN tab (Danny 31-08), not on Standaard', () => {
    render(<ConfigPanel node={node} onUpdate={vi.fn()} onDelete={vi.fn()} />)
    // Standaard (the default tab) no longer carries the list.
    expect(screen.queryByText('fields.instructionAdd')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('config.tabInstructions'))
    // The list's own "add" affordance proves the control mounted (not a plain textarea).
    expect(screen.getByText('fields.instructionAdd')).toBeInTheDocument()
    // One stored row → one required-toggle switch.
    expect(screen.getAllByRole('switch').length).toBeGreaterThanOrEqual(1)
  })

  it('adding a row persists through the same onUpdate(nodeId, key, val) contract every field uses', () => {
    const onUpdate = vi.fn()
    render(<ConfigPanel node={node} onUpdate={onUpdate} onDelete={vi.fn()} />)
    fireEvent.click(screen.getByText('config.tabInstructions'))
    fireEvent.click(screen.getByText('fields.instructionAdd'))
    expect(onUpdate).toHaveBeenCalledTimes(1)
    const [nodeId, key, val] = onUpdate.mock.calls[0]
    expect(nodeId).toBe('n1')
    expect(key).toBe('instructions')
    expect(Array.isArray(val)).toBe(true)
    expect((val as Array<{ id: string }>)).toHaveLength(2)
    expect((val as Array<{ id: string }>)[0].id).toBe('q1')
  })
})

// Danny 31-08: "de pijlen werken niet" — the REAL panel emits the swapped array
// through onUpdate when move-down is clicked on row 1 (asserting the order, not
// merely that a callback fired, §13).
describe('ConfigPanel · ai_agent instruction reorder emits the swapped order', () => {
  it('move-down on row 1 emits [q2, q1]', () => {
    const two: FlowNode = { ...node, data: { ...node.data, config: { instructions: [
      { id: 'q1', text: 'EEN', required: false }, { id: 'q2', text: 'TWEE', required: false },
    ] } } }
    const onUpdate = vi.fn()
    render(<ConfigPanel node={two} onUpdate={onUpdate} onDelete={vi.fn()} />)
    fireEvent.click(screen.getByText('config.tabInstructions'))
    fireEvent.click(screen.getAllByRole('button', { name: 'fields.moveDown' })[0])
    const [, key, val] = onUpdate.mock.calls.at(-1)!
    expect(key).toBe('instructions')
    expect((val as Array<{ id: string }>).map(r => r.id)).toEqual(['q2', 'q1'])
  })
})

