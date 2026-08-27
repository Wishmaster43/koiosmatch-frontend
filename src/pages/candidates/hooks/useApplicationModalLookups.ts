/**
 * useApplicationModalLookups — APPMODAL-SPLIT-1: the tenant-lookup wiring for
 * AddApplicationModal (vacancy/stage/user/source/custom-field lookups, the
 * APP-REQUIRED-FE-1 required-fields flags and the AXIS-MATRIX-2 preflight),
 * extracted out of the container so it only wires the form hook + JSX.
 * Mirrors pages/vacancies/addmodal/useAddVacancyLookups's role for that form.
 */
import { useState } from 'react'
import { useVacancyOptions } from './useVacancyOptions'
import { useApplicationStages } from '@/hooks/useApplicationStages'
import { useActionRulePreflight } from '@/components/actionrules'
import { useAuth } from '@/context/AuthContext'
import { useUsers } from '@/lib/queries'
import { useApplicationSources } from '@/lib/useApplicationSources'
import { useCustomFields } from '@/lib/useCustomFields'
import { useAllSettings, getJsonSetting } from '@/lib/settings/useAllSettings'
import type { Id } from '@/types/common'

export function useApplicationModalLookups({ candidateId, editing }: { candidateId: Id; editing: boolean }) {
  // W30: server-searched vacancy options — the typed query (debounced inside
  // CreatableSelect's own onSearch) narrows the picker for >100-vacancy tenants.
  const [vacancySearch, setVacancySearch] = useState('')
  const vacancyOptions = useVacancyOptions(true, vacancySearch)
  // S24b: the real stage id (not just the slug) — needed to submit application_stage_id.
  const { stages, defaultStage } = useApplicationStages()

  // APP-OWNER-1: recruiter default inputs — the tenant's assignable users list and
  // the logged-in user (chain's last rung; a non-tenant login, e.g. a super-admin,
  // is never proposed as an owner).
  const { user: me } = useAuth() as unknown as { user: { id?: Id; name?: string } | null }
  const { data: users = [] } = useUsers() as { data?: { id: Id; name: string }[] }
  const userOptions = users.map(u => ({ value: String(u.id), label: u.name }))
  const meIsAssignable = me?.id != null && userOptions.some(o => o.value === String(me.id))

  // Acquisition source — searchable/creatable tenant lookup, mirrors ApplicationDetailsCard.
  const { sources: sourceOptions, allowFreeEntry: sourceAllowFreeEntry } = useApplicationSources()

  // W30: the tenant's active custom-field defs for applications (StoreApplicationRequest
  // also accepts `custom_fields`) — the "Extra" section only renders once ≥1 active
  // def exists (§3A(f)).
  const { fields: customFieldDefs } = useCustomFields('application')
  const simpleCustomFields = customFieldDefs.filter(f => f.type !== 'textarea')
  const textCustomFields = customFieldDefs.filter(f => f.type === 'textarea')

  // APP-REQUIRED-FE-1: tenant-configurable required fields for this popup (Settings
  // → Sollicitaties → Verplichte velden), create only — the backend guard runs on
  // store, never on update (an ungated flag would over-enforce on PATCH).
  const settingsValues = useAllSettings()
  const requiredActive = !editing
  const requiredFields = getJsonSetting<string[]>(settingsValues, 'application_required_fields', [])
  const sourceRequired = requiredActive && requiredFields.includes('source')
  const vacancyRequired = requiredActive && requiredFields.includes('vacancy_id')
  const ownerRequired = requiredActive && requiredFields.includes('owner_id')
  const phaseRequired = requiredActive && requiredFields.includes('application_stage_id')

  // AXIS-MATRIX-2 preflight (mirrors MatchModal's match.create wiring): POST
  // /applications enforces application.create against the candidate server-side —
  // warn banners only, block additionally disables Create. Edit mode never
  // creates anything, so its effect on the form is gated (the decision itself
  // stays loaded — Rules of Hooks).
  const { decision: appRuleDecision } = useActionRulePreflight('application.create', { candidateId: String(candidateId || '') })
  const appRuleBlocked = !editing && appRuleDecision?.effect === 'block'

  return {
    vacancyOptions, setVacancySearch, stages, defaultStage,
    userOptions, meId: me?.id, meIsAssignable,
    sourceOptions, sourceAllowFreeEntry,
    customFieldDefs, simpleCustomFields, textCustomFields,
    vacancyRequired, phaseRequired, ownerRequired, sourceRequired,
    appRuleDecision, appRuleBlocked,
  }
}
