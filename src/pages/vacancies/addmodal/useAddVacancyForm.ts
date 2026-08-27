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
 *
 * The tenant lookups + derived option lists (§3 size split) live in
 * `useAddVacancyLookups`; the submit/payload builder (§3 size split) lives in
 * `useAddVacancySubmit`. Both are composed below so this hook's own return
 * shape stays identical.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useProvinces } from '@/hooks/useProvinces'
import { useCascadePickers } from '../hooks/useCascadePickers'
import { useVacancyBranchDefault } from './useVacancyBranchDefault'
import { FALLBACK_APP_SETTINGS } from '../data/applicationSettingsDefaults'
import { useVacancyAgentDefault } from './useVacancyAgentDefault'
import { useAddVacancyLookups } from './useAddVacancyLookups'
import { useAddVacancySubmit } from './useAddVacancySubmit'
import type { PublicationChannel } from './PublicationCard'
import type { Vacancy } from '@/types/vacancy'
import type { Id } from '@/types/common'

export interface VacancyCreateForm {
  title: string; status: string; ownerId: string; clientId: string; industry: string; category: string
  contractTypes: string[]; startDate: string; endDate: string
  street: string; houseNumber: string; houseNumberSuffix: string; postalCode: string; city: string; province: string; country: string
  // Branch (agency) — the TENANT'S OWN establishment (`/locations`), POSTed as
  // `location_id`. Never confuse this with `customerLocationId` below (the
  // CUSTOMER's own site from the cascade) — two different "location" concepts
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

// Owns every field, lookup, cascade and default for the "+ Vacature" create form,
// plus its submit → POST /vacancies and the post-create attachments hand-off.
export function useAddVacancyForm({
  onClose, onCreated, users, customers, lockCustomerId,
  initialCustomerLocationId, initialCustomerDepartmentId, initialCustomerLocationName, initialCustomerDepartmentName,
  initialIndustry, attachments = NOOP_ATTACHMENTS,
}: Args) {
  const { t } = useTranslation(['vacancies', 'common'])
  // Tenant lookups + derived option lists (§3 size split) — see the file header.
  const {
    me, meIsAssignable, statuses, seniorityLevels, educationLevels, defaultSeniority, defaultEducation, channelLookup,
    candidateTypes, industries, functions, branchOptions, showAiAgentCard, showAttachmentCards, aiAgents,
    tenantAppDefaults, userOptions, statusOptions, customerOptions,
  } = useAddVacancyLookups({ users, customers })

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

  // Error state owned by the FORM hook (before `set` and every effect that calls
  // it), then injected into useAddVacancySubmit so its 422 mapping lands here.
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  const [createError, setCreateError] = useState<string | null>(null)

  // Field setter — clears the field's error and any stale create error on change.
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
  // A country switch invalidates a province from the old list — clear it rather
  // than silently submitting a value the new country's list no longer has.
  useEffect(() => {
    if (form.province && !provinces.includes(form.province)) set('province', '')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the resolved list changing
  }, [provinces])

  // Customer -> location -> department -> contact cascade (punt 6) — seeded from
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

  // Required skills — free strings, add/edit/remove (punt 15; K6e widened
  // add to accept a name directly — AdditionalSkillsSection's own inline form
  // owns the input now, no separate `newSkill` field state needed here).
  const [skills, setSkills] = useState<string[]>([])
  const addSkill = (name: string) => { const sk = name.trim(); if (sk && !skills.includes(sk)) setSkills(s => [...s, sk]) }
  const removeSkill = (s: string) => setSkills(list => list.filter(x => x !== s))
  // K6e: rename a staged skill in place (mirrors the drawer's AdditionalSkillsSection
  // edit pencil) — same list position, never a remove+re-add.
  const editSkill = (i: number, name: string) => {
    const sk = name.trim()
    if (!sk) return
    setSkills(list => list.map((x, idx) => (idx === i ? sk : x)))
  }

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
  // Punt 20: seed the vacancy owner's own linked AI agent (agent.user.id ===
  // ownerId), empty when the owner has none — a Koios-marked derivation, never
  // a silent guess (§0).
  const { handleAiAgentChange, showAgentSuggestion } = useVacancyAgentDefault(form.ownerId, aiAgents, setAiAgentId)

  // Punt 20: Publicatie — published flag, per-channel publish state and the
  // application-form settings (cv/cover_letter/photo/remarks/interview_consent).
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
  // Recruiter edited one application-form setting: mark it touched (so the
  // backfill effect above stops overwriting it) and merge in the new value.
  const setApplicationSetting = (field: string, value: unknown) => {
    setApplicationSettingsTouched(true)
    setApplicationSettingsState(s => ({ ...s, [field]: value }))
  }

  // The create submit/payload builder (§3 size split) — see the file header.
  const { saving, postCreatePhase, handleSubmit } = useAddVacancySubmit({
    setErrors, setCreateError,
    form, cascade, skills, channels, matchWeightTemplateId, matchWeights, aiAgentId, published,
    applicationSettings, applicationSettingsTouched, showAttachmentCards, attachments, onClose, onCreated, t,
  })

  const canSubmit = !!form.title.trim()

  return {
    t, form, set, onAddressChange, onConditionsChange, errors, saving, createError, canSubmit, handleSubmit,
    statuses, statusOptions,
    industries, functions, branchOptions, handleBranchChange, candidateTypes, toggleContractType,
    seniorityLevels, educationLevels, provinces,
    customerOptions,
    userOptions,
    handleClientChange, locationPicker, departmentPicker, contactPicker,
    skills, addSkill, removeSkill, editSkill,
    descExpanded, setDescExpanded, descEditing, setDescEditing, genFields,
    // Punt 18
    matchWeightTemplateId, setMatchWeightTemplateId, matchWeights, setMatchWeights,
    // Punt 19 + punt 20 (owner-derived agent suggestion)
    showAiAgentCard, aiAgentId, setAiAgentId: handleAiAgentChange, showAgentSuggestion,
    // Punt 20 — applicationSettingsTouched is exposed so the assembler's
    // CollapsedCard `filled` indicator (A+D layout, Danny 03-08) can tell a
    // touched-but-unpublished settings edit apart from the untouched default.
    published, setPublished, channels, toggleChannel, applicationSettings, setApplicationSetting, applicationSettingsTouched,
    // Punten 21+22
    showAttachmentCards, postCreatePhase,
  }
}
