/**
 * extractApiError — preference order: first validation message → server message
 * → caller fallback; never throws on malformed/absent error shapes.
 */
import { describe, it, expect } from 'vitest'
import { extractApiError, apiErrorKey, apiErrorMessage } from './extractApiError'

describe('extractApiError', () => {
  it('prefers the first validation error over the generic message', () => {
    const err = { response: { data: { message: 'The given data was invalid.', errors: { email: ['E-mail is al in gebruik.'], name: ['x'] } } } }
    expect(extractApiError(err, 'fallback')).toBe('E-mail is al in gebruik.')
  })

  it('falls back to the server message when no validation bag exists', () => {
    const err = { response: { data: { message: 'Kan niet verwijderen: in gebruik.' } } }
    expect(extractApiError(err, 'fallback')).toBe('Kan niet verwijderen: in gebruik.')
  })

  it('returns the caller fallback on network errors / malformed shapes', () => {
    expect(extractApiError(new Error('Network Error'), 'fallback')).toBe('fallback')
    expect(extractApiError(undefined, 'fallback')).toBe('fallback')
    expect(extractApiError({ response: { data: { errors: {} } } }, 'fallback')).toBe('fallback')
  })
})

/**
 * KAND-ACHTERGROND-VERPLICHT-1: Laravel's own untranslated "required" template
 * (no lang/nl/validation.php on the backend, see the helper's own header) must
 * never reach the user raw — swap it for the caller's translated per-field copy
 * when it knows the field, else the caller's generic fallback. A CRAFTED domain
 * message (DocumentOwnershipGuard etc., asserted in the top describe block above)
 * must keep passing through untouched — that is the regression this guards.
 */
describe('extractApiError · raw Laravel "required" template is never shown verbatim', () => {
  it('swaps the raw English template for the caller-supplied translated field message', () => {
    const err = { response: { data: { message: 'The given data was invalid.', errors: { employer: ['The employer field is required.'] } } } }
    expect(extractApiError(err, 'fallback', { employer: 'Bedrijf is verplicht.' })).toBe('Bedrijf is verplicht.')
  })

  it('falls back to the generic fallback when the caller has no label for that field', () => {
    const err = { response: { data: { errors: { employer: ['The employer field is required.'] } } } }
    expect(extractApiError(err, 'fallback')).toBe('fallback')
    expect(extractApiError(err, 'fallback', { last_name: 'Achternaam is verplicht.' })).toBe('fallback')
  })

  it('still surfaces a hand-crafted (non-template) validation message untouched', () => {
    const err = { response: { data: { errors: { document_id: ['Dit document is al aan een ander onderdeel gekoppeld.'] } } } }
    expect(extractApiError(err, 'fallback', { document_id: 'should never win' })).toBe('Dit document is al aan een ander onderdeel gekoppeld.')
  })

  it('recognises the template with a multi-word attribute (underscore → space)', () => {
    const err = { response: { data: { errors: { last_name: ['The last name field is required.'] } } } }
    expect(extractApiError(err, 'fallback', { last_name: 'Achternaam is verplicht.' })).toBe('Achternaam is verplicht.')
  })
})

describe('apiErrorKey · UPLOADS-SCAN-1 / TENANT-READY codes', () => {
  it('maps document_not_available (423) to its i18n key', () => {
    expect(apiErrorKey({ response: { data: { code: 'document_not_available' } } })).toBe('errors.documentNotAvailable')
  })
  it('maps tenant_not_ready (409) to its i18n key', () => {
    expect(apiErrorKey({ response: { data: { code: 'tenant_not_ready' } } })).toBe('errors.tenantNotReady')
  })
  it('maps ai_disclosure_missing (422) to its i18n key', () => {
    expect(apiErrorKey({ response: { data: { code: 'ai_disclosure_missing' } } })).toBe('errors.aiDisclosureMissing')
  })
})

describe('apiErrorKey · sm_credentials_unsatisfied (ONIX G-014)', () => {
  it('maps sm_credentials_unsatisfied (422) to its i18n key', () => {
    expect(apiErrorKey({ response: { data: { code: 'sm_credentials_unsatisfied' } } })).toBe('errors.smCredentialsUnsatisfied')
  })
})

describe('apiErrorKey / apiErrorMessage · AUTHZ-REFUSAL-CODE-2 codes', () => {
  it('maps permission_denied (403) to its i18n key', () => {
    expect(apiErrorKey({ response: { data: { code: 'permission_denied' } } })).toBe('errors.permissionDenied')
  })
  it('maps invalid_signature to its i18n key', () => {
    expect(apiErrorKey({ response: { data: { code: 'invalid_signature' } } })).toBe('errors.invalidSignature')
  })
  it('maps module_not_enabled to its i18n key', () => {
    expect(apiErrorKey({ response: { data: { code: 'module_not_enabled' } } })).toBe('errors.moduleNotEnabled')
  })
  it('renders the translated copy for permission_denied, never the bureau-language server message', () => {
    const t = (key: string) => `TRANSLATED:${key}`
    const err = { response: { data: { code: 'permission_denied', message: 'Onvoldoende rechten.' } } }
    expect(apiErrorMessage(err, t, 'fallback')).toBe('TRANSLATED:errors.permissionDenied')
  })
})

describe('apiErrorKey · numbering_frozen (DANNY-0511-D)', () => {
  it('maps numbering_frozen (422) to its i18n key', () => {
    expect(apiErrorKey({ response: { data: { code: 'numbering_frozen' } } })).toBe('errors.numberingFrozen')
  })
})

describe('apiErrorKey · email_unavailable (ONIX C-007)', () => {
  it('maps email_unavailable (422) to its i18n key regardless of the English message', () => {
    expect(apiErrorKey({ response: { data: { code: 'email_unavailable', message: 'This e-mail address cannot be used.' } } })).toBe('errors.emailUnavailable')
  })
})

describe('apiErrorMessage', () => {
  // Key-echo translator that records the namespace it was asked for.
  const t = (key: string, options?: { ns: string }) => `${options?.ns ?? ''}:${key}`

  it('translates a known backend code from common, ignoring the server sentence', () => {
    const err = { response: { data: { code: 'ai_disclosure_missing', message: 'NL zin' } } }
    expect(apiErrorMessage(err, t, 'fallback')).toBe('common:errors.aiDisclosureMissing')
  })
  it('falls back to the server message for an unknown code', () => {
    const err = { response: { data: { code: 'something_new', message: 'Server says no.' } } }
    expect(apiErrorMessage(err, t, 'fallback')).toBe('Server says no.')
  })
  it('uses the first validation message of a bag when there is no known code', () => {
    const err = { response: { data: { errors: { name: ['Name is taken.'] } } } }
    expect(apiErrorMessage(err, t, 'fallback')).toBe('Name is taken.')
  })
  it('returns the fallback for a network error', () => {
    expect(apiErrorMessage(new Error('Network Error'), t, 'fallback')).toBe('fallback')
  })
})

// HF-IDEMPOTENT-1: the two coded refusals of the retried contract send map to their errors.* keys.
describe('HF-IDEMPOTENT-1 codes', () => {
  it('maps the 409 ambiguous code', () => {
    expect(apiErrorKey({ response: { data: { code: 'helloflex_contract_ambiguous', message: 'x' } } })).toBe('errors.helloflexContractAmbiguous')
  })

  it('maps the 502 unreachable code', () => {
    expect(apiErrorKey({ response: { data: { code: 'helloflex_unreachable', message: 'x' } } })).toBe('errors.helloflexUnreachable')
  })
})

// TENANT-PACKAGE-SEAM-RUNTIME-1: the coded 409 of the last-net guard on a package write outside the package seam.
describe('tenant_package_write_outside_seam', () => {
  it('maps the code to its i18n key', () => {
    expect(apiErrorKey({ response: { status: 409, data: { code: 'tenant_package_write_outside_seam', message: 'x' } } })).toBe('errors.tenantPackageWriteOutsideSeam')
  })

  it('renders the translated copy and never the server sentence', () => {
    const t = (key: string) => `TRANSLATED:${key}`
    const err = { response: { status: 409, data: { code: 'tenant_package_write_outside_seam', message: 'Pakketwijziging geweigerd.' } } }
    expect(apiErrorMessage(err, t, 'fallback')).toBe('TRANSLATED:errors.tenantPackageWriteOutsideSeam')
  })
})

// C2: the inbound-scenario 422 codes render translated copy; the clash names its holder; unknown codes keep the fallback.
describe('inbound scenario codes', () => {
  const t = (key: string, o?: { ns: string; clash_name?: string }) => `${key}|${o?.clash_name ?? ''}`
  const err = (data: Record<string, unknown>) => ({ response: { data } })

  it('maps both codes to errors.* keys', () => {
    expect(apiErrorKey(err({ code: 'inbound_scenario_clash' }))).toBe('errors.inboundScenarioClash')
    expect(apiErrorKey(err({ code: 'inbound_scenario_number_missing' }))).toBe('errors.inboundScenarioNumberMissing')
  })

  it('interpolates the holder name into the clash sentence', () => {
    expect(apiErrorMessage(err({ code: 'inbound_scenario_clash', clash_name: 'Intake' }), t, 'fb')).toBe('errors.inboundScenarioClash|Intake')
  })

  it('falls back to the server text when a clash arrives without a name', () => {
    expect(apiErrorMessage(err({ code: 'inbound_scenario_clash', message: 'Server' }), t, 'fb')).toBe('Server')
  })

  it('renders the number-missing sentence and ignores an unknown code', () => {
    expect(apiErrorMessage(err({ code: 'inbound_scenario_number_missing' }), t, 'fb')).toBe('errors.inboundScenarioNumberMissing|')
    expect(apiErrorMessage(err({ code: 'nope' }), t, 'fb')).toBe('fb')
  })
})

// IDEMP-BODY-1: a reused Idempotency-Key with a different body answers 422 idempotency_key_reused.
describe('idempotency_key_reused', () => {
  it('maps to the translated common sentence', () => {
    const err = { response: { data: { code: 'idempotency_key_reused', message: 'x' } } }
    expect(apiErrorKey(err)).toBe('errors.idempotencyKeyReused')
  })
})

// PROPOSAL-CV-ATTACH-1: the two CV virus-scan refusals of POST /applications/{id}/propose.
describe('cv scan refusals', () => {
  it('maps cv_scan_unavailable and cv_infected to their translated sentences', () => {
    expect(apiErrorKey({ response: { data: { code: 'cv_scan_unavailable', message: 'x' } } })).toBe('errors.cvScanUnavailable')
    expect(apiErrorKey({ response: { data: { code: 'cv_infected', message: 'x' } } })).toBe('errors.cvInfected')
  })
})

// CONNECTOR-VS-REPORTING-1: the apps PUT refuses a connector switch-off while its reporting add-on is bought.
describe('connector_required_by_reporting (409)', () => {
  it('maps the code to its translated key', () => {
    expect(apiErrorKey({ response: { status: 409, data: { code: 'connector_required_by_reporting', message: 'x' } } })).toBe('errors.connectorRequiredByReporting')
  })

  it('renders the translated copy and never the server sentence', () => {
    const t = (key: string) => `TRANSLATED:${key}`
    const err = { response: { status: 409, data: { code: 'connector_required_by_reporting', message: 'Zet eerst de rapportage uit.' } } }
    expect(apiErrorMessage(err, t, 'fallback')).toBe('TRANSLATED:errors.connectorRequiredByReporting')
  })
})

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
