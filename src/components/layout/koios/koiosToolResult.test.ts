import { describe, it, expect } from 'vitest'
import { createdRefFromToolResult } from './koiosToolResult'

describe('createdRefFromToolResult', () => {
  it('KOIOS-TOOL-RESULT-KEYS-1 phase 2: a Dutch-keyed create_task result (the pre-rename shape) links nothing', () => {
    expect(createdRefFromToolResult({ gelukt: true, taak_id: 't-1', titel: 'Bel Sem Timmermans', deadline: null }, 'Taak')).toBeNull()
  })

  it('KOIOS-TOOL-RESULT-KEYS-1 phase 2: reads the English keys and ignores Dutch twins that still ride along', () => {
    expect(createdRefFromToolResult({ ok: true, gelukt: true, task_id: 't-2', taak_id: 't-1', title: 'Call Sem', titel: 'Bel Sem' }, 'Task'))
      .toEqual({ type: 'task', id: 't-2', label: 'Call Sem' })
  })

  it('KOIOS-TOOL-RESULT-KEYS-1: an English-only create_task result (no Dutch twins at all) links the task', () => {
    expect(createdRefFromToolResult({ ok: true, task_id: 't-3', title: 'Call Sem', due_date: null }, 'Task'))
      .toEqual({ type: 'task', id: 't-3', label: 'Call Sem' })
  })

  it('KOIOS-EN-1 phase B: an English-only refusal (ok: false) links nothing', () => {
    expect(createdRefFromToolResult({ ok: false, task_id: 't-2' }, 'x')).toBeNull()
  })

  it('falls back to the given label without a title, and links nothing on a refusal or a foreign shape', () => {
    expect(createdRefFromToolResult({ task_id: 7 }, 'Taak aangemaakt')).toEqual({ type: 'task', id: '7', label: 'Taak aangemaakt' })
    expect(createdRefFromToolResult({ gelukt: false, task_id: 't-1' }, 'x')).toBeNull()
    expect(createdRefFromToolResult({ kandidaten: [] }, 'x')).toBeNull()
    expect(createdRefFromToolResult(undefined, 'x')).toBeNull()
  })
})

// CALLLIST-KEY-1: create_call_list's renamed English keys (bellijst_id → call_list_id,
// naam → name) map onto a calllist deep-link ref — the task branch is unaffected.
describe('createdRefFromToolResult · calllist (CALLLIST-KEY-1)', () => {
  it('maps a create_call_list result onto a calllist deep-link ref with its name', () => {
    expect(createdRefFromToolResult({ ok: true, call_list_id: 'cl-1', name: 'Bellijst Noord', reused: false }, 'Bellijst'))
      .toEqual({ type: 'calllist', id: 'cl-1', label: 'Bellijst Noord' })
  })

  it('still maps a REUSED list (reused: true is a valid created-record chip)', () => {
    expect(createdRefFromToolResult({ ok: true, call_list_id: 'cl-1', name: 'Bellijst Noord', reused: true }, 'Bellijst'))
      .toEqual({ type: 'calllist', id: 'cl-1', label: 'Bellijst Noord' })
  })

  it('a bellijst_id/naam-only payload (pre-CALLLIST-KEY-1 shape) links nothing: keys are English-only', () => {
    expect(createdRefFromToolResult({ gelukt: true, bellijst_id: 'cl-2', naam: 'Bellijst Oost' }, 'Bellijst')).toBeNull()
  })

  it('falls back to the given label without a name, and links nothing on a refusal', () => {
    expect(createdRefFromToolResult({ call_list_id: 'cl-3' }, 'Bellijst aangemaakt')).toEqual({ type: 'calllist', id: 'cl-3', label: 'Bellijst aangemaakt' })
    expect(createdRefFromToolResult({ ok: false, call_list_id: 'cl-3' }, 'x')).toBeNull()
  })

  it('a task-shaped result is still unaffected by the new calllist branch', () => {
    expect(createdRefFromToolResult({ ok: true, task_id: 't-9', title: 'Bel' }, 'x')).toEqual({ type: 'task', id: 't-9', label: 'Bel' })
  })
})
