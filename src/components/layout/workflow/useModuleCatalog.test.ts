/**
 * useModuleCatalog.normalize — INTERVIEW-WORKFLOW-1 Appendix E (CMBE delta,
 * 30-08): GET /workflows/modules now serves the instruction_list output-field
 * allow-list at `schema.instructions.item_schema.output_field.options` (array
 * OR a plain {key: label} object), replacing the module-level
 * `instruction_output_fields` array. Both shapes normalize into the same flat
 * `instructionOutputFields`, and the served shape wins when both are present.
 */
import { describe, it, expect } from 'vitest'
import { normalize } from './useModuleCatalog'

describe('normalize · instructionOutputFields', () => {
  it('reads the served ARRAY shape (schema.instructions.item_schema.output_field.options)', () => {
    const catalog = normalize({
      ai_agent: {
        output_fields: {}, emits: 'append',
        schema: { instructions: { item_schema: { output_field: { options: [
          { key: 'answer', label: 'Antwoord' }, { key: 'score' },
        ] } } } },
      },
    })
    expect(catalog.ai_agent.instructionOutputFields).toEqual([
      { key: 'answer', label: 'Antwoord' }, { key: 'score', label: 'score' },
    ])
  })

  it('reads the served OBJECT shape ({key: label})', () => {
    const catalog = normalize({
      ai_agent: {
        output_fields: {}, emits: 'append',
        schema: { instructions: { item_schema: { output_field: { options: { answer: 'Antwoord', score: 'Score' } } } } },
      },
    })
    expect(catalog.ai_agent.instructionOutputFields).toEqual([
      { key: 'answer', label: 'Antwoord' }, { key: 'score', label: 'Score' },
    ])
  })

  it('falls back to the LEGACY module-level instruction_output_fields when no served options exist', () => {
    const catalog = normalize({
      ai_agent: { output_fields: {}, emits: 'append', instruction_output_fields: [{ key: 'legacy', label: 'Legacy' }] },
    })
    expect(catalog.ai_agent.instructionOutputFields).toEqual([{ key: 'legacy', label: 'Legacy' }])
  })

  it('the SERVED shape wins when both served options and the legacy array are present', () => {
    const catalog = normalize({
      ai_agent: {
        output_fields: {}, emits: 'append',
        instruction_output_fields: [{ key: 'legacy', label: 'Legacy' }],
        schema: { instructions: { item_schema: { output_field: { options: [{ key: 'served', label: 'Served' }] } } } },
      },
    })
    expect(catalog.ai_agent.instructionOutputFields).toEqual([{ key: 'served', label: 'Served' }])
  })

  it('is undefined when a type carries neither shape', () => {
    const catalog = normalize({ ai_agent: { output_fields: {}, emits: 'passthrough' } })
    expect(catalog.ai_agent.instructionOutputFields).toBeUndefined()
  })
})

// FILTER-MAPPING-1 — `output_fields` tolerates the legacy plain-string label
// and the richer `{label,type,source}` shape (BE not landed yet; this lane
// stays tolerant so the vocabulary picker lights up by itself at the BE landing).
describe('normalize · output_fields / outputFieldMeta', () => {
  it('keeps the legacy string-label map byte-identical and mirrors it into outputFieldMeta with no source', () => {
    const catalog = normalize({ candidate_filter: { output_fields: { status: 'Status' }, emits: 'replace' } })
    expect(catalog.candidate_filter.outputFields).toEqual({ status: 'Status' })
    expect(catalog.candidate_filter.outputFieldMeta).toEqual({ status: { label: 'Status', type: undefined, source: undefined } })
  })

  it('reads the richer {label,type,source} shape per field', () => {
    const catalog = normalize({
      candidate_filter: { output_fields: { status: { label: 'Status', type: 'string', source: 'candidate_statuses' } }, emits: 'replace' },
    })
    expect(catalog.candidate_filter.outputFields).toEqual({ status: 'Status' })
    expect(catalog.candidate_filter.outputFieldMeta).toEqual({ status: { label: 'Status', type: 'string', source: 'candidate_statuses' } })
  })
})

// HF-MOVED-TO-PICKER-1: a source-less field may carry inline enum options; a sourced field never does.
describe('normalize · outputFieldMeta.options (inline enum)', () => {
  it('keeps well-formed options on a source-less field, drops them next to a source, skips malformed entries', () => {
    const catalog = normalize({
      helloflex_inbound: {
        emits: 'append',
        output_fields: {
          contract_status_moved_to: { label: 'Moved to', type: 'string', options: [{ value: 'sent', label: 'Verzonden' }, { value: '', label: 'x' }, { nope: 1 }, { value: 'signed' }] },
          status: { label: 'Status', source: 'candidate_statuses', options: [{ value: 'a', label: 'A' }] },
          plain: { label: 'Plain', options: [] },
        },
      },
    } as never)
    const meta = catalog.helloflex_inbound.outputFieldMeta!
    expect(meta.contract_status_moved_to.options).toEqual([{ value: 'sent', label: 'Verzonden' }, { value: 'signed', label: 'signed' }])
    expect(meta.status.source).toBe('candidate_statuses')
    expect(meta.status.options).toBeUndefined()
    expect(meta.plain.options).toBeUndefined()
  })

  it('collapses a repeated value to its first occurrence (no duplicate picker keys)', () => {
    const catalog = normalize({
      m: { emits: 'append', output_fields: { f: { label: 'F', options: [{ value: 'a', label: 'A1' }, { value: 'a', label: 'A2' }, { value: 'b', label: 'B' }] } } },
    } as never)
    expect(catalog.m.outputFieldMeta!.f.options).toEqual([{ value: 'a', label: 'A1' }, { value: 'b', label: 'B' }])
  })
})
