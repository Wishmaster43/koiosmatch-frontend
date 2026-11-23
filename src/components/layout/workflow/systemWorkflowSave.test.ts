/**
 * systemWorkflowSave (SYSWF-HIDE-FE-1): the body a system workflow accepts, the name-stripped snapshot
 * comparison that decides whether an editor change was dropped, and the save runner's two outcomes.
 */
import { describe, it, expect, vi } from 'vitest'
import { lockedSnapshotPart, saveSystemWorkflow, systemLockedPartChanged, systemWorkflowBody } from './systemWorkflowSave'
import type { Workflow } from '@/types/workflow'

const wf: Workflow = { id: 'w1', name: 'Sys', folder_id: 'f1', is_system: true, steps: [{ type: 'candidates' }] }

describe('systemWorkflowBody', () => {
  it('carries name and folder only, folder null when absent', () => {
    expect(systemWorkflowBody(wf)).toEqual({ name: 'Sys', folder_id: 'f1' })
    expect(systemWorkflowBody({ ...wf, folder_id: undefined })).toEqual({ name: 'Sys', folder_id: null })
  })
})

describe('lockedSnapshotPart / systemLockedPartChanged', () => {
  const snap = (name: string, steps: unknown[]) => JSON.stringify({ name, trigger: 'Manual', trigger_config: {}, status: 'active', steps, is_interview: false })

  it('a rename alone is not a locked change; a steps change is', () => {
    expect(systemLockedPartChanged(snap('Renamed', [{ type: 'a' }]), snap('Sys', [{ type: 'a' }]))).toBe(false)
    expect(systemLockedPartChanged(snap('Sys', [{ type: 'a' }, { type: 'b' }]), snap('Sys', [{ type: 'a' }]))).toBe(true)
  })

  it('strips only the name and compares a non-JSON snapshot as it is', () => {
    expect(lockedSnapshotPart(snap('X', []))).toBe(JSON.stringify({ trigger: 'Manual', trigger_config: {}, status: 'active', steps: [], is_interview: false }))
    expect(systemLockedPartChanged('raw-a', 'raw-a')).toBe(false)
    expect(systemLockedPartChanged('raw-a', 'raw-b')).toBe(true)
  })
})

describe('saveSystemWorkflow', () => {
  const deps = () => ({ put: vi.fn().mockResolvedValue({}), applyRow: vi.fn(), close: vi.fn(), fail: vi.fn() })

  it('PUTs the body, patches the row with it and closes only when asked', async () => {
    const d = deps()
    await expect(saveSystemWorkflow({ ...wf, name: 'Renamed' }, false, d)).resolves.toBe(true)
    expect(d.put).toHaveBeenCalledWith({ name: 'Renamed', folder_id: 'f1' })
    expect(d.applyRow).toHaveBeenCalledWith({ name: 'Renamed', folder_id: 'f1' })
    expect(d.close).not.toHaveBeenCalled()
    const d2 = deps()
    await saveSystemWorkflow(wf, true, d2)
    expect(d2.close).toHaveBeenCalledTimes(1)
  })

  it('a refused PUT goes to fail, applies nothing and resolves false', async () => {
    const d = deps()
    const err = { response: { status: 409, data: { code: 'system_workflow_locked' } } }
    d.put.mockRejectedValue(err)
    await expect(saveSystemWorkflow(wf, true, d)).resolves.toBe(false)
    expect(d.fail).toHaveBeenCalledWith(err)
    expect(d.applyRow).not.toHaveBeenCalled()
    expect(d.close).not.toHaveBeenCalled()
  })
})
