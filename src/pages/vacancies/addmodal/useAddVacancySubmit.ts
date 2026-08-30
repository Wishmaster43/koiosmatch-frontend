/**
 * useAddVacancySubmit — the "+ Vacature" create form's submit/payload builder:
 * required-field validation, the conditional POST body (every optional field
 * rides only when filled), the create call, 422 field-error mapping, and the
 * post-create documents/notes hand-off (punten 21+22). Extracted verbatim
 * (§3 size split, > ~400-line trigger) out of useAddVacancyForm — behaviour
 * unchanged, only wired through explicit params/returns instead of closure.
 */
import { useState } from 'react'
import type { TFunction } from 'i18next'
import { extractApiError } from '@/lib/extractApiError'
import api, { unwrap } from '@/lib/api'
import { composeAddress } from '../hooks/useVacancyDetailsForm'
import { mapVacancy } from '../data/mapVacancy'
import type { PublicationChannel } from './PublicationCard'
import type { VacancyCreateForm } from './useAddVacancyForm'
import type { ApiVacancy, Vacancy } from '@/types/vacancy'
import type { Id } from '@/types/common'

// 422 field-error keys (snake_case, the MEASURED StoreVacancyRequest/VacancyWriter
// vocabulary) mapped back onto this form's own field names.
const API_TO_FORM: Record<string, string> = {
  title: 'title', status: 'status', owner_id: 'ownerId', customer_id: 'clientId',
  industry: 'industry', category: 'category', location: 'location',
  customer_location_id: 'customerLocationId', customer_department_id: 'customerDepartmentId', contact_id: 'contactId',
  contract_types: 'contractTypes', start_date: 'startDate', end_date: 'endDate',
  street: 'street', house_number: 'houseNumber', house_number_suffix: 'houseNumberSuffix',
  postcode: 'postalCode', city: 'city', province: 'province', country: 'country',
  location_id: 'branchId', seniority: 'seniority', education: 'education', skills: 'skills',
  salary_min: 'salaryMin', salary_max: 'salaryMax', salary_period: 'salaryPeriod',
  hours_min: 'hoursMin', hours_max: 'hoursMax', description: 'description',
  match_weight_template_id: 'matchWeightTemplateId', match_weights: 'matchWeights',
  ai_agent_id: 'aiAgentId', interview_workflow_id: 'interviewWorkflowId', published: 'published', published_channels: 'publishedChannels',
  application_settings: 'applicationSettings',
}

// The minimal shape this hook needs from usePostCreateAttachments (interface
// segregation — this file never needs to know its full internal state).
interface AttachmentsController { hasPending: boolean; runSequence: (id: Id) => Promise<void> }

interface Cascade { customerLocationId: string; customerDepartmentId: string; contactId: string }

interface Args {
  // Error state is owned by the form hook (it must exist before its `set()`
  // closure); only the SETTERS are injected — the 422 mapping lands there.
  setErrors: (v: Record<string, boolean> | ((e: Record<string, boolean>) => Record<string, boolean>)) => void
  setCreateError: (v: string | null) => void
  form: VacancyCreateForm
  cascade: Cascade
  skills: string[]
  channels: PublicationChannel[]
  matchWeightTemplateId: string
  matchWeights: Record<string, number> | null
  aiAgentId: string
  // INTERVIEW-WORKFLOW-1 (Appendix D/E): an optional, ungated companion field.
  interviewWorkflowId: string
  published: boolean
  applicationSettings: Record<string, unknown>
  applicationSettingsTouched: boolean
  showAttachmentCards: boolean
  attachments: AttachmentsController
  onClose: () => void
  onCreated?: (v: Vacancy) => void
  t: TFunction
}

// Owns validation, error state and the create submit handler for the "+ Vacature" form.
export function useAddVacancySubmit({
  setErrors, setCreateError,
  form, cascade, skills, channels, matchWeightTemplateId, matchWeights, aiAgentId, interviewWorkflowId, published,
  applicationSettings, applicationSettingsTouched, showAttachmentCards, attachments, onClose, onCreated, t,
}: Args) {
  const [saving, setSaving] = useState(false)
  // Punten 21+22: once Create succeeds AND there is a pending file/note, the
  // modal switches to the results panel instead of closing immediately.
  const [postCreatePhase, setPostCreatePhase] = useState(false)

  // Validate, build the conditional POST body (every optional field rides only
  // when filled), create the vacancy, then hand off to any pending post-create
  // documents/notes before closing — or map 422 field errors back onto the form.
  const handleSubmit = async () => {
    if (!form.title.trim()) { setErrors({ title: true }); return }
    setSaving(true)
    setCreateError(null)
    // The single free-text `location` column is DERIVED from the structured
    // address (mirrors the drawer's saveLocation) — never a second, manually
    // typed source of truth for the same displayed place.
    const composedLocation = composeAddress(form.street, form.houseNumber, form.houseNumberSuffix, form.postalCode, form.city)
    const publishedOnChannels = channels.filter(c => c.published)
    try {
      const body = {
        title: form.title.trim(),
        status: form.status || null,
        owner_id: form.ownerId || null,
        customer_id: form.clientId || null,
        industry: form.industry || null,
        category: form.category || null,
        location: composedLocation || null,
        // Every field below rides the body CONDITIONALLY (absent when empty) —
        // the base create (title only) stays byte-identical to the pre-SLICE-1 body.
        ...(cascade.customerLocationId ? { customer_location_id: cascade.customerLocationId } : {}),
        ...(cascade.customerDepartmentId ? { customer_department_id: cascade.customerDepartmentId } : {}),
        ...(cascade.contactId ? { contact_id: cascade.contactId } : {}),
        ...(form.contractTypes.length ? { contract_types: form.contractTypes } : {}),
        ...(form.startDate ? { start_date: form.startDate } : {}),
        ...(form.endDate ? { end_date: form.endDate } : {}),
        ...(form.street ? { street: form.street } : {}),
        ...(form.houseNumber ? { house_number: form.houseNumber } : {}),
        ...(form.houseNumberSuffix ? { house_number_suffix: form.houseNumberSuffix } : {}),
        ...(form.postalCode ? { postcode: form.postalCode } : {}),
        ...(form.city ? { city: form.city } : {}),
        ...(form.province ? { province: form.province } : {}),
        ...(form.country ? { country: form.country } : {}),
        ...(form.branchId ? { location_id: form.branchId } : {}),
        ...(form.seniority ? { seniority: form.seniority } : {}),
        ...(form.education ? { education: form.education } : {}),
        ...(skills.length ? { skills } : {}),
        ...(form.salaryMin ? { salary_min: form.salaryMin } : {}),
        ...(form.salaryMax ? { salary_max: form.salaryMax } : {}),
        ...(form.salaryPeriod ? { salary_period: form.salaryPeriod } : {}),
        ...(form.hoursMin ? { hours_min: form.hoursMin } : {}),
        ...(form.hoursMax ? { hours_max: form.hoursMax } : {}),
        ...(form.description ? { description: form.description } : {}),
        // Punt 18: explicit template/weights — explicit match_weights always
        // wins server-side even when a template id also rides along.
        ...(matchWeightTemplateId ? { match_weight_template_id: matchWeightTemplateId } : {}),
        ...(matchWeights ? { match_weights: matchWeights } : {}),
        // Punt 19: AI-agent link.
        ...(aiAgentId ? { ai_agent_id: aiAgentId } : {}),
        // INTERVIEW-WORKFLOW-1 (Appendix D/E): optional companion link.
        ...(interviewWorkflowId ? { interview_workflow_id: interviewWorkflowId } : {}),
        // Punt 20: publication — only sent when touched away from "nothing yet".
        ...(published ? { published: true } : {}),
        ...(publishedOnChannels.length
          ? { published_channels: publishedOnChannels.map(c => ({ value: c.value, published: true })) }
          : {}),
        ...(applicationSettingsTouched ? { application_settings: applicationSettings } : {}),
      }
      const r = await api.post('/vacancies', body)
      const created = mapVacancy(unwrap<ApiVacancy>(r))
      onCreated?.(created)
      // Punten 21+22: the vacancy exists now — run pending documents/note (in
      // order) and show their per-item outcome instead of closing immediately.
      // Nothing pending (the common case) keeps the exact pre-SLICE-2 behaviour.
      if (showAttachmentCards && attachments.hasPending && created.id != null) {
        setPostCreatePhase(true)
        await attachments.runSequence(created.id)
      } else {
        onClose()
      }
    } catch (err) {
      const e = err as { response?: { data?: { errors?: Record<string, unknown>; message?: string } } }
      const apiErrors = e?.response?.data?.errors
      if (apiErrors) {
        const e2: Record<string, boolean> = {}
        Object.keys(apiErrors).forEach(k => { e2[API_TO_FORM[k] ?? k] = true })
        setErrors(e2)
      } else {
        setCreateError(extractApiError(err, t('common:errorGeneric')))
      }
    } finally {
      setSaving(false)
    }
  }

  return { saving, postCreatePhase, handleSubmit }
}
