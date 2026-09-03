/**
 * useWorkflowEditor — audit module-schema-reconcile-4 (CMBE 686d8b74): the inbound
 * webhook route and the event dispatcher match on the WORKFLOW's trigger_type +
 * trigger_config, never on the start card's own config. A graph that starts with the
 * webhook or applicant_event card must therefore persist that card as the trigger.
 * Same harness as useWorkflowEditor.test.tsx.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useWorkflowEditor } from './useWorkflowEditor'
import { deriveStartTrigger } from './workflowEditorUtils'
import type { Workflow, WorkflowStep } from '@/types/workflow'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn().mockResolvedValue({ data: { data: [] } }), post: vi.fn() } }
})

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const wf = (steps: WorkflowStep[]): Workflow =>
  ({ id: 'w1', name: 'My workflow', trigger: 'Manual', status: 'draft', steps })

function setup(steps: WorkflowStep[]) {
  const onSave = vi.fn()
  const r = renderHook(() => useWorkflowEditor({ workflow: wf(steps), onSave }), { wrapper })
  return { ...r, onSave }
}

beforeEach(() => vi.clearAllMocks())

describe('deriveStartTrigger (pure)', () => {
  it('maps the four applicant_event labels onto the dispatched keys', () => {
    expect(deriveStartTrigger([{ type: 'applicant_event', config: { event: 'nieuwe sollicitatie' } }]))
      .toEqual({ trigger: 'Event', triggerConfig: { event: 'application.created' } })
    // A stage change is filtered on a FLAG of the target stage (tenant slugs are not stable).
    expect(deriveStartTrigger([{ type: 'applicant_event', config: { event: 'afgewezen' } }]))
      .toEqual({ trigger: 'Event', triggerConfig: { event: 'application.stage_changed', conditions: { stage_flag: 'is_rejected' } } })
    expect(deriveStartTrigger([{ type: 'applicant_event', config: { event: 'aangenomen' } }]))
      .toEqual({ trigger: 'Event', triggerConfig: { event: 'application.stage_changed', conditions: { stage_flag: 'is_match' } } })
  })

  it('returns null for a webhook card without a picked webhook and for every other start card', () => {
    expect(deriveStartTrigger([{ type: 'webhook', config: {} }])).toBeNull()
    expect(deriveStartTrigger([{ type: 'candidates', config: {} }])).toBeNull()
    expect(deriveStartTrigger([])).toBeNull()
  })
})

describe('useWorkflowEditor · a webhook/applicant_event start card is saved as the trigger', () => {
  it('persists trigger Webhook + trigger_config.webhook_id from the start card', async () => {
    const { result, onSave } = setup([
      { id: 'n1', type: 'webhook', config: { webhook_id: 'wh-9' }, position: { x: 0, y: 180 }, next: [{ target: 'n2' }] },
      { id: 'n2', type: 'email', config: {}, position: { x: 220, y: 180 } },
    ])
    await waitFor(() => expect(result.current.edges).toHaveLength(1))
    act(() => result.current.handleSave())
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ trigger: 'Webhook', trigger_config: { webhook_id: 'wh-9' } }), false)
  })

  it('persists trigger Event + the dispatched event key from the applicant_event card', async () => {
    const { result, onSave } = setup([
      { id: 'n1', type: 'applicant_event', config: { event: 'fase gewijzigd' }, position: { x: 0, y: 180 } },
    ])
    await waitFor(() => expect(result.current.nodesWithFirst).toHaveLength(1))
    act(() => result.current.handleSave())
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ trigger: 'Event', trigger_config: { event: 'application.stage_changed' } }), false)
  })

  it('leaves the header trigger alone when the start card is an entity node', async () => {
    const { result, onSave } = setup([
      { id: 'n1', type: 'candidates', config: {}, position: { x: 0, y: 180 } },
    ])
    await waitFor(() => expect(result.current.nodesWithFirst).toHaveLength(1))
    act(() => result.current.handleSave())
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ trigger: 'Manual' }), false)
  })
})
