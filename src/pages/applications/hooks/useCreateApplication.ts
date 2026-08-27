/**
 * useCreateApplication — the POST /applications submit for
 * pages/applications/AddApplicationModal, including the client-side required-field
 * preflight and 422 field-error mapping. Extracted verbatim (R6) from that file —
 * behaviour is unchanged, only the location.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrap } from '@/lib/api'
import { extractApiError } from '@/lib/extractApiError'
import { useLookups } from '@/context/LookupsContext'
import { mapApplication } from '../data/mapApplication'
import type { Application } from '@/types/application'

// 422 field-error keys are snake_case; map them back to this form's field names
// (C-18 — there is no free-text field to highlight here, only pickers, so this
// only sharpens which picker the message is about; the inline message stays).
const API_TO_FORM: Record<string, string> = {
  candidate_id: 'candidateId', vacancy_id: 'vacancyId', owner_id: 'ownerId',
  application_stage_id: 'phase',
}

export function useCreateApplication({
  candidateId, vacancyId, ownerId, phaseId, source, customFieldValues,
  vacancyRequired, ownerRequired, phaseRequired, sourceRequired,
  appRuleBlocked, onCreated,
}: {
  candidateId: string
  vacancyId: string
  ownerId: string
  phaseId: string
  source: string
  customFieldValues: Record<string, unknown>
  vacancyRequired: boolean
  ownerRequired: boolean
  phaseRequired: boolean
  sourceRequired: boolean
  appRuleBlocked: boolean
  onCreated: (app: Application) => void
}) {
  const { t } = useTranslation('applications')
  // Funnel lookup — drives the flag-based bucket resolution in mapApplication (A1).
  const { funnelTypes } = useLookups()

  // Create the application. AUDIT-1 (CRITICAL, 15-07): the old catch fabricated a
  // fake local row (id: -Date.now()) and closed the modal as if it succeeded —
  // masking real failures INCLUDING the matrix-guard 422s. A failure now keeps the
  // modal open and shows the server's message inline.
  const [saving, setSaving] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, boolean>>({})

  const create = async () => {
    // VACATURE-OPTIONEEL (register pt.2): vacancy_id is `sometimes|nullable` on
    // StoreApplicationRequest — an "open application" with no vacancy yet is a
    // real, backend-supported case. Only the candidate is required to submit.
    if (!candidateId || saving || appRuleBlocked) return
    // APP-REQUIRED-FE-1: client-side required-field preflight (UX only, §7 — the
    // backend's own FlatRequiredFieldsGuard('application') on
    // ApplicationController::store is the real enforcement).
    const missing: Record<string, boolean> = {}
    if (vacancyRequired && !vacancyId) missing.vacancyId = true
    if (ownerRequired && !ownerId) missing.ownerId = true
    if (phaseRequired && !phaseId) missing.phase = true
    if (sourceRequired && !source.trim()) missing.source = true
    if (Object.keys(missing).length > 0) { setErrors(missing); return }
    setSaving(true)
    setCreateError(null)
    setErrors({})
    try {
      // application_stage_id is omitted (not null-ed) when unset so the backend's own
      // `?? ApplicationStage::defaultStageId()` fallback decides the start stage
      // source is omitted the same way — an empty field means "let the server default
      // to 'manual'", never an explicit empty-string value. custom_fields only rides
      // along once the recruiter actually filled something in (an empty {} is
      // indistinguishable from "not asked" server-side, so it's omitted too).
      const res = await api.post('/applications', {
        candidate_id: candidateId, vacancy_id: vacancyId || null, owner_id: ownerId || null,
        ...(phaseId ? { application_stage_id: phaseId } : {}),
        ...(source.trim() ? { source: source.trim() } : {}),
        ...(Object.keys(customFieldValues).length ? { custom_fields: customFieldValues } : {}),
      })
      onCreated(mapApplication(unwrap(res), funnelTypes))
    } catch (err) {
      // Show field-level errors from 422 validation responses (highlights the
      // specific picker); fall back to the server's message otherwise.
      const e = err as { response?: { data?: { errors?: Record<string, unknown>; message?: string } } }
      const apiErrors = e?.response?.data?.errors
      if (apiErrors) {
        const e2: Record<string, boolean> = {}
        Object.keys(apiErrors).forEach(k => { e2[API_TO_FORM[k] ?? k] = true })
        setErrors(e2)
      }
      setCreateError(extractApiError(err, t('common:errorGeneric')))
    } finally { setSaving(false) }
  }

  return { create, saving, createError, errors, setErrors }
}
