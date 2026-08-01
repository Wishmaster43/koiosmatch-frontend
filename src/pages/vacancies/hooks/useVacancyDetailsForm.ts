/**
 * useVacancyDetailsForm — the DetailsTab form/cascade/types/skills/save/cancel
 * logic (audit R1 item 6: DetailsTab crossed ~320 lines mixing state with card
 * layout; extracted here mirroring how VacanciesPage got useVacancyInsights).
 *
 * VAC-DETAILS-SPLIT-1 (Danny 24-07): "een potlood zet 21 velden tegelijk in
 * edit-mode ... ruk om te onderhouden" — one shared `editing`/`form` for the
 * whole tab meant a single pencil turned every card into an input at once.
 * Split into FOUR independent sections (Algemeen/Locatie/Eisen/Voorwaarden),
 * mirroring PreferencesZzpTabs: each section owns its own `editing`/`form`/
 * `save`/`cancel`, so saving one never submits another's untouched draft.
 * `buildVacancyPatch` (vacanciesShared.ts) gates every key with `if (key in
 * patch)`, so sending a smaller per-section patch is safe — confirmed against
 * the mapper before splitting; the PATCH payload's CONTENT is unchanged, only
 * the number/grouping of calls differs (one big save → up to four small ones).
 *
 * The description block's own edit state lives in useVacancyDescription
 * (Danny 21-07: Beschrijving moved to its own drawer tab) — untouched here.
 */
import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { useLookups } from '@/context/LookupsContext'
import { useVacancyLookups } from '@/context/VacancyLookupsContext'
import { useIndustries } from '@/lib/useIndustries'
import { useFunctions } from '@/lib/useFunctions'
import { useDateFormat } from '@/lib/datetime'
import { useProvinces } from '@/hooks/useProvinces'
import { useCustomerOptions } from './useCustomerOptions'
import { useCascadePickers } from './useCascadePickers'
import type { VacancyDetail } from '@/types/vacancy'
import type { Id } from '@/types/common'

type UpdateFn = (id: Id | undefined, patch: Record<string, unknown>) => void

// Key unions split per sub-tab — each section's form state only ever holds the
// fields IT owns, so its patch can only ever carry those fields.
export type GeneralKey = 'category' | 'industry' | 'startDate' | 'endDate'
export type LocationKey = 'street' | 'houseNumber' | 'houseNumberSuffix' | 'postalCode' | 'city' | 'province' | 'country'
export type RequirementsKey = 'experienceMin' | 'experienceMax' | 'seniority' | 'education'
export type ConditionsKey = 'salaryMin' | 'salaryMax' | 'hoursMin' | 'hoursMax'

type GeneralForm = Record<GeneralKey, string>
type LocationForm = Record<LocationKey, string>
type RequirementsForm = Record<RequirementsKey, string>
type ConditionsForm = Record<ConditionsKey, string>

// V4-V6 (VACATURES-100): klant → locatie → afdeling → contactpersoon cascade — one
// picked {id,name} per step (VAC-CASCADE-1: seeded from the detail, persisted for real).
type CascadeState = { locationId: string; locationName: string; departmentId: string; departmentName: string; contactId: string; contactName: string }

// Public shape each Details<X>Tab component receives — one section, fully self-contained.
export interface GeneralSection {
  editing: boolean; setEditing: (v: boolean) => void
  form: GeneralForm; setF: (k: GeneralKey, val: string) => void
  save: () => void; cancel: () => void
  clientId: string; handleClientChange: (id: string) => void
  customerOptions: Array<{ value: Id; label: string }>
  cascade: CascadeState
  locationPicker: ReactNode; departmentPicker: ReactNode; contactPicker: ReactNode
  types: string[]; toggleType: (val: string) => void
}
export interface LocationSection {
  editing: boolean; setEditing: (v: boolean) => void
  form: LocationForm; setF: (k: LocationKey, val: string) => void
  save: () => void; cancel: () => void
  provinces: string[]
}
export interface RequirementsSection {
  editing: boolean; setEditing: (v: boolean) => void
  form: RequirementsForm; setF: (k: RequirementsKey, val: string) => void
  save: () => void; cancel: () => void
  skills: string[]; newSkill: string; setNewSkill: (v: string) => void
  addSkill: () => void; removeSkill: (s: string) => void
}
export interface ConditionsSection {
  editing: boolean; setEditing: (v: boolean) => void
  form: ConditionsForm; setF: (k: ConditionsKey, val: string) => void
  save: () => void; cancel: () => void
}

// Normalise a skill entry (string, or an object shape some seeds still carry) to plain text.
const skillStr = (s: unknown): string => (typeof s === 'string' ? s : ((s as { name?: string; label?: string })?.name ?? (s as { label?: string })?.label ?? ''))

// Compose a one-line address from the structured fields (street nr-suffix, postcode city).
export function composeAddress(street: string, houseNumber: string, suffix: string, postalCode: string, city: string): string {
  return [
    [street, [houseNumber, suffix].filter(Boolean).join('-')].filter(Boolean).join(' '),
    [postalCode, city].filter(Boolean).join(' '),
  ].filter(s => s && s.trim()).join(', ')
}

// Generic editing/form-slice state shared by all four sections — one editing
// flag + one form object + a setter, so each section is a fully independent
// pencil (VAC-DETAILS-SPLIT-1's core fix).
function useEditableForm<K extends string>(seed: () => Record<K, string>) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Record<K, string>>(seed)
  const setF = (k: K, val: string) => setForm(p => ({ ...p, [k]: val }))
  const reset = () => setForm(seed())
  return { editing, setEditing, form, setF, reset }
}

export function useVacancyDetailsForm(v: VacancyDetail, onUpdate?: UpdateFn) {
  const { candidateTypes, typeMeta } = useLookups() as unknown as {
    candidateTypes: Array<{ value: string; label: string; color?: string }>
    typeMeta: (v: string) => { label: string; color: string }
  }
  const { seniorityLevels, educationLevels, defaultSeniority, defaultEducation } = useVacancyLookups()
  const { industries } = useIndustries()
  const { functions } = useFunctions() as { functions: Array<string | { value: string; label?: string }> }
  const { formatDate } = useDateFormat()
  const fnOptions = functions.map(f => (typeof f === 'string' ? { value: f, label: f } : { value: f.value, label: f.label ?? f.value }))

  // ---- Algemeen: contract type, id (read-only), dates, client→cascade, function, industry ----
  const seedGeneral = (): GeneralForm => ({ category: v.category, industry: v.industry, startDate: v.startDate, endDate: v.endDate })
  const generalForm = useEditableForm(seedGeneral)
  const [clientId, setClientId] = useState<string>(String(v.clientId ?? ''))
  const [types, setTypes] = useState<string[]>(v.contractTypes ?? [])
  const emptyCascade: CascadeState = { locationId: '', locationName: '', departmentId: '', departmentName: '', contactId: '', contactName: '' }
  const seedCascade = (): CascadeState => ({
    locationId: v.customerLocationId || '', locationName: v.customerLocationName || '',
    departmentId: v.customerDepartmentId || '', departmentName: v.customerDepartmentName || '',
    contactId: v.contactId || '', contactName: v.contactName || '',
  })
  const [savedCascade, setSavedCascade] = useState<CascadeState>(seedCascade)
  const [cascade, setCascade] = useState<CascadeState>(seedCascade)
  // Picking a different client resets the dependent picks (cascade integrity).
  const handleClientChange = (id: string) => { setClientId(id); setCascade(emptyCascade) }
  const { locationPicker, departmentPicker, contactPicker } = useCascadePickers({
    clientId,
    customerLocationId: cascade.locationId,
    onLocationChange: p => setCascade(c => ({ ...c, locationId: p.id, locationName: p.name })),
    customerDepartmentId: cascade.departmentId,
    onDepartmentChange: p => setCascade(c => ({ ...c, departmentId: p.id, departmentName: p.name })),
    contactId: cascade.contactId,
    onContactChange: p => setCascade(c => ({ ...c, contactId: p.id, contactName: p.name })),
  })
  const toggleType = (val: string) => setTypes(p => p.includes(val) ? p.filter(x => x !== val) : [...p, val])
  // Customer options load only while the Algemeen pencil is open (capped page, React Query).
  const customerOptions = useCustomerOptions(generalForm.editing)
  const saveGeneral = () => {
    onUpdate?.(v.id, {
      // Client lives in Algemeen (header stays calm) — send the name too for optimistic UI.
      clientId, clientName: customerOptions.find(c => String(c.value) === clientId)?.label ?? v.clientName,
      // V3-V6 / VAC-CASCADE-1: persisted for real (buildVacancyPatch → customer_location_id/
      // customer_department_id/contact_id, whitelisted in VacancyWriter's scalar passthrough).
      customerLocationId: cascade.locationId || null, customerDepartmentId: cascade.departmentId || null, contactId: cascade.contactId || null,
      contractTypes: types, category: generalForm.form.category, industry: generalForm.form.industry,
      // VAC-DATES-1: runtime window (BE validates end_date after_or_equal:start_date).
      startDate: generalForm.form.startDate, endDate: generalForm.form.endDate,
    })
    setSavedCascade(cascade)
    generalForm.setEditing(false)
  }
  const cancelGeneral = () => {
    generalForm.reset(); setClientId(String(v.clientId ?? '')); setTypes(v.contractTypes ?? [])
    setCascade(savedCascade)
    generalForm.setEditing(false)
  }

  // ---- Locatie: structured address + country→province cascade ----
  const seedLocation = (): LocationForm => ({
    street: v.street, houseNumber: v.houseNumber, houseNumberSuffix: v.houseNumberSuffix, postalCode: v.postalCode, city: v.city,
    province: v.province, country: v.country,
  })
  const locationForm = useEditableForm(seedLocation)
  // VAC-COUNTRY-1 (Danny 22-07, punt 2): province list CASCADES on the picked
  // country, mirroring the candidate ProfileTab/AddCandidateModal pattern exactly
  // — its own cache slot per country (useProvinces), so switching country never
  // leaks another country's list in. If the country changes and the currently
  // filled province no longer exists in the new list, clear it rather than
  // silently keep a mismatch.
  const { provinces } = useProvinces(locationForm.form.country)
  useEffect(() => {
    if (locationForm.form.province && !provinces.includes(locationForm.form.province)) locationForm.setF('province', '')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the resolved province list changing, not every form edit
  }, [provinces])
  const saveLocation = () => {
    const location = composeAddress(locationForm.form.street, locationForm.form.houseNumber, locationForm.form.houseNumberSuffix, locationForm.form.postalCode, locationForm.form.city)
    onUpdate?.(v.id, {
      street: locationForm.form.street, houseNumber: locationForm.form.houseNumber, houseNumberSuffix: locationForm.form.houseNumberSuffix,
      postalCode: locationForm.form.postalCode, city: locationForm.form.city, province: locationForm.form.province, country: locationForm.form.country, location,
    })
    locationForm.setEditing(false)
  }
  const cancelLocation = () => { locationForm.reset(); locationForm.setEditing(false) }

  // ---- Eisen: ervaring/senioriteit/opleiding + the required-skills list ----
  const seedRequirements = (): RequirementsForm => ({
    experienceMin: v.experienceMin, experienceMax: v.experienceMax, seniority: v.seniorityValue, education: v.educationValue,
  })
  const requirementsForm = useEditableForm(seedRequirements)
  // DEFAULTS-1 (V11/V19): propose the tenant's flagged default seniority/education
  // into an EMPTY field the moment the Eisen pencil opens. Proposal only — it is
  // visible in the open form and still needs Save, and a field that already holds a
  // value is never touched (mirrors useMatchForm's contract-type proposal).
  // Runs when edit mode opens or the lookups resolve, so an async lookup still lands.
  useEffect(() => {
    if (!requirementsForm.editing) return
    if (!requirementsForm.form.seniority && defaultSeniority) requirementsForm.setF('seniority', defaultSeniority)
    if (!requirementsForm.form.education && defaultEducation) requirementsForm.setF('education', defaultEducation)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to opening the editor / the lookups resolving, never to the recruiter's own pick
  }, [requirementsForm.editing, defaultSeniority, defaultEducation])
  const [skills, setSkills] = useState<string[]>(() => (v.skills ?? []).map(skillStr).filter(Boolean))
  const [newSkill, setNewSkill] = useState('')
  // Skills are quick-editable OUTSIDE the pencil (Danny 2026-07-06: "kan ik niet
  // invullen"): adding/removing persists immediately; while the Eisen pencil is
  // open the change rides along with ITS Save instead (skills moved into this
  // section — see DetailsRequirementsTab's file comment for why).
  const persistSkills = (next: string[]) => { setSkills(next); if (!requirementsForm.editing) onUpdate?.(v.id, { skills: next }) }
  const addSkill = () => { const sk = newSkill.trim(); if (sk && !skills.includes(sk)) persistSkills([...skills, sk]); setNewSkill('') }
  const removeSkill = (s: string) => persistSkills(skills.filter(x => x !== s))
  const saveRequirements = () => {
    const sen = seniorityLevels.find(s => s.value === requirementsForm.form.seniority)
    const edu = educationLevels.find(e => e.value === requirementsForm.form.education)
    onUpdate?.(v.id, {
      experienceMin: requirementsForm.form.experienceMin, experienceMax: requirementsForm.form.experienceMax,
      seniorityValue: requirementsForm.form.seniority, seniority: sen?.label ?? '',
      educationValue: requirementsForm.form.education, education: edu?.label ?? '',
      skills,
    })
    requirementsForm.setEditing(false)
  }
  const cancelRequirements = () => {
    requirementsForm.reset()
    setSkills((v.skills ?? []).map(skillStr).filter(Boolean)); setNewSkill('')
    requirementsForm.setEditing(false)
  }

  // ---- Voorwaarden: salary/hours ----
  const seedConditions = (): ConditionsForm => ({ salaryMin: v.salaryMin, salaryMax: v.salaryMax, hoursMin: v.hoursMin, hoursMax: v.hoursMax })
  const conditionsForm = useEditableForm(seedConditions)
  const saveConditions = () => {
    const salary = [conditionsForm.form.salaryMin, conditionsForm.form.salaryMax].filter(Boolean).join(' – ')
    const hours = [conditionsForm.form.hoursMin, conditionsForm.form.hoursMax].filter(Boolean).join(' – ')
    onUpdate?.(v.id, {
      salaryMin: conditionsForm.form.salaryMin, salaryMax: conditionsForm.form.salaryMax,
      hoursMin: conditionsForm.form.hoursMin, hoursMax: conditionsForm.form.hoursMax, salary, hours,
    })
    conditionsForm.setEditing(false)
  }
  const cancelConditions = () => { conditionsForm.reset(); conditionsForm.setEditing(false) }

  return {
    // Lookups the sub-tab components read directly.
    candidateTypes, typeMeta, seniorityLevels, educationLevels, industries, formatDate, fnOptions,
    // One independent section per sub-tab (VAC-DETAILS-SPLIT-1).
    general: {
      editing: generalForm.editing, setEditing: generalForm.setEditing, form: generalForm.form, setF: generalForm.setF,
      save: saveGeneral, cancel: cancelGeneral,
      clientId, handleClientChange, customerOptions, cascade, locationPicker, departmentPicker, contactPicker,
      types, toggleType,
    } satisfies GeneralSection,
    location: {
      editing: locationForm.editing, setEditing: locationForm.setEditing, form: locationForm.form, setF: locationForm.setF,
      save: saveLocation, cancel: cancelLocation, provinces,
    } satisfies LocationSection,
    requirements: {
      editing: requirementsForm.editing, setEditing: requirementsForm.setEditing, form: requirementsForm.form, setF: requirementsForm.setF,
      save: saveRequirements, cancel: cancelRequirements,
      skills, newSkill, setNewSkill, addSkill, removeSkill,
    } satisfies RequirementsSection,
    conditions: {
      editing: conditionsForm.editing, setEditing: conditionsForm.setEditing, form: conditionsForm.form, setF: conditionsForm.setF,
      save: saveConditions, cancel: cancelConditions,
    } satisfies ConditionsSection,
  }
}
