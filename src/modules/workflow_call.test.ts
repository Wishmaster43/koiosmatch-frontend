/**
 * workflow_call registry — K-254 (WF-RELATIONS-FE-2) pins the four config
 * fields added to App\Workflow\Modules\WorkflowCallModule::configSchema()
 * (mode/fail_on_child_error/pass_bundle/payload): the exact keys, the
 * mode select's queue/sync options, and default/type per field — mirrored
 * 1:1 from the backend schema. The one deliberate exception is
 * fail_on_child_error's `showIf: { key: 'mode', value: 'sync' }`: the
 * backend's configSchema carries NO show_if there (it only says "Alleen bij
 * direct uitvoeren" in its hint), so this is an FE-only visibility gate, not
 * a mirrored backend field — pinned here so it stays a deliberate choice.
 */
import { describe, it, expect } from 'vitest'
import workflowCall from './workflow_call'

const byKey = (key: string) => workflowCall.schema.find(f => f.key === key)

describe('workflow_call registry', () => {
  it('carries the five backend config keys, workflow_id first', () => {
    expect(workflowCall.schema.map(f => f.key)).toEqual([
      'workflow_id', 'mode', 'fail_on_child_error', 'pass_bundle', 'payload',
    ])
  })

  it('mode is a select with the exact queue/sync options', () => {
    const mode = byKey('mode')
    expect(mode?.type).toBe('select')
    expect(mode?.options).toEqual(['queue', 'sync'])
  })

  it('fail_on_child_error is a boolean defaulting to true, gated on sync mode', () => {
    const field = byKey('fail_on_child_error')
    expect(field?.type).toBe('boolean')
    expect(field?.default).toBe(true)
    expect(field?.showIf).toEqual({ key: 'mode', value: 'sync' })
  })

  it('pass_bundle is a plain boolean with no showIf (backend schema carries none)', () => {
    const field = byKey('pass_bundle')
    expect(field?.type).toBe('boolean')
    expect(field?.showIf).toBeUndefined()
  })

  it('payload is a keyvalue field', () => {
    expect(byKey('payload')?.type).toBe('keyvalue')
  })
})
