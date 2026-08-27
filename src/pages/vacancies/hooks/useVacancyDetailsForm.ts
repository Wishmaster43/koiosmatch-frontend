/**
 * useVacancyDetailsForm — the DetailsTab form/cascade/types/save/cancel logic
 * (audit R1 item 6: DetailsTab crossed ~320 lines mixing state with card
 * layout; extracted here mirroring how VacanciesPage got useVacancyInsights).
 *
 * VAC-DETAILS-SPLIT-1 (Danny 24-07): "een potlood zet 21 velden tegelijk in
 * edit-mode ... ruk om te onderhouden" — "one pencil puts 21 fields into edit
 * mode at once ... a hassle to maintain" — one shared `editing`/`form` for the
 * whole tab meant a single pencil turned every card into an input at once.
 * Split into FOUR independent sections (General/Location/Requirements/Conditions),
 * mirroring PreferencesZzpTabs: each section owns its own `editing`/`form`/
 * `save`/`cancel`, so saving one never submits another's untouched draft.
 * `buildVacancyPatch` (vacanciesShared.ts) gates every key with `if (key in
 * patch)`, so sending a smaller per-section patch is safe — confirmed against
 * the mapper before splitting; the PATCH payload's CONTENT is unchanged, only
 * the number/grouping of calls differs (one big save → up to four small ones).
 *
 * The description block's own edit state lives in useVacancyDescription
 * (Danny 21-07: Beschrijving — description — moved to its own drawer tab) — untouched here.
 *
 * DRILLDOWN-VOLGORDE-CANON (Danny 21-08, VACATURES 1/2/3/4): the required
 * skills list moved to the Vacaturetekst (vacancy-text) tab (its own useVacancySkills hook,
 * next to the vacancy text) and the bureau branch (vestiging) moved out of
 * this Location section entirely, onto its own LAST block in the drill-down
 * (VacancyBranchBlock, its own useLocations()) — neither lives in this hook
 * any more.
 */
import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { useLookups } from '@/context/LookupsContext'
import { useVacancyLookups } from '@/context/VacancyLookupsContext'
import { useIndustries } from '@/lib/useIndustries'
import { useFunctions } from '@/lib/useFunctions'
import { useContractTypes } from '@/lib/useContractTypes'
import { useCao } from '@/lib/useCao'
import { useDateFormat } from '@/lib/datetime'
import { useProvinces } from '@/hooks/useProvinces'
import { useCustomerOptions } from '@/hooks/useCustomerOptions'
import { useCascadePickers } from './useCascadePickers'
import type { VacancyDetail } from '@/types/vacancy'
import type { Id } from '@/types/common'

type UpdateFn = (id: Id | undefined, patch: Record<string, unknown>) => void

// Key unions split per sub-tab — each section's form state only ever holds the
// fields IT owns, so its patch can only ever carry those fields.
export type GeneralKey = 'category' | 'industry' | 'startDate' | 'endDate'
export type LocationKey = 'street' | 'houseNumber' | 'houseNumberSuffix' | 'postalCode' | 'city' | 'province' | 'country'
export type RequirementsKey = 'experienceMin' | 'experienceMax' | 'seniority' | 'education'
// VACANCY-CONTRACT-FIELD-1: the vacancy's own singular contract-kind/CAO slugs.
export type ConditionsKey = 'salaryMin' | 'salaryMax' | 'hoursMin' | 'hoursMax' | 'contractType' | 'cao'

type GeneralForm = Record<GeneralKey, string>
type LocationForm = Record<LocationKey, string>
type RequirementsForm = Record<RequirementsKey, string>
type ConditionsForm = Record<ConditionsKey, string>

// V4-V6 (VACATURES-100): customer → location → department → contact cascade — one
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
}
export interface ConditionsSection {
  editing: boolean; setEditing: (v: boolean) => void
  form: ConditionsForm; setF: (k: ConditionsKey, val: string) => void
  save: () => void; cancel: () => void
}

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

// Composes the four independent editable sections (General/Location/Requirements/Conditions) for the details tab, each with its own edit/save/cancel so one pencil never submits another section draft.
export function useVacancyDetailsForm(v: VacancyDetail, onUpdate?: UpdateFn) {
  const { candidateTypes, typeMeta } = useLookups() as unknown as {
    candidateTypes: Array<{ value: string; label: string; color?: string }>
    typeMeta: (v: string) => { label: string; color: string }
  }
  const { seniorityLevels, educationLevels, defaultSeniority, defaultEducation } = useVacancyLookups()
  const { industries } = useIndustries()
  const { functions } = useFunctions() as { functions: Array<string | { value: string; label?: string }> }
  // VACANCY-CONTRACT-FIELD-1: the SAME tenant lookups the match's own Contract
  // section reads (contract_types.value / collective_labour_agreements.value) —
  // `.options` (not `.types`) so the Voorwaarden select binds by real slug value.
  const { options: contractTypeOptions } = useContractTypes()
  const { types: caoOptions } = useCao()
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
    onLocationChange: p => {
      setCascade(c => ({ ...c, locationId: p.id, locationName: p.name }))
      // V9 (Danny vacancies review round): picking a customer location takes over its
      // address onto the Location sub-tab's OWN draft — only on a real pick (not
      // a clear), and only into the form state, so the recruiter still reviews/
      // Saves the Location card themselves (never a silent cross-section write).
      if (p.id) {
        locationForm.setF('street', p.street ?? '')
        locationForm.setF('houseNumber', p.houseNumber ?? '')
        locationForm.setF('houseNumberSuffix', p.houseNumberSuffix ?? '')
        locationForm.setF('postalCode', p.postalCode ?? '')
        locationForm.setF('city', p.city ?? '')
        locationForm.setF('province', p.province ?? '')
        locationForm.setF('country', p.country ?? '')
      }
    },
    customerDepartmentId: cascade.departmentId,
    onDepartmentChange: p => setCascade(c => ({ ...c, departmentId: p.id, departmentName: p.name })),
    contactId: cascade.contactId,
    onContactChange: p => setCascade(c => ({ ...c, contactId: p.id, contactName: p.name })),
  })
  const toggleType = (val: string) => setTypes(p => p.includes(val) ? p.filter(x => x !== val) : [...p, val])
  // Customer options load only while the Algemeen pencil is open (capped page, React Query).
  const customerOptions = useCustomerOptions(generalForm.editing)
  // Persists the Algemeen section patch (client, cascade, contract types, category/industry, dates) and commits the cascade as the new saved baseline.
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
  // Discards the Algemeen draft, restoring client id, contract types and the cascade to their last-saved values.
  const cancelGeneral = () => {
    generalForm.reset(); setClientId(String(v.clientId ?? '')); setTypes(v.contractTypes ?? [])
    setCascade(savedCascade)
    generalForm.setEditing(false)
  }

  // ---- Location: structured address + country→province cascade ----
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
  // Clears the province the moment the resolved list for the newly picked country no longer contains it, so a stale country's previous province can never linger silently.
  useEffect(() => {
    if (locationForm.form.province && !provinces.includes(locationForm.form.province)) locationForm.setF('province', '')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the resolved province list changing, not every form edit
  }, [provinces])
  // Recomposes the one-line address from the structured fields and persists the Location section patch.
  const saveLocation = () => {
    const location = composeAddress(locationForm.form.street, locationForm.form.houseNumber, locationForm.form.houseNumberSuffix, locationForm.form.postalCode, locationForm.form.city)
    onUpdate?.(v.id, {
      street: locationForm.form.street, houseNumber: locationForm.form.houseNumber, houseNumberSuffix: locationForm.form.houseNumberSuffix,
      postalCode: locationForm.form.postalCode, city: locationForm.form.city, province: locationForm.form.province, country: locationForm.form.country, location,
    })
    locationForm.setEditing(false)
  }
  const cancelLocation = () => { locationForm.reset(); locationForm.setEditing(false) }

  // ---- Eisen: ervaring/senioriteit/opleiding ----
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
  // Resolves the picked seniority/education values to their display labels and persists the Requirements section patch.
  const saveRequirements = () => {
    const sen = seniorityLevels.find(s => s.value === requirementsForm.form.seniority)
    const edu = educationLevels.find(e => e.value === requirementsForm.form.education)
    onUpdate?.(v.id, {
      experienceMin: requirementsForm.form.experienceMin, experienceMax: requirementsForm.form.experienceMax,
      seniorityValue: requirementsForm.form.seniority, seniority: sen?.label ?? '',
      educationValue: requirementsForm.form.education, education: edu?.label ?? '',
    })
    requirementsForm.setEditing(false)
  }
  // Discards the Requirements draft back to its last-saved values.
  const cancelRequirements = () => {
    requirementsForm.reset()
    requirementsForm.setEditing(false)
  }

  // ---- Voorwaarden: salary/hours + the match-vocabulary contract type/CAO ----
  const seedConditions = (): ConditionsForm => ({
    salaryMin: v.salaryMin, salaryMax: v.salaryMax, hoursMin: v.hoursMin, hoursMax: v.hoursMax,
    contractType: v.contractType, cao: v.cao,
  })
  const conditionsForm = useEditableForm(seedConditions)
  // Builds the display strings for the salary/hours ranges and persists the Conditions section patch alongside the raw min/max values.
  const saveConditions = () => {
    const salary = [conditionsForm.form.salaryMin, conditionsForm.form.salaryMax].filter(Boolean).join(' – ')
    const hours = [conditionsForm.form.hoursMin, conditionsForm.form.hoursMax].filter(Boolean).join(' – ')
    onUpdate?.(v.id, {
      salaryMin: conditionsForm.form.salaryMin, salaryMax: conditionsForm.form.salaryMax,
      hoursMin: conditionsForm.form.hoursMin, hoursMax: conditionsForm.form.hoursMax, salary, hours,
      // VACANCY-CONTRACT-FIELD-1: same lookup vocabulary as the match's own fields.
      contractType: conditionsForm.form.contractType, cao: conditionsForm.form.cao,
    })
    conditionsForm.setEditing(false)
  }
  const cancelConditions = () => { conditionsForm.reset(); conditionsForm.setEditing(false) }

  return {
    // Lookups the sub-tab components read directly.
    candidateTypes, typeMeta, seniorityLevels, educationLevels, industries, formatDate, fnOptions,
    // VACANCY-CONTRACT-FIELD-1: same tenant lookups the match's own Contract
    // section reads — Voorwaarden's contract-type/CAO selects bind to these.
    contractTypeOptions, caoOptions,
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
    } satisfies RequirementsSection,
    conditions: {
      editing: conditionsForm.editing, setEditing: conditionsForm.setEditing, form: conditionsForm.form, setF: conditionsForm.setF,
      save: saveConditions, cancel: cancelConditions,
    } satisfies ConditionsSection,
  }
}
