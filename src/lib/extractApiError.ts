/**
 * extractApiError — one place that turns an axios error into a human message
 * (audit R1: the `message ?? first-validation-error` dance was copy-pasted 4×
 * across pages). Preference order: Laravel validation bag's first message →
 * server `message` → the caller's fallback (an i18n'd string — never leak a
 * raw axios/network string to the UI).
 */
import { notify, notifyError } from './notify'

interface ServerErrorBody { message?: string; code?: string; errors?: Record<string, string[]>; clash_name?: string; params?: { clash_name?: string }; meta?: { clash_name?: string }; allowed?: string[]; step?: number; label?: string | null; field?: string; value?: string }

// KAND-ACHTERGROND-VERPLICHT-1 (2026-08-17): Laravel's OWN default "required"
// validation copy (vendor lang/en/validation.php: 'The :attribute field is
// required.'). The API has `APP_LOCALE=nl` but ships no lang/nl/validation.php
// (verified in koiosmatch-api/lang — only vacancies/guard/customers/contacts are
// translated), so this template always falls through to the English default and
// reaches the client raw, naming the raw column ("employer") instead of the
// label the user sees — the exact toast Danny screenshotted. Every message a
// controller crafts by hand (DocumentOwnershipGuard, guard.*, the domain 409s
// throughout app/Http/Controllers) is authored Dutch/English prose and never
// matches this literal template, so the fingerprint safely tells the two apart
// without touching any of those already-working, already-readable messages.
// N005-UNMAPPED-422-A1: exported so formatUnmappedErrors shares one fingerprint
// for Laravel's raw untranslated "required" template instead of a second copy.
export const RAW_REQUIRED_RE = /^The .+ field is required\.$/

/**
 * @param fieldLabels Optional map of backend field key → an ALREADY-TRANSLATED
 * message (built by the caller via `t()`, since this helper has no i18n access
 * and runs outside render too). Only consulted when the raw validation message
 * is Laravel's own untranslated "required" template — a crafted domain message
 * always wins as before. Unknown/absent field → the caller's generic `fallback`,
 * never the raw server sentence.
 */
export function extractApiError(err: unknown, fallback: string, fieldLabels?: Record<string, string>): string {
  const body = (err as { response?: { data?: ServerErrorBody } })?.response?.data
  const entries = body?.errors ? Object.entries(body.errors) : []
  const [field, messages] = entries[0] ?? []
  const raw = messages?.[0]
  if (raw && RAW_REQUIRED_RE.test(raw)) {
    return (field && fieldLabels?.[field]) ? fieldLabels[field] : fallback
  }
  return raw ?? body?.message ?? fallback
}

/**
 * Backend error CODES we translate ourselves (CMBE 09-08, commit 456ac45b). The
 * `code` is the stable contract; the server's Dutch `message` is only a fallback
 * and must never be shown raw to a non-NL tenant (§5/§10). Covers every Koios
 * surface at once — chat, notes-assist, generate and conversation-assist all pass
 * through one translation layer in the backend's ClaudeClient.
 */
const ERROR_CODE_KEYS: Record<string, string> = {
  // IDEMP-BODY-1 (422): a reused Idempotency-Key arrived with a different body or query.
  idempotency_key_reused: 'errors.idempotencyKeyReused',
  // PROPOSAL-CV-ATTACH-1: the CV virus scan refused the proposal (scanner down / file infected).
  cv_scan_unavailable: 'errors.cvScanUnavailable',
  cv_infected: 'errors.cvInfected',
  koios_credit_exhausted: 'errors.koiosCreditExhausted',
  koios_unavailable: 'errors.koiosUnavailable',
  // HF-CONTRACTMAP-1: the manual send-to-HelloFlex path returns this 409 when the
  // match's contract form has no row in Settings → HelloFlex → Contractmap yet —
  // an honest "not configured" notice, never a raw server message.
  helloflex_contract_type_unmapped: 'errors.helloflexContractTypeUnmapped',
  // HF-CONTRACT-1: the 409 refusals of the contract built from the STORED match (priority order).
  helloflex_start_date_missing: 'errors.helloflexStartDateMissing',
  helloflex_job_title_missing: 'errors.helloflexJobTitleMissing',
  helloflex_zzp_not_supported: 'errors.helloflexZzpNotSupported',
  helloflex_employer_unlinked: 'errors.helloflexEmployerUnlinked',
  helloflex_candidate_unlinked: 'errors.helloflexCandidateUnlinked',
  helloflex_branch_unlinked: 'errors.helloflexBranchUnlinked',
  // HF-CONTRACT-SEND-1: the manual contract send's coded 409 refusals.
  contract_in_flight: 'errors.contractInFlight',
  contract_unconfirmed: 'errors.contractUnconfirmed',
  contract_sent: 'errors.contractSent',
  two_way_off: 'errors.twoWayOff',
  // HF-IDEMPOTENT-1 (BE 80d2c127f): the retried contract send's coded refusals, 409 ambiguous and 502 unreachable.
  helloflex_contract_ambiguous: 'errors.helloflexContractAmbiguous',
  helloflex_unreachable: 'errors.helloflexUnreachable',
  // The proposal send is refused up front (422) for a suppressed recipient address.
  recipient_suppressed: 'errors.recipientSuppressed',
  // UPLOADS-SCAN-1 (423): the file is not clean yet, or was rejected by the scanner.
  document_not_available: 'errors.documentNotAvailable',
  // TENANT-READY (409): the named bureau is still provisioning or failed.
  tenant_not_ready: 'errors.tenantNotReady',
  // TENANT-PACKAGE-SEAM-RUNTIME-1 (BE 0fe1ebe46, 409): the last-net guard refuses a package, add-on or module write that bypasses the package seam; nothing is saved.
  tenant_package_write_outside_seam: 'errors.tenantPackageWriteOutsideSeam',
  // CONNECTOR-VS-REPORTING-1: a connector app switched off while its reporting add-on is still bought (409).
  connector_required_by_reporting: 'errors.connectorRequiredByReporting',
  // WORKFLOW-CONTRACT-STATUS-VALIDATION-1 (BE 3ffd68b53, 422): a matches step's free key/value fields set a contract_status outside
  // JobMatch::CONTRACT_STATUSES; the body carries `allowed`, the vocabulary the translated sentence lists.
  workflow_step_contract_status_unknown: 'errors.workflowStepContractStatusUnknown',
  // APPT-LOOKUP-422-FE-1 (BE StepConfigChecks::appointmentCreate, 422): an appointment step names a constant type or
  // location outside the bureau's lookup; the body carries step, label, field ('type' | 'location'), value and allowed.
  workflow_step_appointment_lookup_unknown: 'errors.workflowStepAppointmentLookupUnknown',
  // STEP-FILTER-BLANK-422-FE-1 (BE StepConfigChecks via refuseStep, batch P, 422): a step filter, or a ScenarioModule condition
  // with = / !=, was saved with a blank value; the body carries step, label, field (the first blank member) and value null.
  step_filter_value_blank: 'errors.workflowStepFilterValueBlank',
  // AI-AGENT-STEP-LANGUAGE-FE-1 (BE StepConfigChecks::aiAgentAudience via refuseStep, batch R1, 422): an AI agent step names an
  // audience outside InterviewLanguage::AUDIENCE_OPTIONS; the body carries step, label, field ('audience'), value and allowed.
  workflow_step_unknown_audience: 'errors.workflowStepUnknownAudience',
  // TASK-STATUS-LOOKUP-EMPTY-422-FE-1 (BE bootstrap/app.php renderer for TaskStatusLookupEmptyException, batch N, 422): a task
  // create arrived while the bureau's task-status lookup is empty and no status_id was sent; the body is exactly {code, message}.
  task_status_lookup_empty: 'errors.taskStatusLookupEmpty',
  // TASK-STATUS-LAST-ROW-FE-1 (BE TaskStatus `deleting` hook rendered on DELETE /task-statuses/{id}, batch R1, 409): the last
  // task status of a bureau cannot be deleted; the body is exactly {code, message}, without the in_use key of the in-use 409.
  task_status_last_row: 'errors.taskStatusLastRow',
  // The interview intro / workflow / Koios toggle lacks the mandatory AI disclosure (422).
  ai_disclosure_missing: 'errors.aiDisclosureMissing',
  // ONIX C-007: one generic 422 for a taken e-mail (never reveals why or where it is in use).
  email_unavailable: 'errors.emailUnavailable',
  // Activating an inbound WhatsApp scenario: the (number, lane) is taken by another scenario (422, names the holder).
  inbound_scenario_clash: 'errors.inboundScenarioClash',
  // Activating an inbound scenario that names none of the bureau's numbers on its lane (422).
  inbound_scenario_number_missing: 'errors.inboundScenarioNumberMissing',
  // ONIX G-014 (422): a Shiftmanager sync whose stored credentials do not fill the keys of the connection's auth type sends nothing.
  sm_credentials_unsatisfied: 'errors.smCredentialsUnsatisfied',
  // AUTHZ-REFUSAL-CODE-2 (BE 5727786ac): every authorization refusal is coded, so the copy renders in the user's UI language instead of the bureau-language server sentence.
  permission_denied: 'errors.permissionDenied',
  invalid_signature: 'errors.invalidSignature',
  module_not_enabled: 'errors.moduleNotEnabled',
  // DANNY-0511-D (422): the numbering start value is frozen once the first number was issued.
  numbering_frozen: 'errors.numberingFrozen',
  // MANUAL-START-WORKFLOW-1 (BE SystemWorkflows, 409): a seeded system workflow (the inbox composer's
  // whatsapp_manual_send) refuses archive, switch-off, hand start and step edits; renaming stays allowed.
  system_workflow_locked: 'errors.systemWorkflowLocked',
}

/** The stable backend error code of a refusal, or null when the body carries none. */
export function apiErrorCode(err: unknown): string | null {
  const code = (err as { response?: { data?: ServerErrorBody } })?.response?.data?.code
  return typeof code === 'string' && code !== '' ? code : null
}

/** SYSWF-LOCK-FE-1: the 409 code a locked system workflow answers on every refused write or hand start. */
export const SYSTEM_WORKFLOW_LOCKED = 'system_workflow_locked'

/**
 * The `common` i18n key for a known backend error code, or null when the code is
 * absent/unknown — the caller then falls back to extractApiError. Matching on the
 * code (never on the message text) is what keeps this stable when the backend
 * rewords its copy.
 */
export function apiErrorKey(err: unknown): string | null {
  const code = apiErrorCode(err)
  return (code && ERROR_CODE_KEYS[code]) ?? null
}

// The WSCS-422-FIELDS-1 step refusals (contract status, appointment lookup) carry an `allowed` vocabulary: the body
// with that list joined for the sentence, or null when the list is absent (the server sentence is then more honest).
function stepRefusalBody(err: unknown): { body: ServerErrorBody; allowed: string } | null {
  const body = (err as { response?: { data?: ServerErrorBody } })?.response?.data
  const list = body?.allowed
  return body && Array.isArray(list) && list.length > 0 ? { body, allowed: list.join(', ') } : null
}

// The translate function apiErrorMessage and its arms accept (the i18next `t` with the option names the sentences use).
type ErrorCopyT = (key: string, options?: { ns: string; clash_name?: string; branch?: string; allowed?: string; step?: number; label?: string; field?: string; value?: string }) => string

// A step refusal whose sentence names the 1-based step, its label (null when the step has none), the offending value and the
// allowed vocabulary (contract status, audience): the step variants when the body carries step and value, else the bare
// sentence; without an allowed list the server sentence (which names the step) is more honest than an empty list.
function stepValueRefusalMessage(err: unknown, t: ErrorCopyT, fallback: string, keys: { bare: string; step: string; stepLabel: string }): string {
  const hit = stepRefusalBody(err)
  if (!hit) return extractApiError(err, fallback)
  const { body, allowed } = hit
  if (typeof body.step === 'number' && typeof body.value === 'string') {
    return body.label
      ? t(keys.stepLabel, { ns: 'common', step: body.step, label: body.label, value: body.value, allowed })
      : t(keys.step, { ns: 'common', step: body.step, value: body.value, allowed })
  }
  return t(keys.bare, { ns: 'common', allowed })
}

/**
 * One call for the whole "coded refusal, else server text, else fallback" chain:
 * a known backend `code` renders its translated `common` copy (never the server's
 * Dutch sentence), anything else goes through extractApiError.
 */
export function apiErrorMessage(
  err: unknown,
  t: ErrorCopyT,
  fallback: string,
): string {
  const key = apiErrorKey(err)
  if (key === ERROR_CODE_KEYS.inbound_scenario_clash) {
    // The clash sentence names the holder; without a name the generic chain is more honest than a blank.
    const body = (err as { response?: { data?: ServerErrorBody } })?.response?.data
    const name = body?.clash_name ?? body?.params?.clash_name ?? body?.meta?.clash_name
    return name ? t(key, { ns: 'common', clash_name: name }) : extractApiError(err, fallback)
  }
  if (key === ERROR_CODE_KEYS.helloflex_branch_unlinked) {
    // The branch refusal names the unlinked branch; without a name the generic chain is more honest.
    const name = (err as { response?: { data?: ServerErrorBody & { branch_name?: string } } })?.response?.data?.branch_name
    return name ? t(key, { ns: 'common', branch: name }) : extractApiError(err, fallback)
  }
  if (key === ERROR_CODE_KEYS.workflow_step_contract_status_unknown) {
    // BE batch G adds step (1-based), label (null when the step has none) and value: the sentence names them when they are there.
    return stepValueRefusalMessage(err, t, fallback, { bare: 'errors.workflowStepContractStatusUnknown', step: 'errors.workflowStepContractStatusUnknownStep', stepLabel: 'errors.workflowStepContractStatusUnknownStepLabel' })
  }
  if (key === ERROR_CODE_KEYS.workflow_step_unknown_audience) {
    // AI-AGENT-STEP-LANGUAGE-FE-1: the field is 'audience' by contract, so the sentence names only the step, the value and the two allowed audiences.
    return stepValueRefusalMessage(err, t, fallback, { bare: 'errors.workflowStepUnknownAudience', step: 'errors.workflowStepUnknownAudienceStep', stepLabel: 'errors.workflowStepUnknownAudienceStepLabel' })
  }
  if (key === ERROR_CODE_KEYS.workflow_step_appointment_lookup_unknown) {
    // The refusal names the field (type | location), the offending value and the bureau's allowed list; without the list the server sentence is more honest.
    const hit = stepRefusalBody(err)
    if (!hit) return extractApiError(err, fallback)
    const { body, allowed } = hit
    // The field travels as its config key; the sentence names it in the user's language (an unknown field keeps the bare sentence).
    const fieldKey = body.field === 'type' ? 'errors.appointmentLookupFieldType' : body.field === 'location' ? 'errors.appointmentLookupFieldLocation' : null
    if (fieldKey && typeof body.step === 'number' && typeof body.value === 'string') {
      const field = t(fieldKey, { ns: 'common' })
      return body.label
        ? t('errors.workflowStepAppointmentLookupUnknownStepLabel', { ns: 'common', step: body.step, label: body.label, field, value: body.value, allowed })
        : t('errors.workflowStepAppointmentLookupUnknownStep', { ns: 'common', step: body.step, field, value: body.value, allowed })
    }
    return t('errors.workflowStepAppointmentLookupUnknown', { ns: 'common', allowed })
  }
  if (key === ERROR_CODE_KEYS.step_filter_value_blank) {
    // The refusal names the step and the filter field whose value is blank (value is null by contract); without a step or
    // field the bare translated sentence is still true, so this arm never falls back to the server text.
    const body = (err as { response?: { data?: ServerErrorBody } })?.response?.data
    if (typeof body?.step === 'number' && typeof body.field === 'string' && body.field !== '') {
      return body.label
        ? t('errors.workflowStepFilterValueBlankStepLabel', { ns: 'common', step: body.step, label: body.label, field: body.field })
        : t('errors.workflowStepFilterValueBlankStep', { ns: 'common', step: body.step, field: body.field })
    }
    return t('errors.workflowStepFilterValueBlank', { ns: 'common' })
  }
  return key ? t(key, { ns: 'common' }) : extractApiError(err, fallback)
}

// MODULE-403-DEEPLINK-1 (Danny 23-11, Q25): a module_not_enabled refusal also deep-links to the super admin screen that switches it on.
// Package modules (EnsureTenantModule) live under Modules; the connector-gated sites pass the Connectors (apps) hash instead.
const MODULES_SETTINGS_HASH = '#settings/superadmin/modules'
export const APPS_SETTINGS_HASH = '#settings/superadmin/apps'

interface ApiToastOptions {
  /** Settings hash the link opens; defaults to the Modules screen. */
  settingsHash?: string
  /** True only for a super admin: both target screens are super-admin-only, so nobody else gets the link (§3 no fake affordance). */
  canFix?: boolean
}

export function apiErrorToast(
  err: unknown,
  t: Parameters<typeof apiErrorMessage>[1],
  fallback: string,
  opts: ApiToastOptions = {},
): { message: string; options?: { deepLink: string; duration: number } } {
  const message = apiErrorMessage(err, t, fallback)
  // A linked toast stays 10 s so the link can be reached.
  return apiErrorCode(err) === 'module_not_enabled' && opts.canFix === true
    ? { message, options: { deepLink: opts.settingsHash ?? MODULES_SETTINGS_HASH, duration: 10000 } }
    : { message }
}

// Shows the error toast for a failed call: translated message plus the optional deep link.
export function notifyApiError(err: unknown, t: Parameters<typeof apiErrorMessage>[1], fallback: string, opts: ApiToastOptions = {}): void {
  const { message, options } = apiErrorToast(err, t, fallback, opts)
  // The two-argument shorthand keeps consumer tests that mock '@/lib/notify' with only notifyError valid.
  if (options) notify('error', message, options)
  else notifyError(message)
}
