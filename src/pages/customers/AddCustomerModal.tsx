import { useState, useEffect } from 'react'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useTranslation } from 'react-i18next'
import { X, Building2 } from 'lucide-react'
import { Field, TextField } from '@/components/forms/fields'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { useIndustries } from '@/lib/useIndustries'
import { useLocations } from '@/lib/useLocations'
import { useCustomerPhases } from '@/lib/useCustomerPhases'
import { useProvinces } from '@/hooks/useProvinces'
import { useAuth } from '@/context/AuthContext'
import { BTN_H } from '@/config/buttonMetrics'
import SearchSelect from '@/components/ui/SearchSelect'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import { WIDE_MODAL } from '@/components/ui/modalMetrics'
import { cardHead, cardBox, row2, cardPair } from '@/components/ui/modalCards'
import AddressCard from './addmodal/AddressCard'
import CustomerImportCard from './addmodal/CustomerImportCard'
import { useCustomerImport } from './addmodal/useCustomerImport'
import type { Id, LookupOption } from '@/types/common'

// Exported so addmodal/AddressCard shares this exact shape (type-only import,
// mirrors AddCandidateModal's exported FormState).
export interface CustomerForm {
  name: string; status: string; ownerId: string; industry: string; city: string
  // KLANT-FASE-1: lifecycle phase slug (Prospect → Klant). Pre-selected from the
  // lookup's is_default FLAG, never from a hardcoded "prospect" slug.
  phase: string
  // BRANCH-1 (Danny 27-07): every customer hangs on one of the tenant's own
  // establishments — same /locations source as the drawer's OverviewTab picker,
  // so the create form and the drawer offer exactly one list.
  branchId: string
  // Danny 27-07 addendum ("+ Klant ... mist heel veel informatie"): the
  // CustomerRequest::sharedRules fields this create form never collected, even
  // though create+update share the same validator. All optional.
  website: string; employeeCount: string; toneOfVoice: string; costCenter: string; billingEmail: string
  // KLANT-ADRES-1 (Danny 02-08): the customer's own visiting address, mirroring the
  // candidate's home-address fields one-for-one — see addmodal/AddressCard.
  street: string; houseNumber: string; houseNumberSuffix: string; postalCode: string; province: string; country: string
}
interface ModalUser { id: Id; name: string }

// 422 field-error keys are snake_case; map them back to this form's field names.
// No `debtor_number` entry (DEBITEURNUMMER-1, Danny 02-08): the field is no longer
// collected at creation, so a 422 on it can never occur from this form.
const API_TO_FORM: Record<string, string> = {
  name: 'name', status: 'status', owner_id: 'ownerId', industry: 'industry', city: 'city',
  location_id: 'branchId', website: 'website', employee_count: 'employeeCount', tone_of_voice: 'toneOfVoice',
  cost_center: 'costCenter', billing_email: 'billingEmail', phase: 'phase',
  street: 'street', house_number: 'houseNumber', house_number_suffix: 'houseNumberSuffix',
  postcode: 'postalCode', province: 'province', country: 'country',
}

/**
 * AddCustomerModal — create a customer. Status comes from the tenant lookup
 * (its default, hidden — see below), account manager from the user list,
 * industry from /industries and the establishment from /locations — never
 * hardcoded option lists. Awaits onCreate (the page's POST) and only closes on
 * success (C-18).
 *
 * Widened to the house WIDE_MODAL frame and regrouped into titled bordered cards
 * (Danny 27-07: "+ Klant is niet zo groot als + match en + nieuwe kandidaat EN
 * MIST HEEL VEEL INFORMATIE"). Every dropdown is now a searchable CreatableSelect.
 * Extended with the fields CustomerRequest::sharedRules already accepts on create
 * (branch/website/employeeCount/toneOfVoice/costCenter/billingEmail) — all
 * optional, so a quick "just the name" create still works unchanged. This modal
 * hands the WHOLE form object to `onCreate` (unchanged behaviour), so the new
 * fields already ride along; useCustomerRecord's handleCreate picks them up into
 * the actual POST body.
 *
 * Brought in line with AddCandidateModal (Danny 02-08, "de + nieuwe klant popup
 * moet lijken op + nieuwe kandidaat"): the debtor number is no longer collected
 * here (it stays editable everywhere else — the customer's own accounting number,
 * rarely known yet for a new prospect); status is hidden (the phase pills already
 * carry the lifecycle choice, so status just rides along at its lookup default);
 * a full address card was added (addmodal/AddressCard, same field grouping and
 * country/province cascade as the candidate); and the account manager defaults to
 * the logged-in user when they are assignable (mirrors AddApplicationModal).
 *
 * CUSTOMER-IMPORT-1 (Danny 02-08: "bovenin ... import cvs of excel file"): the
 * italic bottom-of-modal hint that only NAMED the Settings import screen is gone;
 * in its place (top of the modal, CvUploadCard's exact spot) sits
 * CustomerImportCard, which actually RUNS the customer_tree importer here — dry
 * run first, then confirm. Unlike the CV card this does not prefill the form: a
 * real import writes the customer (+ locations/departments/contacts) directly, so
 * a clean result (something landed) closes this modal and refreshes the list
 * instead of leaving an untouched create form open behind a customer that already
 * exists (that invites a duplicate). While the import is past its upload step, the
 * manual submit below is disabled for the same reason — never two creation paths
 * armed at once.
 */
export default function AddCustomerModal({ onClose, onCreate, onImported, users = [], statuses = [] }: {
  onClose: () => void; onCreate?: (form: CustomerForm) => unknown
  /** Called once a real import lands at least one record — the parent refreshes its list. */
  onImported?: () => void
  users?: ModalUser[]; statuses?: LookupOption[]
}) {
  const { t } = useTranslation(['customers', 'common'])
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)
  const { industries } = useIndustries()
  // KLANT-FASE-1: the lifecycle-phase lookup + the is_default phase a new customer starts in.
  const { phases, defaultPhase } = useCustomerPhases()
  // The tenant's own establishments (GET /locations) — same source as OverviewTab's Vestiging picker.
  const branchOptions = useLocations().map(l => ({ value: String(l.value), label: l.label }))
  // ACCOUNTMANAGER-DEFAULT-1 (Danny 02-08: "Accountmanager moet voorstel waarde zijn
  // van de gebruiker die hem aanmaakt") — mirrors AddApplicationModal's identical
  // owner-default guard: only propose the LOGGED-IN user when they actually appear
  // in the tenant's assignable `users` list, never a super-admin or non-tenant
  // account the server would 422 on (owner_id is validated against tenant users).
  const authCtx = useAuth() as unknown as {
    user: { id?: Id; name?: string } | null
    hasPermission?: (permName: string) => boolean
  }
  const { user: me } = authCtx
  const meIsAssignable = me?.id != null && users.some(u => String(u.id) === String(me.id))
  // CUSTOMER-IMPORT-1: falls back to "no permission" rather than crashing when the
  // context is mid-boot (mirrors ImporterenSettings' own hasPermission fallback).
  // The wizard/permission/auto-close wiring itself lives in useCustomerImport (kept
  // out of this container to stay under the ~400-line split trigger, CLAUDE.md §3).
  const hasPermission = authCtx.hasPermission ?? (() => false)
  const { wizard: importWizard, canView: canViewImportTemplate, canImport: canRunImport } =
    useCustomerImport({ hasPermission, onImported, onClose })
  // DEBITEURNUMMER-1 (Danny 02-08): status is HIDDEN in this form (the phase pills
  // replace it — a new customer starts on the tenant's default status), so the
  // default must come from the lookup's own is_default FLAG, exactly like the
  // candidate modal's phase default — never an invented literal or an empty string.
  const defaultStatusValue = statuses.find(s => (s as { isDefault?: boolean }).isDefault)?.value ?? statuses[0]?.value ?? ''
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  // Non-field 422/generic failure.
  const [createError, setCreateError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<CustomerForm>({
    name: '', status: defaultStatusValue, ownerId: '', industry: '', city: '',
    phase: defaultPhase,
    branchId: '', website: '', employeeCount: '', toneOfVoice: '', costCenter: '', billingEmail: '',
    street: '', houseNumber: '', houseNumberSuffix: '', postalCode: '', province: '', country: '',
  })

  // The lookup arrives async (one cached GET), so seed the default phase once it lands —
  // but never overwrite a phase the user already picked.
  useEffect(() => {
    setForm(f => (f.phase ? f : { ...f, phase: defaultPhase }))
  }, [defaultPhase])

  // Same pattern for the (now hidden) status default — the recruiter never picks it
  // here, so this is the ONLY thing that ever sets it.
  useEffect(() => {
    setForm(f => (f.status ? f : { ...f, status: defaultStatusValue }))
  }, [defaultStatusValue])

  // Propose the current user as account manager ONCE they are known to be
  // assignable; a value the recruiter already picked (or picks later) is never
  // overwritten — the functional update only fires while ownerId is still empty.
  useEffect(() => {
    if (meIsAssignable) setForm(f => (f.ownerId ? f : { ...f, ownerId: String(me!.id) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to assignability resolving, mirrors AddApplicationModal's owner-default effect
  }, [meIsAssignable])

  // KLANT-ADRES-1: province list CASCADES on the picked country, same shared hook
  // (and same clear-on-mismatch behaviour) as the candidate's home address.
  const { provinces } = useProvinces(form.country)
  useEffect(() => {
    if (form.province && !provinces.includes(form.province)) setForm(f => ({ ...f, province: '' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the resolved province list changing, not every form edit
  }, [provinces])

  const set = (k: keyof CustomerForm, v: string) => {
    setForm(f => ({ ...f, [k]: v }))
    if (errors[k]) setErrors(e => ({ ...e, [k]: false }))
    setCreateError(null)
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) { setErrors({ name: true }); return }
    setSaving(true)
    try {
      await onCreate?.(form)
      onClose()
    } catch (err) {
      // Show field-level errors from 422 validation responses; fall back to the
      // server's message (or a generic one) so the user isn't left guessing.
      const e = err as { response?: { data?: { errors?: Record<string, unknown>; message?: string } } }
      const apiErrors = e?.response?.data?.errors
      if (apiErrors) {
        const e2: Record<string, boolean> = {}
        Object.keys(apiErrors).forEach(k => { e2[API_TO_FORM[k] ?? k] = true })
        setErrors(e2)
      } else {
        setCreateError(e?.response?.data?.message ?? t('common:errorGeneric'))
      }
    } finally {
      setSaving(false)
    }
  }
  // CUSTOMER-IMPORT-1: blocked while an import is past its upload step (preview or
  // result) — never let the manual form fire a SECOND create while the import is
  // mid-decision or has just written its own records.
  const canSubmit = !!form.name.trim() && !saving && importWizard.step === 'upload'
  // The phase the title names — the pills below are the only way to change it.
  const selectedPhase = phases.find(p => String(p.value) === String(form.phase))
  const userOptions = users.map(u => ({ value: String(u.id), label: u.name }))

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={t('modal.title')} tabIndex={-1}
        style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', ...WIDE_MODAL,
        boxShadow: '0 20px 60px rgba(0,0,0,0.22)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px 14px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--color-primary-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building2 size={16} color="var(--color-primary)" />
            </div>
            <div>
              {/* The chosen phase is in the TITLE, exactly as the candidate modal reads
                  "Nieuwe — Lead" (Danny 02-08: "die fase moet zijn zoals + nieuwe
                  kandidaat"). A phase buried in a card is a phase nobody notices. */}
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                {selectedPhase ? `${t('modal.title')} — ${selectedPhase.label}` : t('modal.title')}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('modal.subtitle')}</div>
            </div>
          </div>
          {/* Phase choice — two compact pills, the same control the candidate uses. */}
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', marginRight: 12, flexShrink: 0 }}>
            {phases.map(ph => {
              const active = form.phase === ph.value
              return (
                <button key={String(ph.value)} type="button" onClick={() => set('phase', String(ph.value))}
                  aria-pressed={active} title={ph.label}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, height: BTN_H, padding: '0 14px',
                    borderRadius: 999, cursor: 'pointer', transition: 'all 0.15s',
                    border: `1.5px solid ${active ? (ph.color ?? 'var(--color-primary)') : 'var(--border)'}`,
                    background: active ? (ph.color ?? 'var(--color-primary)') + '14' : 'var(--surface)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: ph.color ?? 'var(--color-primary)', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: active ? 600 : 500,
                    color: active ? (ph.color ?? 'var(--color-primary)') : 'var(--text)' }}>{ph.label}</span>
                </button>
              )
            })}
          </div>
          <button onClick={onClose} aria-label={t('common:close')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Body — titled bordered cards: Bedrijf and Adres full width (mirrors
            AddCandidateModal 1:1, Danny 02-08); Eigenaar full width (status is
            hidden — see below); Online / Facturatie paired. */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* CUSTOMER-IMPORT-1: the file-import path, same top spot as CvUploadCard. */}
          <CustomerImportCard wizard={importWizard} canView={canViewImportTemplate} canImport={canRunImport} />

          <div>
            <div style={cardHead}>{t('modal.fields.cardCompany')}</div>
            <div style={cardBox}>
              <div>
                <Field label={t('modal.fields.name')} required>
                  <TextField value={form.name} onChange={v => set('name', v)} placeholder={t('modal.fields.namePlaceholder')} error={errors.name} />
                </Field>
                {errors.name && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 3 }}>{t('modal.required')}</div>}
              </div>
              {/* DEBITEURNUMMER-1 (Danny 02-08): the debtor number is no longer collected
                  here — it is the customer's own accounting number, decided later, and
                  stays editable everywhere else (drawer/table/search). Two fields remain. */}
              <div style={row2}>
                {/* Branche (industry/sector) — searchable tenant lookup, distinct from the
                    "Vestiging" (establishment) picker below. */}
                <Field label={t('modal.fields.industry')}>
                  <CreatableSelect value={form.industry || null} onChange={v => set('industry', v)} allowCreate={false}
                    placeholder={t('modal.fields.selectIndustry')} options={industries} />
                </Field>
                <Field label={t('overview.employeeCount')}>
                  <TextField type="number" value={form.employeeCount} onChange={v => set('employeeCount', v)} />
                </Field>
              </div>
            </div>
          </div>

          {/* KLANT-ADRES-1 (Danny 02-08): the customer's own visiting address, the
              same full-width card/field grouping as AddCandidateModal's AddressCard. */}
          <AddressCard form={form} set={set} provinces={provinces} />

          <div>
            {/* STATUS-HIDDEN-1 (Danny 02-08): deployability status is no longer picked
                here — the phase pills above already carry the lifecycle choice, and a
                new customer starts on the tenant's default status (see defaultStatusValue
                above), sent along unseen. Only the owner picker remains in this card. */}
            <div style={cardHead}>{t('modal.fields.cardOwner')}</div>
            <div style={cardBox}>
              <Field label={t('modal.fields.accountManager')}>
                <CreatableSelect value={form.ownerId || null} onChange={v => set('ownerId', v)} allowCreate={false}
                  placeholder={t('modal.fields.selectOwner')} options={userOptions} />
              </Field>
            </div>
          </div>

          <div style={cardPair}>
            <div>
              {/* Reuses the drawer OverviewTab's own "Online" card heading (one
                  translation source for the same grouping). */}
              <div style={cardHead}>{t('overview.online')}</div>
              <div style={cardBox}>
                <div style={row2}>
                  <Field label={t('overview.website')}>
                    <TextField value={form.website} onChange={v => set('website', v)} placeholder="https://" />
                  </Field>
                  {/* BEDRIJFSTEKST-1 (Danny 02-08): "Schrijfstijl" is renamed "Bedrijfstekst" —
                      reuses the SAME overview.companyText key the drawer's merged company-text
                      field already uses (one label, not a second "Bedrijfstekst" copy). The
                      internal `toneOfVoice` form/API-mapping key is unchanged (see
                      useCustomerRecord's OPTIONAL_CREATE_FIELDS, now pointed at `description` —
                      the backend column `tone_of_voice` was dropped and merged into it). */}
                  <Field label={t('overview.companyText')}>
                    <TextField value={form.toneOfVoice} onChange={v => set('toneOfVoice', v)} />
                  </Field>
                </div>
              </div>
            </div>
            <div>
              {/* Reuses the drawer OverviewTab's own "Facturatie" card heading. */}
              <div style={cardHead}>{t('overview.billing')}</div>
              <div style={cardBox}>
                <div style={row2}>
                  <Field label={t('overview.costCenter')}>
                    <TextField value={form.costCenter} onChange={v => set('costCenter', v)} />
                  </Field>
                  <Field label={t('overview.billingEmail')}>
                    <TextField type="email" value={form.billingEmail} onChange={v => set('billingEmail', v)} />
                  </Field>
                </div>
              </div>
            </div>
          </div>

          {/* Vestigingen — last block, exactly as the candidate modal does it: the heading
              with its own add trigger on the right, chips below, and the sentence saying
              what LEAVING IT EMPTY means. That sentence is the point: empty is a real,
              useful choice here, not an unfinished field. */}
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
              <div style={{ ...cardHead, marginBottom: 0 }}>{t('overview.branch')}</div>
              <SearchSelect triggerLabel={t('modal.fields.branchAdd')} options={branchOptions}
                selected={form.branchId ? [form.branchId] : []}
                onToggle={(id: string) => set('branchId', form.branchId === id ? '' : id)}
                menuAlign="right"
                renderTrigger={(toggleOpen: () => void) => <DrawerAddButton onClick={toggleOpen} label={t('modal.fields.branchAdd')} />} />
            </div>
            <div style={cardBox}>
              {form.branchId ? (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '3px 8px',
                    borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}>
                    {branchOptions.find(o => String(o.value) === form.branchId)?.label ?? form.branchId}
                    <button type="button" onClick={() => set('branchId', '')} aria-label={t('common:remove')}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, lineHeight: 1, fontSize: 14 }}>×</button>
                  </span>
                </div>
              ) : (
                <p style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>{t('modal.fields.branchAutoHint')}</p>
              )}
            </div>
          </div>
        </div>

        {/* Server-side rejection (non-field 422 / other failure) — shown in place, modal stays open. */}
        {createError && (
          <div role="alert" style={{ margin: '0 24px 8px', padding: '8px 10px', fontSize: 12, borderRadius: 8,
            color: 'var(--color-danger)', background: 'var(--color-danger-bg)',
            border: '1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)', flexShrink: 0 }}>
            {createError}
          </div>
        )}

        {/* Footer — BTN_H (§4/§9): one explicit height for every text/action button, everywhere. */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', flexShrink: 0,
          display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose}
            style={{ height: BTN_H, padding: '0 16px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--text)', cursor: 'pointer' }}>
            {t('modal.cancel')}
          </button>
          <button onClick={handleSubmit} disabled={!canSubmit}
            style={{ height: BTN_H, padding: '0 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none',
              background: canSubmit ? 'var(--color-primary)' : 'var(--border)', color: canSubmit ? 'white' : 'var(--text-muted)',
              cursor: canSubmit ? 'pointer' : 'not-allowed' }}>
            {saving ? t('common:saving') : t('modal.create')}
          </button>
        </div>
      </div>
    </div>
  )
}
