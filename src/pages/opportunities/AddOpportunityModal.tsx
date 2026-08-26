/**
 * AddOpportunityModal — create/edit modal for an opportunity: general info,
 * deal-stage cascade (customer → location → department → contact) and the
 * rich-text description. Mirrors the house create/edit modal pattern (§3A).
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrap } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { useOpportunityStages } from '@/lib/useOpportunityStages'
import { useOpportunityServiceTypes, useOpportunityAgreementTypes } from '@/lib/useOpportunityLookups'
// K2: the tenant's own establishments (Vestiging) — the same shared lookup
// MatchModal uses for its own branch picker (mirrors §3A, one hook not a copy).
import { useLocations } from '@/lib/useLocations'
import { useCustomerCascade } from './hooks/useCustomerCascade'
// The shared "Name — Function" contact-option label (§11 — one shared builder,
// not a per-screen copy); imported straight from the real implementation since
// the local re-export above only re-exports the hook itself.
import { contactOptionLabel } from '@/lib/contactLabel'
import { mapOpportunity } from './data/mapOpportunity'
import { hasDescriptionText } from './data/descriptionText'
import OpportunityGeneralCard from './addmodal/OpportunityGeneralCard'
import OpportunityDealStageCard from './addmodal/OpportunityDealStageCard'
import OpportunityDescriptionCard from './addmodal/OpportunityDescriptionCard'
import { WIDE_MODAL } from '@/components/ui/modalMetrics'
import { tintBorder } from '@/lib/tint'
import FloatingPanel from '@/components/ui/FloatingPanel'
import { modalColumns } from '@/components/ui/modalCards'
import type { ApiOpportunity, Opportunity } from '@/types/opportunity'
import type { Id } from '@/types/common'
import ModalFooter from '@/components/ui/ModalFooter'

// 422 field-error keys are snake_case; map them back to this form's field names.
const API_TO_FORM: Record<string, string> = {
  title: 'title', customer_id: 'clientId', opportunity_stage_id: 'stageId',
  service_type_id: 'serviceTypeId', agreement_type_id: 'agreementTypeId',
  value: 'value', hours: 'hours', start_date: 'startDate', end_date: 'endDate',
  expected_close_at: 'expectedCloseAt', owner_id: 'ownerId',
  // NOTE: `location_id` on the API is the TENANT's own branch (mirrors Match's
  // branch_id), not the customer's location — sending our customer-location pick
  // under that key 422s ("exists:locations,id"). `customer_location_id` (OPP-LOC-1)
  // is the real, validated column for the customer's own location/site.
  customer_location_id: 'locationId', department_id: 'departmentId', contact_id: 'contactId',
  // K2: `location_id` IS the tenant's own branch (see the note above) — the real
  // 422 field name maps back to the new `branchId` form field.
  location_id: 'branchId',
  description: 'description',
}

interface OppForm {
  title: string; clientId: string; stageId: string; serviceTypeId: string; agreementTypeId: string
  value: string; hours: string; startDate: string; endDate: string; expectedCloseAt: string; ownerId: string
}
interface ModalUser { id: Id; name: string }
interface ModalCustomer { id: Id; name: string }

/**
 * AddOpportunityModal — create OR edit a Kans (Danny 2026-07-14: an edit pencil
 * per row in the customer drawer's Kansen tab reuses this same modal — mirrors
 * AddLocationModal doubling as create+edit). Pass `existing` to prefill every
 * field (incl. the customer cascade) and submit a PATCH instead of a POST; the
 * `onCreated` callback fires on both a successful create AND a successful edit.
 * Shared field components, lookups via hooks (never hardcoded option lists), 422
 * mapping. The stage/service/agreement selects key on the lookup id (the writes
 * expect *_id) — `stageId` is resolved from `existing.stageValue` once the tenant
 * stage lookup loads, since Opportunity only carries the stage's stable `value`.
 *
 * OPP-MODAL-PREFILL-1 (2026-08-05): `initialLocationId`/`initialDepartmentId`/
 * `initialContactId` mirror MatchModal's `initialCustomerLocationId`/
 * `initialCustomerDepartmentId` — a scoped "+ Kans" (opened from a customer's
 * own location/department/contact tab) can now lock the whole cascade, not just
 * the customer. No separate "name" props are needed here: once `useCustomerCascade`
 * resolves the picked customer's own locations/contacts, the CreatableSelect
 * options carry the real label for these ids the same way `existing` already
 * resolves an edited Kans's cascade — only the seed VALUE differs.
 *
 * Danny's live feedback (screenshot, 08-08), three points:
 * K1 — the panel width now literally mirrors MatchModal's own FloatingPanel
 * footprint (`width="94vw"`, same WIDE_MODAL maxWidth) so the two-column layout
 * breathes exactly like +Match's.
 * K2 — a Vestiging (branch) picker was added: `location_id` is a real, validated
 * field on the opportunity (StoreOpportunityRequest: `exists:locations,id`) that
 * carries the TENANT's own branch handling the deal — distinct from the existing
 * customer→location cascade above (the customer's own site, `customer_location_id`).
 * Uses the same shared `useLocations` hook MatchModal's own branch picker uses.
 * K3 — SUPERSEDED (2026-08-08, OPP-DESCRIPTION-1, CMBE golf 2a/2b): the "kans-tekst"
 * rich description that was verified absent above now landed on the backend —
 * `opportunities.description` (nullable HTML, max 20000; `create_opportunities_table`
 * + `OpportunityRequest::sharedRules` + `OpportunityResource`, all re-verified
 * against the live code). Built here as its own card (`OpportunityDescriptionCard`,
 * mirrors +Match's Opmerkingen — the shared collapsed-ghost `CollapsibleRichText`):
 * an empty/whitespace-only draft is OMITTED from the POST/PATCH body entirely
 * (never sends `description: ''`), a filled one rides as sanitised HTML.
 */
export default function AddOpportunityModal({ onClose, onCreated, users = [], customers = [], customersError = false, defaultCustomerId, initialLocationId, initialDepartmentId, initialContactId, existing }: {
  onClose: () => void; onCreated?: (o: Opportunity) => void; users?: ModalUser[]; customers?: ModalCustomer[]
  // A failed GET /customers must read as an error on the client picker, never as "no customers" (R8).
  customersError?: boolean
  // Pre-fill the client when opened from a customer's own drawer (Kansen tab) —
  // minimal addition, the picker still shows so the field never silently locks
  // out a correction; keep prop-driven (no hardcoded id) per §3A.
  defaultCustomerId?: Id
  // OPP-MODAL-PREFILL-1: pre-select the cascade's deeper levels when "+ Kans" opens
  // from a location/department/contact scope — same "still changeable" contract as
  // defaultCustomerId (§3, no lock-out).
  initialLocationId?: Id
  initialDepartmentId?: Id
  initialContactId?: Id
  // Edit mode: the Kans being edited. Present ⇒ PATCH /opportunities/{id}, absent ⇒ POST /opportunities.
  existing?: Opportunity
}) {
  const { t } = useTranslation(['opportunities', 'common'])
  const isEdit = Boolean(existing)
  const { stages } = useOpportunityStages()
  const { serviceTypes }   = useOpportunityServiceTypes()
  const { agreementTypes } = useOpportunityAgreementTypes()
  // Owner defaults to the logged-in user (still changeable below).
  const { user: me } = useAuth() as unknown as { user: { id?: Id; name?: string } | null }

  const [errors, setErrors] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  // AUDIT-1 (item 9): a non-422 failure (500, matrix-guard 4xx, network) used to
  // fall through the apiErrors branch silently — the button just stopped spinning
  // with no feedback. Now every failure shows something inline; modal stays open.
  const [createError, setCreateError] = useState<string | null>(null)
  const [form, setForm] = useState<OppForm>({
    title: existing?.title ?? '',
    clientId: existing ? String(existing.clientId ?? '') : (defaultCustomerId != null ? String(defaultCustomerId) : ''),
    // Stage id can't be resolved yet (Opportunity only carries the stable `value`,
    // not the lookup id) — the effect below fills it in once `stages` has loaded.
    stageId: '',
    serviceTypeId: existing?.serviceTypeId != null ? String(existing.serviceTypeId) : '',
    agreementTypeId: existing?.agreementTypeId != null ? String(existing.agreementTypeId) : '',
    value: existing?.value != null ? String(existing.value) : '',
    hours: existing?.hours != null ? String(existing.hours) : '',
    startDate: existing?.startDate ?? '', endDate: existing?.endDate ?? '', expectedCloseAt: existing?.expectedCloseAt ?? '',
    ownerId: existing?.ownerId != null ? String(existing.ownerId) : (me?.id != null ? String(me.id) : ''),
  })

  // OPP-DESCRIPTION-1: the "Kanstekst" rich-text draft — kept OUTSIDE `form`
  // (mirrors MatchModal's `remarks`) since its own card owns expand/edit state.
  const [description, setDescription] = useState(existing?.description ?? '')

  // Resolve the stage id from the existing deal's stable `value` once the REAL
  // tenant stage lookup has loaded. BUG (found via probe, 2026-07-14): the seed
  // fallback (DEFAULT_OPPORTUNITY_STAGES) carries no `id` — an earlier version of
  // this effect matched against it first and wrote the bare slug into `stageId`
  // ("qualified"), then a truthiness guard ("already set, skip") blocked the
  // LATER real match (with the actual uuid) from ever overwriting it — so once
  // the tenant lookup replaced the seed, `stageId` no longer matched any option's
  // value and the Fase select silently reverted to unselected (Danny would have
  // shipped a save that WIPED the existing stage). Only accept an id-bearing
  // match, so the seed pass is a no-op and the real pass is the only one that writes.
  useEffect(() => {
    if (!existing?.stageValue) return
    const match = stages.find(s => s.value === existing.stageValue)
    if (match?.id) setForm(f => (f.stageId === String(match.id) ? f : { ...f, stageId: String(match.id) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stages])

  // Customer → location → department → contact cascade (mirrors MatchModal).
  // All three stay optional; picking a different client resets the dependent picks.
  // OPP-MODAL-PREFILL-1: `existing` (edit mode) wins over `initial*` (scoped-create
  // mode) — the two never both apply, since `existing` only appears in edit mode.
  const [locationId,   setLocationId]   = useState(existing?.locationId != null ? String(existing.locationId) : (initialLocationId != null ? String(initialLocationId) : ''))
  const [departmentId, setDepartmentId] = useState(existing?.departmentId != null ? String(existing.departmentId) : (initialDepartmentId != null ? String(initialDepartmentId) : ''))
  const [contactId,    setContactId]    = useState(existing?.contactId != null ? String(existing.contactId) : (initialContactId != null ? String(initialContactId) : ''))
  const { locations, contacts } = useCustomerCascade(form.clientId)
  const departments = locations.find(l => String(l.id) === locationId)?.departments ?? []

  // K2: Vestiging — the TENANT's own branch handling this deal (`location_id`,
  // mirrors MatchModal's `branchId`/`branch_id`). Independent of the customer
  // cascade above (customer/location/department/contact) — never reset when the
  // client changes, exactly like MatchModal's own branch picker.
  const [branchId, setBranchId] = useState(existing?.branchId != null ? String(existing.branchId) : '')
  const branchLocations = useLocations()

  // OPP-MODAL-PREFILL-2: a department implies its parent location — a department-scoped
  // "+ Kans" arrives with only initialDepartmentId, which would leave the department
  // picker optionless AND save an inconsistent pair (department without its location).
  // Resolve the parent from the cascade once it loads; never overrides an explicit pick.
  useEffect(() => {
    if (!departmentId || locationId) return
    const parent = locations.find(l => (l.departments ?? []).some(d => String(d.id) === departmentId))
    if (parent) setLocationId(String(parent.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- locations arriving is the trigger; ids are guards
  }, [locations])

  // Update one field, clearing that field's 422 error once the user edits it.
  const set = (k: keyof OppForm, v: string) => {
    setForm(f => ({ ...f, [k]: v }))
    if (errors[k]) setErrors(e => ({ ...e, [k]: false }))
  }
  // Picking a different client invalidates the whole downstream cascade pick.
  const handleClientChange = (v: string) => {
    set('clientId', v)
    setLocationId(''); setDepartmentId(''); setContactId('')
  }
  // Picking a different location invalidates the department picked under it.
  const handleLocationChange = (v: string) => { setLocationId(v); setDepartmentId('') }

  // Build the create/update body (every field conditionally null-guarded) and
  // POST or PATCH depending on whether an existing Kans is being edited.
  const handleSubmit = async () => {
    if (!form.title.trim()) { setErrors({ title: true }); return }
    setSaving(true)
    setCreateError(null)
    try {
      const body = {
        title: form.title.trim(),
        customer_id: form.clientId || null,
        opportunity_stage_id: form.stageId || null,
        service_type_id: form.serviceTypeId || null,
        agreement_type_id: form.agreementTypeId || null,
        value: form.value === '' ? null : Number(form.value),
        hours: form.hours === '' ? null : Number(form.hours),
        start_date: form.startDate || null,
        end_date: form.endDate || null,
        expected_close_at: form.expectedCloseAt || null,
        owner_id: form.ownerId || null,
        // customer_location_id (OPP-LOC-1) — the customer's own location/site.
        customer_location_id: locationId || null,
        department_id: departmentId || null,
        contact_id: contactId || null,
        // K2: location_id — the TENANT's own branch (Vestiging), validated against
        // `locations` server-side (see the API_TO_FORM note above).
        location_id: branchId || null,
        // OPP-DESCRIPTION-1: an empty/whitespace-only draft is OMITTED entirely
        // (never `description: ''`) — mirrors +Match's own text-block contract.
        ...(hasDescriptionText(description) ? { description } : {}),
      }
      const r = existing
        ? await api.patch(`/opportunities/${existing.id}`, body)
        : await api.post('/opportunities', body)
      onCreated?.(mapOpportunity(unwrap<ApiOpportunity>(r)))
      onClose()
    } catch (err) {
      const e = err as { response?: { data?: { errors?: Record<string, unknown>; message?: string } } }
      const apiErrors = e?.response?.data?.errors
      if (apiErrors) {
        const e2: Record<string, boolean> = {}
        Object.keys(apiErrors).forEach(k => { e2[API_TO_FORM[k] ?? k] = true })
        setErrors(e2)
      } else {
        // Fallback: no field-level 422 — surface the server message (or a generic
        // one) instead of failing silently.
        setCreateError(e?.response?.data?.message ?? t('common:errorGeneric'))
      }
    } finally {
      setSaving(false)
    }
  }

  const canSubmit = !!form.title.trim()
  const stageOptions     = stages.map(s => ({ value: String(s.id ?? s.value), label: s.label }))
  const serviceOptions   = serviceTypes.map(s => ({ value: String(s.id ?? s.value), label: s.label }))
  const agreementOptions = agreementTypes.map(a => ({ value: String(a.id ?? a.value), label: a.label }))
  // The logged-in user may not be part of the assignable `users` list (e.g. a
  // tenant admin); inject them so the "defaults to me" owner pick is actually
  // visible in the dropdown, not just held in state (mirrors OpportunityDrawer's
  // ownerOptions fallback for the same reason).
  const meInUsers = me?.id != null && users.some(u => String(u.id) === String(me.id))
  const userOptions = [
    ...(me?.id != null && !meInUsers ? [{ value: String(me.id), label: me.name ?? '' }] : []),
    ...users.map(u => ({ value: String(u.id), label: u.name })),
  ]
  const customerOptions  = customers.map(c => ({ value: String(c.id), label: c.name }))
  const title = t(isEdit ? 'modal.editTitle' : 'modal.title')

  return (
    // POPUP-SLEEP-1: migrated onto the shared FloatingPanel shell — draggable header,
    // SE-resize, remembered position. K1 (Danny's screenshot 08-08): the width prop
    // now literally mirrors MatchModal's own footprint (`94vw`, same WIDE_MODAL
    // maxWidth) instead of a near-equivalent calc() — one frame, one source.
    <FloatingPanel open onClose={onClose} title={title} ariaLabel={title}
      persistKey="add-opportunity" scrollBody={false}
      width="94vw" maxWidth={`${WIDE_MODAL.maxWidth}px`}>

        {/* Form — two titled cards side by side (house wide-frame idiom, mirrors
            the +Match modal's Relaties/Contract/Financieel cards).
            Every dropdown is a searchable CreatableSelect (allowCreate=false) —
            no bare <select> is left in this modal. */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px' }}>
          {/* Two titled cards side by side — the shared modalColumns grid (§11,
              CARD-COLUMNS-CANON: mirrors AddCustomerModal/MatchModal). */}
          <div style={modalColumns()}>
            {/* Algemeen — title + the customer→location→department→contact
                relations + owner (mirrors MatchModal's Relaties card). */}
            <OpportunityGeneralCard t={t}
              title={form.title} onTitleChange={v => set('title', v)} titleError={errors.title} titlePlaceholder={t('modal.titlePlaceholder')}
              clientId={form.clientId} onClientChange={handleClientChange} customerOptions={customerOptions} clientPicked={!!form.clientId} customersError={customersError}
              contactId={contactId} onContactChange={setContactId}
              contactOptions={contacts.map(c => ({ value: String(c.id), label: contactOptionLabel(c) }))}
              locationId={locationId} onLocationChange={handleLocationChange}
              locationOptions={locations.map(l => ({ value: String(l.id), label: l.name ?? '—' }))}
              departmentId={departmentId} onDepartmentChange={setDepartmentId}
              departmentOptions={departments.map(d => ({ value: String(d.id), label: d.name ?? '—' }))}
              ownerId={form.ownerId} onOwnerChange={v => set('ownerId', v)} ownerOptions={userOptions}
              branchId={branchId} onBranchChange={setBranchId}
              branchOptions={branchLocations.map(l => ({ value: String(l.value), label: l.label }))}
            />

            {/* Waarde & fase — pipeline stage, service/agreement type, value/hours,
                contract term + expected close. */}
            <OpportunityDealStageCard t={t}
              stageId={form.stageId} onStageChange={v => set('stageId', v)} stageOptions={stageOptions}
              serviceTypeId={form.serviceTypeId} onServiceTypeChange={v => set('serviceTypeId', v)} serviceOptions={serviceOptions}
              agreementTypeId={form.agreementTypeId} onAgreementTypeChange={v => set('agreementTypeId', v)} agreementOptions={agreementOptions}
              value={form.value} onValueChange={v => set('value', v)} valueError={errors.value}
              hours={form.hours} onHoursChange={v => set('hours', v)} hoursError={errors.hours}
              expectedCloseAt={form.expectedCloseAt} onExpectedCloseChange={v => set('expectedCloseAt', v)}
              startDate={form.startDate} onStartDateChange={v => set('startDate', v)}
              endDate={form.endDate} onEndDateChange={v => set('endDate', v)}
            />
          </div>

          {/* Kanstekst — its own full-width card below the two-column pair (mirrors
              AddLocationModal/AddDepartmentModal's own description card placement),
              same shared collapsed-ghost block as +Match's Opmerkingen. */}
          <div style={{ marginTop: 16 }}>
            <OpportunityDescriptionCard value={description} onChange={setDescription} />
          </div>
        </div>

        {/* Server-side rejection (validation / matrix-guard) — shown in place, modal stays open. */}
        {createError && (
          <div role="alert" style={{ margin: '0 22px', padding: '8px 10px', fontSize: 12, borderRadius: 8,
            color: 'var(--color-on-danger-bg)', background: 'var(--color-danger-bg)',
            border: tintBorder('var(--color-danger)', true), flexShrink: 0 }}>
            {createError}
          </div>
        )}

        {/* Footer — the shared ModalFooter (§4) owns the layout/height, everywhere. */}
        <ModalFooter onCancel={onClose} cancelLabel={t('modal.cancel')}
          onSubmit={handleSubmit} submitLabel={isEdit ? t('modal.save') : t('modal.create')}
          disabled={!canSubmit} busy={saving} />
    </FloatingPanel>
  )
}
