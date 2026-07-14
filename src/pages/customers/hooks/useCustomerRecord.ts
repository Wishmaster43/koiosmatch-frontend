/**
 * useCustomerRecord — the record/drawer data layer for CustomersPage (§3): owns the
 * selected customer + fetched detail, the detail fetch, the optimistic single-record
 * PATCH, the create flow, and notes. Takes the list setters from useCustomersData so
 * the page stays presentational. Mirrors useCandidateRecord / useVacancyRecord.
 *
 * Locations/departments/contacts sub-entity CRUD moved to their own hooks
 * (useCustomerLocations/useCustomerDepartments/useCustomerContacts, instantiated in
 * CustomerDrawer) — full C-6 field sets, edit + delete, not just an optimistic add.
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
  // Deep-link target tab (count-cell → locations/departments/contacts/vacancies);
  // row click = default (mirrors useCandidateDrawerActions' drawerTab).
  const [drawerTab,      setDrawerTab]      = useState<string | undefined>(undefined)
  const selectedIdRef = useRef<Id | null>(null)

  // Light row first, then fetch the full detail (ref-guarded against races).
  const closeDrawer = () => { selectedIdRef.current = null; setSelected(null); setDetail(null); setDrawerExpanded(false) }
  const selectCustomer = (c: Customer, tab?: string) => {
    // Re-clicking the SAME row with no explicit tab toggles the drawer closed; a
    // count-cell deep-link (tab given) always (re)opens on that tab instead.
    if (selected?.id === c.id && !tab) { closeDrawer(); return }
    setDrawerTab(tab)
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

  // Add a note to a customer (optimistic + POST).
  const addNote = (id: Id | undefined, payload: NotePayload) => {
    const note = { id: `tmp-${Date.now()}`, type: payload.type, title: payload.title, text: payload.body, ago: '' }
    setDetail(prev => (prev && prev.id === id ? ({ ...prev, notes: [note, ...(prev.notes ?? [])] } as Customer) : prev))
    api.post(`/customers/${id}/notes`, { type: payload.type, title: payload.title, text: payload.body }).catch(() => notifyError(t('common:actionFailed')))
  }

  return {
    selected, detail, drawerExpanded, setDrawerExpanded, drawerTab,
    closeDrawer, selectCustomer, updateCustomer, handleCreate, addNote,
  }
}
