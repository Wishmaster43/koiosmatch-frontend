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
