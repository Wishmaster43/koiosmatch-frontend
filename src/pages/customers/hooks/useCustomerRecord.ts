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
import api, { unwrap } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { mergePatch } from '@/lib/mergePatch'
import { mapCustomer, mapCustomerNoteRow } from '../data/mapCustomer'
import type { ApiCustomerNoteRow } from '../data/mapCustomer'
import { mapCustomerBilling, BILLING_API_FIELDS } from './customerBillingAddress'
import type { Customer, ApiCustomer } from '@/types/customer'
import type { Id } from '@/types/common'

interface AppUser { id: Id; name: string; avatar_color?: string }
// CONTACT-NOTITIES-1: the person this note is filed against — optional, a
// company-level note carries none. Validated (and scoped to this customer)
// server-side, CustomerController::addNote.
// NOTES-LOC-DEPT-1: the OPTIONAL deeper link — a note may instead hang off one
// location or one department of this customer. The composer (CustomerNotesTab)
// sends exactly ONE of the three ids, never more than one.
// NOTE-TAAL-1 (06-08): `language` rides along optionally — undefined lets the
// backend keep its own tenant default, never forced by the FE.
type NotePayload = {
  type: string; title: string; body: string; language?: string
  customer_contact_id?: Id; customer_location_id?: Id; customer_department_id?: Id
}
// The create form's full shape. Everything past `city` is optional (the backend's
// CustomerRequest::sharedRules marks them sometimes|nullable) and only travels when
// filled — the modal collects them since Danny 27-07 ("+ Klant mist heel veel
// informatie"), so they must actually reach the API instead of being dropped here.
// DEBITEURNUMMER-1 (Danny 02-08): `debtorNumber` is now OPTIONAL (was required) — the
// create modal no longer collects it, but the property itself stays on the type so a
// caller that still passes one (e.g. an existing test fixture) keeps compiling; it
// simply never rides along in the POST body below.
interface CreateForm {
  name: string; debtorNumber?: string; status: string; ownerId: string; industry: string; city: string
  // KLANT-FASE-1: lifecycle phase slug picked in the create modal (is_default preselected).
  phase?: string
  branchId?: string; website?: string; employeeCount?: string
  toneOfVoice?: string; costCenter?: string; billingEmail?: string
  // KLANT-ADRES-1 (Danny 02-08): the customer's own visiting address, collected by
  // the create modal's new AddressCard — same optional/nullable rules as the rest.
  street?: string; houseNumber?: string; houseNumberSuffix?: string; postalCode?: string
  province?: string; country?: string
  // CUST-DUP-FE-1 (22-08): the KvK/CoC number, now collected by the create modal
  // (the tenant's default primary dedupe key) — optional, same as the rest above.
  cocNumber?: string
}

// Optional create fields → their API keys (same mapping the PATCH path uses).
// `phase` rides along here (not in the base body) because its rule is
// `sometimes|exists:customer_phases,value` — an empty string would be a 422.
// BEDRIJFSTEKST-1 (Danny 02-08): `toneOfVoice` now maps to `description` — the backend
// column `tone_of_voice` was merged into `description` and dropped (StoreCustomerRequest
// silently ignores it), so the OLD mapping here POSTed to a key CustomerRequest::
// sharedRules validates but Customer::$fillable/the DB no longer has; this form field is
// relabelled "Bedrijfstekst" (reuses overview.companyText) and now actually persists.
const OPTIONAL_CREATE_FIELDS: Array<[keyof CreateForm, string]> = [
  ['phase', 'phase'],
  ['branchId', 'location_id'], ['website', 'website'], ['employeeCount', 'employee_count'],
  ['toneOfVoice', 'description'], ['costCenter', 'cost_center'], ['billingEmail', 'billing_email'],
  ['street', 'street'], ['houseNumber', 'house_number'], ['houseNumberSuffix', 'house_number_suffix'],
  ['postalCode', 'postcode'], ['province', 'province'], ['country', 'country'],
  // CUST-DUP-FE-1: without this entry the field would be a fake affordance (§3) —
  // typed in the modal, silently dropped from the POST body.
  ['cocNumber', 'coc_number'],
]

interface Args {
  setCustomers: Dispatch<SetStateAction<Customer[]>>
  setTotal: Dispatch<SetStateAction<number>>
  users: AppUser[]
  t: TFunction
}

// UI field name → API field name for the single-record PATCH.
const FIELD_MAP: Record<string, string> = {
  name: 'name', debtorNumber: 'debtor_number', city: 'city', industry: 'industry',
  // KLANT-ADRES-1 / KLANT-KVK-1 (backend 28-07): the customer's own address + head
  // registration. Every key here is validated by CustomerRequest::sharedRules — a key
  // MISSING from that list is silently dropped by Laravel, so this map and those rules
  // must stay in step.
  street: 'street', houseNumber: 'house_number', houseNumberSuffix: 'house_number_suffix',
  postalCode: 'postcode', state: 'state', country: 'country',
  cocNumber: 'coc_number', vatNumber: 'vat_number',
  // JOB-CONTACT-1 (Danny 28-07): the customer's own e-mail/phone Contact card.
  email: 'email', phone: 'phone',
  // KLANT-FASE-1: the drawer's phase picker. Without this key the PATCH body would come
  // out empty and the picker would be a fake affordance (§3) — CustomerRequest validates
  // `phase` against customer_phases.value.
  phase: 'phase',
  status: 'status', ownerId: 'owner_id', website: 'website', employeeCount: 'employee_count',
  toneOfVoice: 'tone_of_voice', description: 'description', recruitmentProblems: 'recruitment_problems',
  hideCompanyName: 'hide_company_name', hasCareerPage: 'has_career_page',
  showInVacancies: 'show_in_my_vacancies', excludeFromSourcing: 'exclude_from_sourcing', tags: 'tags',
  // Kostenplaats + facturatie-email (Danny 2026-07-22) — the customer-level source.
  costCenter: 'cost_center', billingEmail: 'billing_email',
  // BRANCH-1: the establishment picker writes location_id (validated backend-side).
  branchId: 'location_id',
  // §3B "Eigen velden" — the Extra tab patches the full merged map at once.
  customFields: 'custom_fields',
  // FACTUURADRES-1 (Danny 2026-08-01): the customer's own invoice address. Spread from
  // the ONE key map so this list can never drift from the mapper that reads them back
  // (every key here is validated by CustomerRequest::sharedRules).
  ...BILLING_API_FIELDS,
}

// Full customer detail → the mapped record plus the invoice-address block. The billing
// columns are not part of data/mapCustomer.ts yet, so they
// are folded in at the single place the detail/create responses are read.
const mapCustomerDetail = (raw: ApiCustomer): Customer =>
  ({ ...mapCustomer(raw), ...mapCustomerBilling(raw) })

// Owns the selected customer + its fetched detail, the optimistic single-record
// PATCH, restore, create flow and notes CRUD, keeping CustomersPage presentational.
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
      .then(r => { if (selectedIdRef.current === c.id) setDetail(mapCustomerDetail(unwrap<ApiCustomer>(r))) })
      .catch(err => {
        // Bug class fix: this was a completely empty catch — the worst variant, the
        // drawer sat stuck on the light row forever with NO signal the detail load
        // failed (mirrors the identical fix already shipped in useTaskDrawerActions).
        if (selectedIdRef.current === c.id) notifyError(extractApiError(err, t('common:actionFailed')))
      })
  }

  // Optimistic update of one customer (table + open drawer stay in sync), then PATCH.
  const updateCustomer = (id: Id | undefined, patch: Record<string, unknown>) => {
    // Bug class fix: this used to `.catch(() => notifyError(...))` with no revert,
    // so a rejected PATCH left the new value on screen in all three slices as if
    // the server had saved it. Snapshot ONLY the fields this patch overwrites (never
    // the whole record, so a parallel edit to another field survives a revert) from
    // every slice the optimistic write below touches, then restore exactly those on failure.
    const keys = Object.keys(patch)
    const snapshot = (row: Record<string, unknown> | null | undefined): Record<string, unknown> | undefined => {
      if (!row) return undefined
      const snap: Record<string, unknown> = {}
      keys.forEach(k => { snap[k] = row[k] })
      return snap
    }
    let beforeCustomer: Record<string, unknown> | undefined
    // ZZP-MERGE-1: deep-merge (never shallow-spread) so a patch touching only part
    // of a nested object (e.g. the invoice-address block) keeps that object's other
    // keys instead of wiping them locally (mirrors updateCandidate).
    setCustomers(prev => prev.map(c => {
      if (c.id !== id) return c
      beforeCustomer = snapshot(c as unknown as Record<string, unknown>)
      return mergePatch(c as unknown as Record<string, unknown>, patch) as unknown as Customer
    }))
    const beforeSelected = snapshot(selected && selected.id === id ? (selected as unknown as Record<string, unknown>) : undefined)
    const beforeDetail   = snapshot(detail   && detail.id === id   ? (detail   as unknown as Record<string, unknown>) : undefined)
    setSelected(prev => (prev && prev.id === id ? (mergePatch(prev as unknown as Record<string, unknown>, patch) as unknown as Customer) : prev))
    setDetail(prev   => (prev && prev.id === id ? (mergePatch(prev as unknown as Record<string, unknown>, patch) as unknown as Customer) : prev))

    const body: Record<string, unknown> = {}
    Object.keys(patch).forEach(k => { if (FIELD_MAP[k]) body[FIELD_MAP[k]] = patch[k] })
    if (Object.keys(body).length) {
      api.patch(`/customers/${id}`, body).catch(err => {
        if (beforeCustomer) setCustomers(prev => prev.map(c => c.id === id ? ({ ...c, ...beforeCustomer } as Customer) : c))
        if (beforeSelected) setSelected(prev => (prev && prev.id === id ? ({ ...prev, ...beforeSelected } as Customer) : prev))
        if (beforeDetail)   setDetail(prev   => (prev && prev.id === id ? ({ ...prev, ...beforeDetail } as Customer) : prev))
        notifyError(extractApiError(err, t('common:actionFailed')))
      })
    }
  }

  // TRASH-OVERAL-2: bring an archived customer back to active via the per-id route
  // (POST /customers/{id}/restore — customers.update; mirrors restoreVacancy).
  // Reconciles all three local copies so the banner/chip clear without a refetch.
  const restoreCustomer = (id: Id | undefined) => {
    if (id == null) return
    api.post(`/customers/${id}/restore`)
      .then(() => {
        notifySuccess(t('changelog.actions.restored'))
        const clear = { archived: false, archivedAt: null, lifecycle: 'active', pendingEraseAt: null }
        setCustomers(prev => prev.map(c => c.id === id ? ({ ...c, ...clear } as Customer) : c))
        setSelected(prev => (prev && prev.id === id ? ({ ...prev, ...clear } as Customer) : prev))
        setDetail(prev   => (prev && prev.id === id ? ({ ...prev, ...clear } as Customer) : prev))
      })
      .catch(() => notifyError(t('locations.detail.restoreFailed')))
  }

  // Create a customer: optimistic prepend, then POST + reconcile. Rethrows on
  // failure (after reverting the optimistic row) instead of swallowing it — the
  // modal awaits this and maps 422 field errors (C-18) rather than closing
  // regardless while the row silently never gets created.
  const handleCreate = (form: CreateForm) => {
    const owner = users.find(u => String(u.id) === form.ownerId)
    const tmpId = `new-${Date.now()}`
    // DEBITEURNUMMER-1 (Danny 02-08): no `debtor_number` here — the create form no
    // longer collects it (the customer's own accounting number, decided later).
    const optimistic = mapCustomer({
      id: tmpId, name: form.name, status: form.status,
      // KLANT-FASE-1: carry the picked phase into the optimistic row so the new
      // table row shows its phase chip immediately, not only after the reconcile.
      phase: form.phase, city: form.city, industry: form.industry,
      owner: owner ? { id: owner.id, name: owner.name } : undefined,
    } as ApiCustomer)
    setCustomers(prev => [optimistic, ...prev]); setTotal(tt => tt + 1)
    const body: Record<string, unknown> = {
      name: form.name, status: form.status, city: form.city,
    }
    // Only send an optional field once it carries a value — the rules are
    // sometimes|nullable, so an empty string would fail the url/email/integer/
    // exists checks. CLEAR-SWEEP (Danny 13-08): industry/owner_id moved in here
    // alongside the rest (CONSIST-2) once their pickers became clearable — a
    // cleared value must reach the create call as "left out", never as ''.
    ;[...OPTIONAL_CREATE_FIELDS, ['industry', 'industry'], ['ownerId', 'owner_id']].forEach(([formKey, apiKey]) => {
      const v = form[formKey as keyof CreateForm]
      if (typeof v === 'string' && v.trim() !== '') body[apiKey as string] = v.trim()
    })
    return api.post('/customers', body).then(r => { const c = mapCustomerDetail(unwrap<ApiCustomer>(r)); setCustomers(prev => prev.map(x => x.id === optimistic.id ? c : x)); return c })
      .catch(err => { setCustomers(prev => prev.filter(x => x.id !== tmpId)); setTotal(tt => tt - 1); throw err })
  }

  // Add a note to a customer (optimistic + POST). CONTACT-NOTITIES-1: an optional
  // `customer_contact_id` files the note against one of this customer's own
  // contacts — the optimistic row carries the id but not yet the contact's name
  // (the composer doesn't send it), so its chip appears once the real detail reloads.
  // NOTES-LOC-DEPT-1: same treatment for the optional location/department link —
  // the name resolves once the real detail reloads, same as the contact link above.
  const addNote = (id: Id | undefined, payload: NotePayload) => {
    const note = {
      id: `tmp-${Date.now()}`, type: payload.type, title: payload.title, text: payload.body, ago: '',
      contactId: payload.customer_contact_id ?? null, contactName: '',
      locationId: payload.customer_location_id ?? null, locationName: '',
      departmentId: payload.customer_department_id ?? null, departmentName: '',
    }
    setDetail(prev => (prev && prev.id === id ? ({ ...prev, notes: [note, ...(prev.notes ?? [])] } as Customer) : prev))
    // OPTIMISTIC-REVERT-1: a failed note used to stay on screen with only a toast, so an
    // account manager who believed it was recorded would never write it again. Drop the
    // optimistic entry again (by reference, so notes added meanwhile survive) and surface
    // the server's own message.
    api.post(`/customers/${id}/notes`, {
      type: payload.type, title: payload.title, text: payload.body, language: payload.language,
      customer_contact_id: payload.customer_contact_id,
      customer_location_id: payload.customer_location_id,
      customer_department_id: payload.customer_department_id,
    })
      .catch(err => {
        setDetail(prev => (prev && prev.id === id
          ? ({ ...prev, notes: (prev.notes ?? []).filter(n => n !== note) } as Customer)
          : prev))
        notifyError(extractApiError(err, t('common:actionFailed')))
      })
  }

  // K15NOTES: edit a single note (optimistic + PATCH /customers/{id}/notes/{note}),
  // reverting on failure — mirrors addNote's revert-by-reference and useCandidateNotes'
  // editNote. `noteId` is the note's own id (NotesTab passes the full note back to the
  // host, which resolves its id off the current detail).
  const editNote = (id: Id | undefined, noteId: Id | undefined, payload: NotePayload) => {
    const snapshot = detail
    setDetail(prev => (prev && prev.id === id
      ? ({ ...prev, notes: (prev.notes ?? []).map(n => (n.id === noteId ? { ...n, type: payload.type, title: payload.title, text: payload.body } : n)) } as Customer)
      : prev))
    api.patch(`/customers/${id}/notes/${noteId}`, { type: payload.type, text: payload.body, language: payload.language })
      .catch(err => {
        setDetail(prev => (prev && prev.id === id ? snapshot : prev))
        notifyError(extractApiError(err, t('common:actionFailed')))
      })
  }

  // NOTE-UNDO-FE-1 (K-172): peek the one-slot undo — GET /customers/{id}/notes/{note}/previous-version
  // → { data: { previous_body, previous_saved_at } }, nulls when there is no slot yet.
  const fetchPreviousVersion = (id: Id | undefined, noteId: Id | undefined) => {
    if (!id || noteId == null) return Promise.resolve(null)
    return api.get(`/customers/${id}/notes/${noteId}/previous-version`)
      .then(res => (res.data as { data?: { previous_body: string | null; previous_saved_at: string | null } })?.data ?? null)
      .catch(() => null)
  }

  // NOTE-UNDO-FE-1 (K-172): execute the undo — POST /customers/{id}/notes/{note}/restore-previous
  // → the note in this family's own shape. A 422 (no slot / guard failed, mirrors
  // update()'s own guards) resolves false so NotesTab degrades calmly.
  const restorePreviousVersion = (id: Id | undefined, noteId: Id | undefined): Promise<boolean> => {
    if (!id || noteId == null) return Promise.resolve(false)
    return api.post(`/customers/${id}/notes/${noteId}/restore-previous`)
      .then(res => {
        // The route answers CustomerNoteResource (snake_case, `body`) — run it
        // through the family mapper so the UI row really carries the restored
        // text; a raw spread over the flat shape leaves the OLD `text` standing.
        const restored = mapCustomerNoteRow(unwrap<ApiCustomerNoteRow>(res))
        setDetail(prev => (prev && prev.id === id
          ? ({ ...prev, notes: (prev.notes ?? []).map(n => (n.id === noteId ? { ...n, ...restored } : n)) } as Customer)
          : prev))
        return true
      })
      .catch(() => false)
  }

  // K15NOTES: delete a single note (optimistic remove + DELETE), reverting on failure.
  const deleteNote = (id: Id | undefined, noteId: Id | undefined) => {
    const snapshot = detail
    setDetail(prev => (prev && prev.id === id
      ? ({ ...prev, notes: (prev.notes ?? []).filter(n => n.id !== noteId) } as Customer)
      : prev))
    api.delete(`/customers/${id}/notes/${noteId}`)
      .catch(err => {
        setDetail(prev => (prev && prev.id === id ? snapshot : prev))
        notifyError(extractApiError(err, t('common:actionFailed')))
      })
  }

  return {
    selected, detail, drawerExpanded, setDrawerExpanded, drawerTab,
    closeDrawer, selectCustomer, updateCustomer, restoreCustomer, handleCreate, addNote, editNote, deleteNote,
    fetchPreviousVersion, restorePreviousVersion,
  }
}
