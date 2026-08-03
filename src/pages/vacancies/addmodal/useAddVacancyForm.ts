/**
 * useAddVacancyForm — all state/lookups/cascade/submit logic for the "+
 * Vacature" create form (SLICE 1, Danny's 22-point spec). Extracted out of the
 * assembler (unlike the smaller AddCandidateModal, which keeps its state
 * inline) because this form spans seven cards and 20+ fields — keeping that
 * volume of state in the component would blow AddVacancyModal.tsx past the
 * ~400-line split trigger (§3). Mirrors useVacancyDetailsForm's role for the
 * drawer: components stay dumb, this hook owns the logic.
 */
import { useState, useEffect } from 'react'
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
import { useCascadePickers } from '../hooks/useCascadePickers'
import { composeAddress } from '../hooks/useVacancyDetailsForm'
import { mapVacancy } from '../data/mapVacancy'
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

interface Args {
  onClose: () => void
  onCreated?: (v: Vacancy) => void
  users: ModalUser[]
  customers: ModalCustomer[]
  lockCustomerId?: string
  initialCustomerLocationId?: string; initialCustomerDepartmentId?: string
  initialCustomerLocationName?: string; initialCustomerDepartmentName?: string
  initialIndustry?: string
}

export function useAddVacancyForm({
  onClose, onCreated, users, customers, lockCustomerId,
  initialCustomerLocationId, initialCustomerDepartmentId, initialCustomerLocationName, initialCustomerDepartmentName,
  initialIndustry,
}: Args) {
  const { t } = useTranslation(['vacancies', 'common'])
  const { statuses, seniorityLevels, educationLevels, defaultSeniority, defaultEducation } = useVacancyLookups()
  // Contract types are a CANDIDATE-axis lookup (Contractvorm), shared with the
  // drawer's DetailsGeneralTab — same source, never a second copy.
  const { candidateTypes } = useLookups() as unknown as { candidateTypes: Array<{ value: string; label: string; color?: string }> }
  const { industries } = useIndustries()
  const { functions } = useFunctions()
  const branchOptions = useLocations().map(l => ({ value: String(l.value), label: l.label }))
  const authCtx = useAuth() as unknown as { user: { id?: Id; name?: string } | null }
  const { user: me } = authCtx
  const meIsAssignable = me?.id != null && users.some(u => String(u.id) === String(me.id))

  const [errors, setErrors] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

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
  // (punt 9). The Koios-AI generate flow is SLICE 2, left untouched here.
  const [descExpanded, setDescExpanded] = useState(false)
  const [descEditing, setDescEditing] = useState(false)

  const handleSubmit = async () => {
    if (!form.title.trim()) { setErrors({ title: true }); return }
    setSaving(true)
    setCreateError(null)
    // The single free-text `location` column is DERIVED from the structured
    // address (mirrors the drawer's saveLocation) — never a second, manually
    // typed source of truth for the same displayed place.
    const composedLocation = composeAddress(form.street, form.houseNumber, form.houseNumberSuffix, form.postalCode, form.city)
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
      }
      const r = await api.post('/vacancies', body)
      onCreated?.(mapVacancy(unwrap<ApiVacancy>(r)))
      onClose()
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
    industries, functions, branchOptions, candidateTypes, toggleContractType,
    seniorityLevels, educationLevels, provinces,
    customerOptions: customers.map(c => ({ value: String(c.id), label: c.name })),
    userOptions,
    handleClientChange, locationPicker, departmentPicker, contactPicker,
    skills, newSkill, setNewSkill, addSkill, removeSkill,
    descExpanded, setDescExpanded, descEditing, setDescEditing,
  }
}
