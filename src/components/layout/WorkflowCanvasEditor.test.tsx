/**
 * WorkflowCanvasEditor · CurrentWorkflowContext root wiring (EDITOR-SMALL-
 * FOLLOWUPS-1). workflowSelectField.test.tsx already proves the field control's
 * OWN self-exclusion logic in isolation (a manually supplied context value);
 * this test proves the wiring from the editor ROOT actually reaches it — the
 * editor really provides `CurrentWorkflowContext` with THIS workflow's own id
 * (WF-PICKER-SELF-1), not just the field in a vacuum.
 *
 * @xyflow/react's DOM-heavy render pieces (ReactFlow/Background/Controls/
 * MiniMap/ReactFlowProvider) are swapped for a light node-click stub; the real
 * `useNodesState`/`useEdgesState`/`addEdge` stay in place (importOriginal),
 * mirroring canvas.test.tsx's own partial-mock technique — so the real
 * selection state machine in useWorkflowEditor drives ConfigPanel exactly as
 * in the app. Unlike workflowSelectField.test.tsx, this file's import graph
 * DOES self-initialize real i18next (via the editor's other deps), so
 * assertions target the real nl copy, not raw keys.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import WorkflowCanvasEditor from './WorkflowCanvasEditor'
import type { Workflow } from '@/types/workflow'
import api from '@/lib/api'

// useWorkflowRun (live-run polling) needs a QueryClient in its tree.
function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

vi.mock('@xyflow/react', async importOriginal => {
  const actual = await importOriginal<typeof import('@xyflow/react')>()
  return {
    ...actual,
    ReactFlowProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
    // A node is a plain clickable button standing in for the real canvas node —
    // clicking it fires the SAME onNodeClick the app wires to node selection.
    ReactFlow: ({ nodes, onNodeClick }: {
      nodes: Array<{ id: string }>
      onNodeClick?: (e: unknown, n: { id: string }) => void
    }) => (
      <div>
        {nodes.map(n => (
          <button key={n.id} type="button" onClick={() => onNodeClick?.(null, n)}>{`node-${n.id}`}</button>
        ))}
      </div>
    ),
    Background: () => null,
    Controls: () => null,
    MiniMap: () => null,
  }
})

// Every network call the mounted editor fires (module catalog, run adoption,
// the workflow_call picker's own workflow list) — routed by URL so each
// resolves honestly instead of an unmocked call throwing mid-test.
vi.mock('@/lib/api', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return {
    ...actual,
    default: {
      get: vi.fn((url: string) => {
        if (url === '/workflows') return Promise.resolve({ data: [
          { id: 'wf-current', name: 'Deze workflow', archived: false },
          { id: 'wf-other', name: 'Andere workflow', archived: false },
        ] })
        if (url.endsWith('/runs')) return Promise.resolve({ data: [] })
        return Promise.resolve({ data: {} }) // /workflows/modules, /webhooks, …
      }),
      post: vi.fn(),
    },
  }
})

// One workflow_call node — its `workflow_id` field renders the searchable
// picker under test (WF-RELATIONS-1's schema, see src/modules/workflow_call.ts).
const workflow: Workflow = {
  id: 'wf-current', name: 'Deze workflow', status: 'draft',
  steps: [{ id: 'n1', type: 'workflow_call', config: {}, position: { x: 0, y: 0 } }],
}

beforeEach(() => vi.clearAllMocks())

describe('WorkflowCanvasEditor · CurrentWorkflowContext root wiring', () => {
  it('excludes the workflow being edited from its own workflow_call picker, keeping every other workflow', async () => {
    render(<WorkflowCanvasEditor workflow={workflow} onClose={vi.fn()} onSave={vi.fn()} />, { wrapper })

    // Select the workflow_call node → ConfigPanel renders its `workflow` field.
    fireEvent.click(await screen.findByText('node-n1'))
    // Open the searchable picker — the placeholder text is duplicated (the
    // trigger's own sr-only aria-label span carries the same string), so pick
    // the one actually inside the clickable <button>.
    const placeholders = await screen.findAllByText('Selecteer een workflow…')
    const trigger = placeholders.find(el => el.closest('button'))
    fireEvent.click(trigger!)

    expect(await screen.findByText('Andere workflow')).toBeInTheDocument()
    expect(screen.queryByText('Deze workflow')).not.toBeInTheDocument()
  })
})

// RUN-SAVES-FIRST-1 (Danny 10-09): Run on a dirty editor saves first in the same
// click; a refused save never posts the run.
describe('WorkflowCanvasEditor · Run saves first (RUN-SAVES-FIRST-1)', () => {
  const activeWorkflow: Workflow = { ...workflow, status: 'active' }

  it('flipping the status and pressing Run saves before the run is posted, with the flipped status in the payload', async () => {
    const calls: string[] = []
    const onSave = vi.fn(async () => { calls.push('save'); return true })
    ;(api.post as ReturnType<typeof vi.fn>).mockImplementation((url: string) => { calls.push('post ' + url); return Promise.resolve({ data: { run: { id: 'r1' } } }) })
    render(<WorkflowCanvasEditor workflow={workflow} onClose={vi.fn()} onSave={onSave} />, { wrapper })
    await screen.findByText('node-n1')
    // Draft → active on the pill (local only until saved), then Run.
    fireEvent.click(screen.getByText('Inactief').closest('button')!)
    expect(screen.getByText('(niet opgeslagen)', { exact: false })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Uitvoeren$/ }))
    await waitFor(() => expect(calls).toEqual(['save', 'post /workflows/wf-current/run']))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ status: 'active' }), false)
    await waitFor(() => expect(screen.queryByText('(niet opgeslagen)', { exact: false })).toBeNull())
  })

  it('a refused save stops the click: no run is posted', async () => {
    const onSave = vi.fn(async () => false)
    render(<WorkflowCanvasEditor workflow={activeWorkflow} onClose={vi.fn()} onSave={onSave} />, { wrapper })
    await screen.findByText('node-n1')
    fireEvent.click(screen.getByRole('textbox', { name: /naam|name/i }))
    fireEvent.change(screen.getByRole('textbox', { name: /naam|name/i }), { target: { value: 'Renamed' } })
    fireEvent.click(screen.getByRole('button', { name: /^Uitvoeren$/ }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(api.post).not.toHaveBeenCalled()
  })
})

// RUN-SAVES-FIRST-1 refinement: a draft flipped to active and back is a draft again,
// not an unsaved "inactive".
describe('WorkflowCanvasEditor · status pill flips back to the server status', () => {
  it('draft → active → back reads clean, without the unsaved suffix', async () => {
    render(<WorkflowCanvasEditor workflow={workflow} onClose={vi.fn()} onSave={vi.fn()} />, { wrapper })
    await screen.findByText('node-n1')
    const pill = () => screen.getByText(/Actief|Inactief/).closest('button')!
    fireEvent.click(pill())
    expect(pill()).toHaveTextContent('(niet opgeslagen)')
    fireEvent.click(pill())
    expect(pill()).not.toHaveTextContent('(niet opgeslagen)')
    expect(pill()).toHaveTextContent('Inactief')
  })
})
