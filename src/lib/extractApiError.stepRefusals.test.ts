/**
 * extractApiError · the workflow-save STEP REFUSALS (SIZE-TRIGGER-1 split of extractApiError.test.ts, 28-11):
 * the coded 422s StepConfigChecks raises through refuseStep carry step (1-based), label (null when the step has
 * none), field, value and, for the vocabulary refusals, `allowed`; the mapper renders the StepLabel / Step / bare
 * sentence from those and falls back to the server text only when a vocabulary refusal carries no list.
 */
import { describe, it, expect } from 'vitest'
import { apiErrorKey, apiErrorMessage } from './extractApiError'

// WORKFLOW-CONTRACT-STATUS-VALIDATION-1: the workflow save refuses a matches step whose contract_status is outside the vocabulary (422, body carries `allowed`).
describe('workflow_step_contract_status_unknown (422)', () => {
  it('maps the code to its translated key', () => {
    expect(apiErrorKey({ response: { status: 422, data: { code: 'workflow_step_contract_status_unknown', message: 'x', allowed: ['none'] } } })).toBe('errors.workflowStepContractStatusUnknown')
  })

  // A key-echo t that prints the interpolation values it received, in a fixed order.
  const t = (key: string, options?: { ns: string; step?: number; label?: string; value?: string; allowed?: string }) =>
    [options?.ns, key, options?.step, options?.label, options?.value, options?.allowed].filter((v) => v !== undefined).join('|')
  const allowed = ['none', 'sending', 'sent']

  it('names the step, its label and the offending value with the allowed list joined (batch G body)', () => {
    const err = { response: { status: 422, data: { code: 'workflow_step_contract_status_unknown', message: 'x', allowed, step: 2, label: 'Matches', value: 'foo' } } }
    expect(apiErrorMessage(err, t, 'fallback')).toBe('common|errors.workflowStepContractStatusUnknownStepLabel|2|Matches|foo|none, sending, sent')
  })

  it('names the step alone when the step has no label (label null)', () => {
    const err = { response: { status: 422, data: { code: 'workflow_step_contract_status_unknown', message: 'x', allowed, step: 3, label: null, value: 'foo' } } }
    expect(apiErrorMessage(err, t, 'fallback')).toBe('common|errors.workflowStepContractStatusUnknownStep|3|foo|none, sending, sent')
  })

  it('renders the bare sentence with the allowed list when the body carries no step or value (pre-batch-G shape)', () => {
    const err = { response: { status: 422, data: { code: 'workflow_step_contract_status_unknown', message: "Step 2 ('Matches'): contract status 'foo' is unknown.", allowed } } }
    expect(apiErrorMessage(err, t, 'fallback')).toBe('common|errors.workflowStepContractStatusUnknown|none, sending, sent')
  })

  it('falls back to the server sentence when the body carries no allowed list', () => {
    const t = (key: string) => `TRANSLATED:${key}`
    const err = { response: { status: 422, data: { code: 'workflow_step_contract_status_unknown', message: 'server sentence' } } }
    expect(apiErrorMessage(err, t, 'fallback')).toBe('server sentence')
  })
})

// APPT-LOOKUP-422-FE-1: the workflow save refuses an appointment step whose constant type or location is outside the bureau's lookup
// (422, BE StepConfigChecks::appointmentCreate; body carries step, label, field, value, allowed).
describe('workflow_step_appointment_lookup_unknown (422)', () => {
  it('maps the code to its translated key', () => {
    expect(apiErrorKey({ response: { status: 422, data: { code: 'workflow_step_appointment_lookup_unknown', message: 'x', allowed: ['Intake'] } } })).toBe('errors.workflowStepAppointmentLookupUnknown')
  })

  // A key-echo t that prints the interpolation values it received, in a fixed order (field is itself a translated label).
  const t = (key: string, options?: { ns: string; step?: number; label?: string; field?: string; value?: string; allowed?: string }) =>
    [options?.ns, key, options?.step, options?.label, options?.field, options?.value, options?.allowed].filter((v) => v !== undefined).join('|')
  const allowed = ['Intake', 'Evaluatie']

  it('names the step, its label, the translated field (type), the offending value and the allowed list', () => {
    const err = { response: { status: 422, data: { code: 'workflow_step_appointment_lookup_unknown', message: 'x', step: 2, label: 'Afspraak', field: 'type', value: 'Kennismaking', allowed } } }
    expect(apiErrorMessage(err, t, 'fallback')).toBe('common|errors.workflowStepAppointmentLookupUnknownStepLabel|2|Afspraak|common|errors.appointmentLookupFieldType|Kennismaking|Intake, Evaluatie')
  })

  it('names the step alone with the translated field (location) when the step has no label (label null)', () => {
    const err = { response: { status: 422, data: { code: 'workflow_step_appointment_lookup_unknown', message: 'x', step: 3, label: null, field: 'location', value: 'Kantoor Zuid', allowed: ['Hoofdkantoor'] } } }
    expect(apiErrorMessage(err, t, 'fallback')).toBe('common|errors.workflowStepAppointmentLookupUnknownStep|3|common|errors.appointmentLookupFieldLocation|Kantoor Zuid|Hoofdkantoor')
  })

  it('renders the bare sentence with the allowed list when the field is not one it knows', () => {
    const err = { response: { status: 422, data: { code: 'workflow_step_appointment_lookup_unknown', message: 'x', step: 2, label: 'Afspraak', field: 'other', value: 'x', allowed } } }
    expect(apiErrorMessage(err, t, 'fallback')).toBe('common|errors.workflowStepAppointmentLookupUnknown|Intake, Evaluatie')
  })

  it('falls back to the server sentence when the body carries no allowed list', () => {
    const t = (key: string) => `TRANSLATED:${key}`
    const err = { response: { status: 422, data: { code: 'workflow_step_appointment_lookup_unknown', message: 'server sentence', step: 2, field: 'type', value: 'x' } } }
    expect(apiErrorMessage(err, t, 'fallback')).toBe('server sentence')
  })
})

// STEP-FILTER-BLANK-422-FE-1: the workflow save refuses a step filter (or a ScenarioModule = / != condition) whose value is
// blank (422, BE StepConfigChecks via refuseStep; the body carries step, label, field and value null, never an allowed list).
describe('step_filter_value_blank (422)', () => {
  it('maps the code to its translated key', () => {
    expect(apiErrorKey({ response: { status: 422, data: { code: 'step_filter_value_blank', message: 'x' } } })).toBe('errors.workflowStepFilterValueBlank')
  })

  // A key-echo t that prints the interpolation values it received, in a fixed order.
  const t = (key: string, options?: { ns: string; step?: number; label?: string; field?: string }) =>
    [options?.ns, key, options?.step, options?.label, options?.field].filter((v) => v !== undefined).join('|')

  it('names the step, its label and the blank filter field', () => {
    const err = { response: { status: 422, data: { code: 'step_filter_value_blank', message: 'x', step: 2, label: 'Kandidaten', field: 'status_key', value: null } } }
    expect(apiErrorMessage(err, t, 'fallback')).toBe('common|errors.workflowStepFilterValueBlankStepLabel|2|Kandidaten|status_key')
  })

  it('names the step alone when the step has no label (label null)', () => {
    const err = { response: { status: 422, data: { code: 'step_filter_value_blank', message: 'x', step: 1, label: null, field: 'owner_id', value: null } } }
    expect(apiErrorMessage(err, t, 'fallback')).toBe('common|errors.workflowStepFilterValueBlankStep|1|owner_id')
  })

  it('renders the bare translated sentence, never the server text, when the step or the field is missing', () => {
    const err = { response: { status: 422, data: { code: 'step_filter_value_blank', message: 'server sentence', step: 2 } } }
    expect(apiErrorMessage(err, t, 'fallback')).toBe('common|errors.workflowStepFilterValueBlank')
  })
})

// AI-AGENT-STEP-LANGUAGE-FE-1: the workflow save refuses an AI agent step whose audience is outside the engine's two values
// (422, BE StepConfigChecks::aiAgentAudience via refuseStep, batch R1; the body carries step, label, field 'audience', value, allowed).
describe('workflow_step_unknown_audience (422)', () => {
  it('maps the code to its translated key', () => {
    expect(apiErrorKey({ response: { status: 422, data: { code: 'workflow_step_unknown_audience', message: 'x', allowed: ['candidate', 'staff'] } } })).toBe('errors.workflowStepUnknownAudience')
  })

  // A key-echo t that prints the interpolation values it received, in a fixed order.
  const t = (key: string, options?: { ns: string; step?: number; label?: string; field?: string; value?: string; allowed?: string }) =>
    [options?.ns, key, options?.step, options?.label, options?.field, options?.value, options?.allowed].filter((v) => v !== undefined).join('|')
  const allowed = ['candidate', 'staff']

  it('names the step, its label, the offending value and the two allowed audiences (field stays out of the sentence)', () => {
    const err = { response: { status: 422, data: { code: 'workflow_step_unknown_audience', message: 'x', step: 2, label: 'Intake', field: 'audience', value: 'manager', allowed } } }
    expect(apiErrorMessage(err, t, 'fallback')).toBe('common|errors.workflowStepUnknownAudienceStepLabel|2|Intake|manager|candidate, staff')
  })

  it('names the step alone when the step has no label (label null)', () => {
    const err = { response: { status: 422, data: { code: 'workflow_step_unknown_audience', message: 'x', step: 1, label: null, field: 'audience', value: 'klant', allowed } } }
    expect(apiErrorMessage(err, t, 'fallback')).toBe('common|errors.workflowStepUnknownAudienceStep|1|klant|candidate, staff')
  })

  it('renders the bare sentence with the allowed list when the body carries no step or value', () => {
    const err = { response: { status: 422, data: { code: 'workflow_step_unknown_audience', message: 'x', allowed } } }
    expect(apiErrorMessage(err, t, 'fallback')).toBe('common|errors.workflowStepUnknownAudience|candidate, staff')
  })

  it('falls back to the server sentence when the body carries no allowed list', () => {
    const t = (key: string) => `TRANSLATED:${key}`
    const err = { response: { status: 422, data: { code: 'workflow_step_unknown_audience', message: 'server sentence', step: 2, field: 'audience', value: 'x' } } }
    expect(apiErrorMessage(err, t, 'fallback')).toBe('server sentence')
  })
})
