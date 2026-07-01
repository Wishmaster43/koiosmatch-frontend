/**
 * useCustomerRecord — the record/drawer data layer for CustomersPage (§3): owns the
 * selected customer + fetched detail + drawer/sub-add state, the detail fetch, the
 * optimistic single-record PATCH, the create flow, the sub-entity adds (location/
 * department/contact) and notes. Takes the list setters from useCustomersData so the
 * page stays presentational. Mirrors useCandidateRecord / useVacancyRecord.
 */
import { useState, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { mapCustomer } from '../data/mapCustomer'
import type { Customer, ApiCustomer } from '@/types/customer'
import type { Id } from '@/types/common'

interface AppUser { id: Id; name: string; avatar_color?: string }
type NotePayload = { type: string; title: string; body: string }
interface SubAddState { type: string; customer: Customer }
interface CreateForm { name: string; debtorNumber: string; status: string; ownerId: string; industry: string; city: string }

interface Args {
  setCustomers: Dispatch<SetStateAction<Customer[]>>
  setTotal: Dispatch<SetStateAction<number>>
  users: AppUser[]
  t: TFunction
}

// UI field name → API field name for the single-record PATCH.
const FIELD_MAP: Record<string, string> = {
  name: 'name', debtorNumber: 'debtor_number', city: 'city', industry: 'industry',
  status: 'status', ownerId: 'owner_id', website: 'website', employeeCount: 'employee_count',
  toneOfVoice: 'tone_of_voice', description: 'description', recruitmentProblems: 'recruitment_problems',
  privacyPolicyUrl: 'privacy_policy_url', hideCompanyName: 'hide_company_name', hasCareerPage: 'has_career_page',
  showInVacancies: 'show_in_my_vacancies', excludeFromSourcing: 'exclude_from_sourcing', tags: 'tags',
}

export function useCustomerRecord({ setCustomers, setTotal, users, t }: Args) {
  const [selected,       setSelected]       = useState<Customer | null>(null)
  const [detail,         setDetail]         = useState<Customer | null>(null)
  const [drawerExpanded, setDrawerExpanded] = useState(false)
  const [subAdd,         setSubAdd]         = useState<SubAddState | null>(null)
  const selectedIdRef = useRef<Id | null>(null)

  // Light row first, then fetch the full detail (ref-guarded against races).
  const closeDrawer = () => { selectedIdRef.current = null; setSelected(null); setDetail(null); setDrawerExpanded(false) }
  const selectCustomer = (c: Customer) => {
    if (selected?.id === c.id) { closeDrawer(); return }
    selectedIdRef.current = c.id ?? null
    setSelected(c); setDetail(null); setDrawerExpanded(false)
    api.get(`/customers/${c.id}`)
      .then(r => { if (selectedIdRef.current === c.id) setDetail(mapCustomer(r.data?.data ?? r.data)) })
      .catch(() => {})
  }

  // Optimistic update of one customer (table + open drawer stay in sync), then PATCH.
  const updateCustomer = (id: Id | undefined, patch: Record<string, unknown>) => {
    setCustomers(prev => prev.map(c => c.id === id ? ({ ...c, ...patch } as Customer) : c))
    setSelected(prev => (prev && prev.id === id ? ({ ...prev, ...patch } as Customer) : prev))
    setDetail(prev   => (prev && prev.id === id ? ({ ...prev, ...patch } as Customer) : prev))

    const body: Record<string, unknown> = {}
    Object.keys(patch).forEach(k => { if (FIELD_MAP[k]) body[FIELD_MAP[k]] = patch[k] })
    if (Object.keys(body).length) api.patch(`/customers/${id}`, body).catch(() => notifyError(t('common:actionFailed')))
  }

  // Create a customer: optimistic prepend, then POST + reconcile (modal close is the page's).
  const handleCreate = (form: CreateForm) => {
    const owner = users.find(u => String(u.id) === form.ownerId)
    const optimistic = mapCustomer({
      id: `new-${Date.now()}`, name: form.name, debtor_number: form.debtorNumber, status: form.status,
      city: form.city, industry: form.industry,
      owner: owner ? { id: owner.id, name: owner.name } : undefined,
    } as ApiCustomer)
    setCustomers(prev => [optimistic, ...prev]); setTotal(tt => tt + 1)
    api.post('/customers', {
      name: form.name, debtor_number: form.debtorNumber, status: form.status,
      city: form.city, industry: form.industry, owner_id: form.ownerId,
    }).then(r => { const c = mapCustomer(r.data?.data ?? r.data); setCustomers(prev => prev.map(x => x.id === optimistic.id ? c : x)) }).catch(() => {})
  }

  // Generic optimistic sub-entity add (location/department/contact), then POST.
  const addSub = (cust: Customer) => (type: string, data: Record<string, unknown>, endpoint: string, shape: Record<string, unknown>) => {
    const cu = cust as unknown as Record<string, unknown>
    const tmp = { id: `tmp-${Date.now()}`, ...shape }
    updateCustomer(cust.id, {
      [type]: [...((cu[type] as unknown[]) ?? []), tmp],
      [`${type}Count`]: ((cu[`${type}Count`] as number) ?? 0) + 1,
    })
    api.post(`/customers/${cust.id}/${endpoint}`, data).catch(() => notifyError(t('common:actionFailed')))
    setSubAdd(null)
  }
  const onCreateLocation   = (cust: Customer) => (d: { name: string; city: string }) => addSub(cust)('locations',   { name: d.name, city: d.city }, 'locations',   { name: d.name, city: d.city, departments: [], contacts: [] })
  const onCreateDepartment = (cust: Customer) => (d: { name: string; locationId: Id }) => addSub(cust)('departments', { name: d.name, location_id: d.locationId }, 'departments', { name: d.name, locationId: d.locationId, locationName: (cust.locations ?? []).find(l => String(l.id) === String(d.locationId))?.name ?? '', contacts: [] })
  const onCreateContact    = (cust: Customer) => (d: { name: string; role: string; email: string }) => addSub(cust)('contacts',    { name: d.name, function: d.role, email: d.email }, 'contacts', { name: d.name, role: d.role, email: d.email })

  // Add a note to a customer (optimistic + POST).
  const addNote = (id: Id | undefined, payload: NotePayload) => {
    const note = { id: `tmp-${Date.now()}`, type: payload.type, title: payload.title, text: payload.body, ago: '' }
    setDetail(prev => (prev && prev.id === id ? ({ ...prev, notes: [note, ...(prev.notes ?? [])] } as Customer) : prev))
    api.post(`/customers/${id}/notes`, { type: payload.type, title: payload.title, text: payload.body }).catch(() => notifyError(t('common:actionFailed')))
  }

  return {
    selected, detail, drawerExpanded, setDrawerExpanded, subAdd, setSubAdd,
    closeDrawer, selectCustomer, updateCustomer, handleCreate,
    onCreateLocation, onCreateDepartment, onCreateContact, addNote,
  }
}
