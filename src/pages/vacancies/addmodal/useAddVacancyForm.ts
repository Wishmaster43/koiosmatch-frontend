/**
 * useAddVacancyForm — all state/lookups/cascade/submit logic for the "+
 * Vacature" create form (SLICE 1+2, Danny's 22-point spec). Extracted out of the
 * assembler (unlike the smaller AddCandidateModal, which keeps its state
 * inline) because this form spans many cards and 30+ fields — keeping that
 * volume of state in the component would blow AddVacancyModal.tsx past the
 * ~400-line split trigger (§3). Mirrors useVacancyDetailsForm's role for the
 * drawer: components stay dumb, this hook owns the logic. SLICE 2 (punten
 * 17-22) adds: Koios-AI generate fields, an optional match-weight template +
 * override, an AI-agent link (module+permission gated), publication state, and
 * the post-create documents/note orchestration (via the caller-owned
 * usePostCreateAttachments controller, kept a SEPARATE hook on purpose).
 */
import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { extractApiError } from '@/lib/extractApiError'
import api, { unwrap } from '@/lib/api'
import { useVacancyLookups } from '@/context/VacancyLookupsContext'
import { useLookups } from '@/context/LookupsContext'
import { useIndustries } from '@/lib/useIndustries'
import { useFunctions } from '@/lib/useFunctions'
import { useLocations } from '@/lib/useLocations'
import { useProvinces } from '@/hooks/useProvinces'
import { useAuth } from '@/context/AuthContext'
import { useAllSettings, getJsonSetting } from '@/lib/settings/useAllSettings'
import { VACANCY_APP_DEFAULTS_KEY, FALLBACK_APP_SETTINGS } from '../data/applicationSettingsDefaults'
import { useCascadePickers } from '../hooks/useCascadePickers'
import { useVacancyBranchDefault } from './useVacancyBranchDefault'
import { composeAddress } from '../hooks/useVacancyDetailsForm'
import { mapVacancy } from '../data/mapVacancy'
import type { PublicationChannel } from './PublicationCard'
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
  ai_agent_id: 'aiAgentId', published: 'published', published_channels: 'publishedChannels',
  application_settings: 'applicationSettings',
}

export interface VacancyCreateForm {
  title: string; status: string; ownerId: string; clientId: string; industry: string; category: string
  contractTypes: string[]; startDate: string; endDate: string
  street: string; houseNumber: string; houseNumberSuffix: string; postalCode: string; city: string; province: string; country: string
  // Vestiging (bureau) — the TENANT'S OWN establishment (`/locations`), POSTed as
  // `location_id`. Never confuse this with `customerLocationId` below (the
  // KLANT's own site from the cascade) — two different "location" concepts
  // that have collided in this codebase before (see PlacementCard's comment).
  branchId: string
  seniority: string; education: string
  salaryMin: string; salaryMax: string; salaryPeriod: string; hoursMin: string; hoursMax: string
  description: string
}

type AddressKey = 'street' | 'houseNumber' | 'houseNumberSuffix' | 'postalCode' | 'city' | 'province' | 'country'
type ConditionsKey = 'salaryMin' | 'salaryMax' | 'salaryPeriod' | 'hoursMin' | 'hoursMax'

interface ModalUser { id: Id; name: string }
interface ModalCustomer { id: Id; name: string }

// The minimal shape this hook needs from usePostCreateAttachments (interface
// segregation — this file never needs to know its full internal state).
interface AttachmentsController { hasPending: boolean; runSequence: (id: Id) => Promise<void> }

interface Args {
  onClose: () => void
  onCreated?: (v: Vacancy) => void
  users: ModalUser[]
  customers: ModalCustomer[]
  lockCustomerId?: string
  initialCustomerLocationId?: string; initialCustomerDepartmentId?: string
  initialCustomerLocationName?: string; initialCustomerDepartmentName?: string
  initialIndustry?: string
  // SLICE 2 (punten 21+22): the post-create documents/note controller — a
  // SEPARATE hook the assembler owns, handed in so submit can sequence it.
  attachments?: AttachmentsController
}

const NOOP_ATTACHMENTS: AttachmentsController = { hasPending: false, runSequence: async () => {} }

export function useAddVacancyForm({
  onClose, onCreated, users, customers, lockCustomerId,
  initialCustomerLocationId, initialCustomerDepartmentId, initialCustomerLocationName, initialCustomerDepartmentName,
  initialIndustry, attachments = NOOP_ATTACHMENTS,
}: Args) {
  const { t } = useTranslation(['vacancies', 'common'])
  const { statuses, seniorityLevels, educationLevels, defaultSeniority, defaultEducation, channels: channelLookup } = useVacancyLookups()
  // Contract types are a CANDIDATE-axis lookup (Contractvorm), shared with the
  // drawer's DetailsGeneralTab — same source, never a second copy.
  const { candidateTypes } = useLookups() as unknown as { candidateTypes: Array<{ value: string; label: string; color?: string }> }
  const { industries } = useIndustries()
  const { functions } = useFunctions()
  const branchOptions = useLocations().map(l => ({ value: String(l.value), label: l.label }))
  const authCtx = useAuth() as unknown as {
    user: { id?: Id; name?: string } | null
    hasModule?: (key: string) => boolean
    hasPermission?: (perm: string) => boolean
  }
  const { user: me, hasModule, hasPermission } = authCtx
  const meIsAssignable = me?.id != null && users.some(u => String(u.id) === String(me.id))

  // Punt 19: the AI-agent card only exists for a tenant with the module AND a
  // caller with settings.view (GET /ai/agents is gated on both, measured) —
  // rendered as NOTHING when either is missing, never a disabled tease (§3).
  const showAiAgentCard = (hasModule?.('aiagents') ?? false) && (hasPermission?.('settings.view') ?? false)
  // Punten 21+22: both POST .../documents and POST .../notes need vacancies.update
  // next to vacancies.create (measured) — the attachment cards gate on that.
  const showAttachmentCards = hasPermission?.('vacancies.update') ?? false

  const [errors, setErrors] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  // Punten 21+22: once Create succeeds AND there is a pending file/note, the
  // modal switches to the results panel instead of closing immediately.
  const [postCreatePhase, setPostCreatePhase] = useState(false)

  // Status pill default (punt 7) — never a hardcoded slug, only the tenant's
  // flagged default or the lookup's first entry; a genuinely empty lookup
  // leaves it '' so no pill lights up and the body sends `status: null`.
  const defaultStatus = () => statuses.find(s => (s as { is_default?: boolean }).is_default)?.value ?? statuses[0]?.value ?? ''

  const [form, setForm] = useState<VacancyCreateForm>({
    title: '', status: defaultStatus(), ownerId: '', clientId: lockCustomerId ?? '', industry: '', category: '',
    contractTypes: [], startDate: '', endDate: '',
    street: '', houseNumber: '', houseNumberSuffix: '', postalCode: '', city: '', province: '', country: '',
    branchId: '',
    seniority: '', education: '',
    salaryMin: '', salaryMax: '', salaryPeriod: '', hoursMin: '', hoursMax: '',
    description: '',
  })

  const set = <K extends keyof VacancyCreateForm>(k: K, v: VacancyCreateForm[K]) => {
    setForm(f => ({ ...f, [k]: v }))
    if (errors[k as string]) setErrors(e => ({ ...e, [k as string]: false }))
    setCreateError(null)
  }
  const onAddressChange = (k: AddressKey, v: string) => set(k, v)
  const onConditionsChange = (k: ConditionsKey, v: string) => set(k, v)

  // Once the real statuses lookup answers, backfill the default only if nothing
  // was picked yet — never overwrite a value the recruiter already chose.
  useEffect(() => { if (!form.status && statuses.length) set('status', defaultStatus()) }, [statuses]) // eslint-disable-line react-hooks/exhaustive-deps

  // Punt 8: propose the logged-in user as owner ONLY once they are known
  // assignable (mirrors AddCustomerModal's ACCOUNTMANAGER-DEFAULT-1) — a value
  // the recruiter already picked (or picks later) is never overwritten.
  useEffect(() => {
    if (meIsAssignable) setForm(f => (f.ownerId ? f : { ...f, ownerId: String(me!.id) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to assignability resolving
  }, [meIsAssignable])

  // Punt 4: prefill the industry ONLY when it is among the ACTIVE industry names
  // — StoreVacancyRequest validates `industry` against exactly this list, so an
  // inactive/unknown value would 422. Re-checked whenever the resolved list
  // changes (never on the recruiter's own edit), so a seed-vs-real-fetch race
  // can never wrongly leave a valid value out.
  useEffect(() => {
    if (!initialIndustry || form.industry) return
    if (industries.includes(initialIndustry)) set('industry', initialIndustry)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-check when the resolved list changes
  }, [industries, initialIndustry])

  // DEFAULTS-1 (mirrors useVacancyDetailsForm): propose the tenant's flagged
  // default seniority/education into an empty field once the lookups resolve.
  useEffect(() => {
    if (!form.seniority && defaultSeniority) set('seniority', defaultSeniority)
    if (!form.education && defaultEducation) set('education', defaultEducation)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the lookups resolving
  }, [defaultSeniority, defaultEducation])

  const toggleContractType = (val: string) =>
    setForm(f => ({ ...f, contractTypes: f.contractTypes.includes(val) ? f.contractTypes.filter(x => x !== val) : [...f.contractTypes, val] }))

  // Country -> province cascade (VAC-COUNTRY-1 pattern): an already-filled
  // province that no longer exists in the new country's list is cleared.
  const { provinces } = useProvinces(form.country)
  useEffect(() => {
    if (form.province && !provinces.includes(form.province)) set('province', '')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the resolved list changing
  }, [provinces])

  // Klant -> locatie -> afdeling -> contactpersoon cascade (punt 6) — seeded from
  // the landed initial props so a "+ Vacature" opened from a location/department
  // drill-down shows that scope pre-picked, still editable (punt 3).
  const emptyCascade = { customerLocationId: '', customerLocationName: '', customerDepartmentId: '', customerDepartmentName: '', contactId: '', contactName: '' }
  const [cascade, setCascade] = useState(() => ({
    customerLocationId: initialCustomerLocationId ?? '', customerLocationName: initialCustomerLocationName ?? '',
    customerDepartmentId: initialCustomerDepartmentId ?? '', customerDepartmentName: initialCustomerDepartmentName ?? '',
    contactId: '', contactName: '',
  }))
  // Picking a different client resets the dependent cascade picks (integrity).
  const handleClientChange = (id: string) => { set('clientId', id); setCascade(emptyCascade) }
  // VAC-VESTIGING-1: cosmetic branch (vestiging) proposal — the picked customer's
  // own mirrored branch, re-proposed on every customer switch while untouched
  // (see the hook's file header for the freeze-on-edit pattern).
  const { handleBranchChange } = useVacancyBranchDefault(form.clientId, (v: string) => set('branchId', v))
  const { locationPicker, departmentPicker, contactPicker } = useCascadePickers({
    clientId: form.clientId,
    customerLocationId: cascade.customerLocationId,
    onLocationChange: p => setCascade(c => ({ ...c, customerLocationId: p.id, customerLocationName: p.name })),
    customerDepartmentId: cascade.customerDepartmentId,
    onDepartmentChange: p => setCascade(c => ({ ...c, customerDepartmentId: p.id, customerDepartmentName: p.name })),
    contactId: cascade.contactId,
    onContactChange: p => setCascade(c => ({ ...c, contactId: p.id, contactName: p.name })),
  })

  // Required skills — free strings, quick-add/remove (punt 15).
  const [skills, setSkills] = useState<string[]>([])
  const [newSkill, setNewSkill] = useState('')
  const addSkill = () => { const sk = newSkill.trim(); if (sk && !skills.includes(sk)) setSkills(s => [...s, sk]); setNewSkill('') }
  const removeSkill = (s: string) => setSkills(list => list.filter(x => x !== s))

  // Description — the collapsed-ghost rich-text block's own open/edit state
  // (punt 9). Punt 17: the Koios-AI generate flow reads a narrow projection of
  // `form` (never the whole object, so the generate flow's dependency stays cheap).
  const [descExpanded, setDescExpanded] = useState(false)
  const [descEditing, setDescEditing] = useState(false)
  const customerName = customers.find(c => String(c.id) === form.clientId)?.name ?? ''
  const genFields = {
    title: form.title, category: form.category, industry: form.industry, contractTypes: form.contractTypes,
    city: form.city, hoursMin: form.hoursMin, hoursMax: form.hoursMax, customerName,
  }

  // Punt 18: Matchprofiel — an optional template id + an optional explicit
  // override. Picking a template alone sends only the id (server snapshots its
  // weights); touching a slider marks an override, sent alongside it.
  const [matchWeightTemplateId, setMatchWeightTemplateId] = useState('')
  const [matchWeights, setMatchWeights] = useState<Record<string, number> | null>(null)

  // Punt 19: AI-agent — a single optional link (card only rendered when
  // showAiAgentCard is true, but the field itself is harmless either way).
  const [aiAgentId, setAiAgentId] = useState('')

  // Punt 20: Publicatie — published flag, per-channel publish state and the
  // application-form settings (cv/cover_letter/photo/remarks/interview_consent).
  const allSettings = useAllSettings()
  // Memoized on the RAW stored value (a stable string/undefined), not recomputed every
  // render: getJsonSetting JSON.parses a configured setting into a NEW object each call,
  // which would otherwise hand the effect below an unstable dependency and loop forever
  // (measured — an unstable mock reference reproduced this exact hang in tests).
  const rawAppDefaults = (allSettings as Record<string, unknown>)[VACANCY_APP_DEFAULTS_KEY]
  const tenantAppDefaults = useMemo(
    () => getJsonSetting<Record<string, unknown>>(allSettings, VACANCY_APP_DEFAULTS_KEY, FALLBACK_APP_SETTINGS),
    [rawAppDefaults], // eslint-disable-line react-hooks/exhaustive-deps -- allSettings is a stable cache object; only this one key's raw value should force a re-parse
  )
  const [published, setPublished] = useState(false)
  const [channels, setChannels] = useState<PublicationChannel[]>([])
  useEffect(() => {
    // Seed the channel list once the tenant lookup resolves — never clobber a
    // recruiter's own toggles on a later re-render of the (rarely changing) lookup.
    if (channels.length === 0 && channelLookup.length) {
      setChannels(channelLookup.map(c => ({ value: c.value, label: c.label, published: false })))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the lookup resolving
  }, [channelLookup])
  const toggleChannel = (value: string, next: boolean) => setChannels(cs => cs.map(c => (c.value === value ? { ...c, published: next } : c)))
  const [applicationSettings, setApplicationSettingsState] = useState<Record<string, unknown>>(() => ({ ...FALLBACK_APP_SETTINGS }))
  const [applicationSettingsTouched, setApplicationSettingsTouched] = useState(false)
  useEffect(() => {
    // Backfill the tenant's own defaults once resolved — same one-shot-if-
    // untouched guard as the seniority/education defaults above.
    if (!applicationSettingsTouched) setApplicationSettingsState(tenantAppDefaults)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the tenant defaults resolving
  }, [tenantAppDefaults])
  const setApplicationSetting = (field: string, value: unknown) => {
    setApplicationSettingsTouched(true)
    setApplicationSettingsState(s => ({ ...s, [field]: value }))
  }

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

  const canSubmit = !!form.title.trim()
  // Owner options: make sure the logged-in default is actually IN the list (a
  // super admin isn't always in the assignable list — mirrors AddCandidateModal).
  const userOptions = users.map(u => ({ value: String(u.id), label: u.name }))
  if (me?.id && !userOptions.some(o => o.value === String(me.id))) {
    userOptions.unshift({ value: String(me.id), label: me.name ?? '' })
  }

  return {
    t, form, set, onAddressChange, onConditionsChange, errors, saving, createError, canSubmit, handleSubmit,
    statuses, statusOptions: statuses.map(s => ({ value: s.value, label: s.label, color: s.color })),
    industries, functions, branchOptions, handleBranchChange, candidateTypes, toggleContractType,
    seniorityLevels, educationLevels, provinces,
    customerOptions: customers.map(c => ({ value: String(c.id), label: c.name })),
    userOptions,
    handleClientChange, locationPicker, departmentPicker, contactPicker,
    skills, newSkill, setNewSkill, addSkill, removeSkill,
    descExpanded, setDescExpanded, descEditing, setDescEditing, genFields,
    // Punt 18
    matchWeightTemplateId, setMatchWeightTemplateId, matchWeights, setMatchWeights,
    // Punt 19
    showAiAgentCard, aiAgentId, setAiAgentId,
    // Punt 20 — applicationSettingsTouched is exposed so the assembler's
    // CollapsedCard `filled` indicator (A+D layout, Danny 03-08) can tell a
    // touched-but-unpublished settings edit apart from the untouched default.
    published, setPublished, channels, toggleChannel, applicationSettings, setApplicationSetting, applicationSettingsTouched,
    // Punten 21+22
    showAttachmentCards, postCreatePhase,
  }
}
