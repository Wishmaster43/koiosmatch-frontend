import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrap } from '@/lib/api'
import { Field, TextField, DateField } from '@/components/forms/fields'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { useAuth } from '@/context/AuthContext'
import { useOpportunityStages } from '@/lib/useOpportunityStages'
import { useOpportunityServiceTypes, useOpportunityAgreementTypes } from '@/lib/useOpportunityLookups'
import { useCustomerCascade } from './hooks/useCustomerCascade'
// The shared "Name — Function" contact-option label (§11 — one shared builder,
// not a per-screen copy); imported straight from the real implementation since
// the local re-export above only re-exports the hook itself.
import { contactOptionLabel } from '@/lib/contactLabel'
import { mapOpportunity } from './data/mapOpportunity'
import { BTN_H } from '@/config/buttonMetrics'
import { WIDE_MODAL } from '@/components/ui/modalMetrics'
import FloatingPanel from '@/components/ui/FloatingPanel'
import { cardHead, cardBox, row2, cardPair } from '@/components/ui/modalCards'
import type { ApiOpportunity, Opportunity } from '@/types/opportunity'
import type { Id } from '@/types/common'

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
 */
export default function AddOpportunityModal({ onClose, onCreated, users = [], customers = [], defaultCustomerId, initialLocationId, initialDepartmentId, initialContactId, existing }: {
  onClose: () => void; onCreated?: (o: Opportunity) => void; users?: ModalUser[]; customers?: ModalCustomer[]
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

  // Klant → locatie → afdeling → contactpersoon cascade (mirrors MatchModal).
  // All three stay optional; picking a different client resets the dependent picks.
  // OPP-MODAL-PREFILL-1: `existing` (edit mode) wins over `initial*` (scoped-create
  // mode) — the two never both apply, since `existing` only appears in edit mode.
  const [locationId,   setLocationId]   = useState(existing?.locationId != null ? String(existing.locationId) : (initialLocationId != null ? String(initialLocationId) : ''))
  const [departmentId, setDepartmentId] = useState(existing?.departmentId != null ? String(existing.departmentId) : (initialDepartmentId != null ? String(initialDepartmentId) : ''))
  const [contactId,    setContactId]    = useState(existing?.contactId != null ? String(existing.contactId) : (initialContactId != null ? String(initialContactId) : ''))
  const { locations, contacts } = useCustomerCascade(form.clientId)
  const departments = locations.find(l => String(l.id) === locationId)?.departments ?? []

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

  const set = (k: keyof OppForm, v: string) => {
    setForm(f => ({ ...f, [k]: v }))
    if (errors[k]) setErrors(e => ({ ...e, [k]: false }))
  }
  const handleClientChange = (v: string) => {
    set('clientId', v)
    setLocationId(''); setDepartmentId(''); setContactId('')
  }
  const handleLocationChange = (v: string) => { setLocationId(v); setDepartmentId('') }

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
    // SE-resize, remembered position; same WIDE_MODAL footprint as before.
    <FloatingPanel open onClose={onClose} title={title} ariaLabel={title}
      persistKey="add-opportunity" scrollBody={false}
      width="min(calc(100vw - 48px), 1060px)" maxWidth={`${WIDE_MODAL.maxWidth}px`}>

        {/* Form — two titled cards side by side (house wide-frame idiom, mirrors
            the +Match modal's Relaties/Contract/Financieel cards).
            Every dropdown is a searchable CreatableSelect (allowCreate=false) —
            no bare <select> is left in this modal. */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px' }}>
          {/* Two titled cards side by side — the shared cardPair grid (§11). */}
          <div style={cardPair}>

            {/* Algemeen — title + the customer→location→department→contact
                relations + owner (mirrors MatchModal's Relaties card). */}
            <div>
              <div style={cardHead}>{t('modal.groups.general')}</div>
              <div style={cardBox}>
                <Field label={t('modal.fields.title')} required>
                  <TextField value={form.title} onChange={v => set('title', v)} placeholder={t('modal.titlePlaceholder')} error={errors.title} />
                  {errors.title && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 3 }}>{t('modal.required')}</div>}
                </Field>
                <div style={row2}>
                  <Field label={t('modal.fields.client')}>
                    {/* Searchable, pick-only (allowCreate=false) — a customer is a
                        real relational id, never a free-text create. */}
                    <CreatableSelect allowCreate={false} value={form.clientId || null} onChange={handleClientChange}
                      placeholder={t('common:select')} options={customerOptions} />
                  </Field>
                  <Field label={t('modal.fields.contact')}>
                    {/* Danny 28-07: same-named contacts (one per location/department
                        coupling) were indistinguishable — the label now carries the
                        function title, mirroring RelationsSection's contact picker. */}
                    <CreatableSelect value={contactId || null} onChange={setContactId} allowCreate={false}
                      placeholder={form.clientId ? t('common:select') : t('pickClientFirst')}
                      options={contacts.map(c => ({ value: String(c.id), label: contactOptionLabel(c) }))} />
                  </Field>
                </div>
                <div style={row2}>
                  <Field label={t('modal.fields.location')}>
                    <CreatableSelect value={locationId || null} onChange={handleLocationChange} allowCreate={false}
                      placeholder={form.clientId ? t('common:select') : t('pickClientFirst')}
                      options={locations.map(l => ({ value: String(l.id), label: l.name ?? '—' }))} />
                  </Field>
                  <Field label={t('modal.fields.department')}>
                    <CreatableSelect value={departmentId || null} onChange={setDepartmentId} allowCreate={false}
                      placeholder={form.clientId ? t('common:select') : t('pickClientFirst')}
                      options={departments.map(d => ({ value: String(d.id), label: d.name ?? '—' }))} />
                  </Field>
                </div>
                <Field label={t('modal.fields.owner')}>
                  <CreatableSelect value={form.ownerId || null} onChange={v => set('ownerId', v)} allowCreate={false}
                    placeholder={t('common:select')} options={userOptions} />
                </Field>
              </div>
            </div>

            {/* Waarde & fase — pipeline stage, service/agreement type, value/hours,
                contract term + expected close. */}
            <div>
              <div style={cardHead}>{t('modal.groups.dealStage')}</div>
              <div style={cardBox}>
                <div style={row2}>
                  <Field label={t('modal.fields.stage')}>
                    <CreatableSelect value={form.stageId || null} onChange={v => set('stageId', v)} allowCreate={false}
                      placeholder={t('common:select')} options={stageOptions} />
                  </Field>
                  <Field label={t('modal.fields.serviceType')}>
                    <CreatableSelect value={form.serviceTypeId || null} onChange={v => set('serviceTypeId', v)} allowCreate={false}
                      placeholder={t('common:select')} options={serviceOptions} />
                  </Field>
                </div>
                <div style={row2}>
                  <Field label={t('modal.fields.agreementType')}>
                    <CreatableSelect value={form.agreementTypeId || null} onChange={v => set('agreementTypeId', v)} allowCreate={false}
                      placeholder={t('common:select')} options={agreementOptions} />
                  </Field>
                  <Field label={t('modal.fields.value')}>
                    <TextField type="number" value={form.value} onChange={v => set('value', v)} placeholder="0" error={errors.value} />
                  </Field>
                </div>
                <div style={row2}>
                  <Field label={t('modal.fields.hours')}>
                    <TextField type="number" value={form.hours} onChange={v => set('hours', v)} placeholder="0" error={errors.hours} />
                  </Field>
                  <Field label={t('modal.fields.expectedClose')}>
                    <DateField value={form.expectedCloseAt} onChange={v => set('expectedCloseAt', v)} placeholder={t('common:select')} />
                  </Field>
                </div>
                <div style={row2}>
                  <Field label={t('modal.fields.startDate')}>
                    <DateField value={form.startDate} onChange={v => set('startDate', v)} placeholder={t('common:select')} />
                  </Field>
                  <Field label={t('modal.fields.endDate')}>
                    <DateField value={form.endDate} onChange={v => set('endDate', v)} placeholder={t('common:select')} />
                  </Field>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Server-side rejection (validation / matrix-guard) — shown in place, modal stays open. */}
        {createError && (
          <div role="alert" style={{ margin: '0 22px', padding: '8px 10px', fontSize: 12, borderRadius: 8,
            color: 'var(--color-danger)', background: 'var(--color-danger-bg)',
            border: '1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)', flexShrink: 0 }}>
            {createError}
          </div>
        )}

        {/* Footer — BTN_H (§4/§9): one explicit height for every text/action button, everywhere. */}
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', flexShrink: 0,
          display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose}
            style={{ height: BTN_H, padding: '0 16px', fontSize: 13, borderRadius: 8,
              border: '1px solid var(--border)', background: 'none', color: 'var(--text)', cursor: 'pointer' }}>
            {t('modal.cancel')}
          </button>
          <button onClick={handleSubmit} disabled={!canSubmit || saving}
            style={{ height: BTN_H, padding: '0 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none',
              background: (canSubmit && !saving) ? 'var(--color-primary)' : 'var(--border)',
              color: (canSubmit && !saving) ? 'white' : 'var(--text-muted)',
              cursor: (canSubmit && !saving) ? 'pointer' : 'not-allowed' }}>
            {isEdit
              ? (saving ? t('modal.saving') : t('modal.save'))
              : (saving ? t('modal.creating') : t('modal.create'))}
          </button>
        </div>
    </FloatingPanel>
  )
}
