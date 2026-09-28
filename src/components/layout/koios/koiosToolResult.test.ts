import { describe, it, expect } from 'vitest'
import { createdRefFromToolResult } from './koiosToolResult'

describe('createdRefFromToolResult', () => {
  it('maps a legacy (Dutch) create_task result onto a task deep-link ref with the task title', () => {
    expect(createdRefFromToolResult({ gelukt: true, taak_id: 't-1', titel: 'Bel Sem Timmermans', deadline: null }, 'Taak'))
      .toEqual({ type: 'task', id: 't-1', label: 'Bel Sem Timmermans' })
  })

  it('KOIOS-EN-1 phase B: prefers the English keys when both are present', () => {
    expect(createdRefFromToolResult({ ok: true, gelukt: true, task_id: 't-2', taak_id: 't-1', title: 'Call Sem', titel: 'Bel Sem' }, 'Task'))
      .toEqual({ type: 'task', id: 't-2', label: 'Call Sem' })
  })

  it('KOIOS-EN-1 phase B: an English-only refusal (ok: false) links nothing', () => {
    expect(createdRefFromToolResult({ ok: false, task_id: 't-2' }, 'x')).toBeNull()
  })

  it('falls back to the given label without a title, and links nothing on a refusal or a foreign shape', () => {
    expect(createdRefFromToolResult({ taak_id: 7 }, 'Taak aangemaakt')).toEqual({ type: 'task', id: '7', label: 'Taak aangemaakt' })
    expect(createdRefFromToolResult({ gelukt: false, taak_id: 't-1' }, 'x')).toBeNull()
    expect(createdRefFromToolResult({ kandidaten: [] }, 'x')).toBeNull()
    expect(createdRefFromToolResult(undefined, 'x')).toBeNull()
  })
})
