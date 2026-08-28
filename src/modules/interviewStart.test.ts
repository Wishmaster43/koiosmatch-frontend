/**
 * Pin for interview_start's config schema (WF-INTERVIEW-FLOW-1, CMBE contract
 * 28-08): the backend module carries `interview_flow_id` now — this guards
 * against the schema silently drifting back to the stale empty [] it shipped
 * with before the flow picker (BE-measured comment fix, same delivery).
 */
import { describe, it, expect } from 'vitest'
import { MODULE_SCHEMAS } from './index'

describe('module registry · interview_start flow picker', () => {
  it('carries a lookup_select field bound to GET /ai/interview-flows', () => {
    const schema = MODULE_SCHEMAS.interview_start
    expect(schema).toBeDefined()
    const field = schema?.find(f => f.key === 'interview_flow_id')
    expect(field).toBeDefined()
    expect(field?.type).toBe('lookup_select')
    expect(field?.endpoint).toBe('/ai/interview-flows')
    // Clearable: no explicit valueKey/responseKey means the empty '' option
    // reaches config as-is, which the engine reads as "resolve the default".
    expect(field?.placeholder).toBeTruthy()
  })
})
