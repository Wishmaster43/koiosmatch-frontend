import { useState } from 'react'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useTranslation } from 'react-i18next'
import { X, Building2 } from 'lucide-react'
import { Field, TextField } from '@/components/forms/fields'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { useIndustries } from '@/lib/useIndustries'
import { useLocations } from '@/lib/useLocations'
import { BTN_H } from '@/config/buttonMetrics'
import { WIDE_MODAL } from '@/components/ui/modalMetrics'
import type { Id, LookupOption } from '@/types/common'

// Card chrome — mirrors AddContactPersonModal/AddLocationModal/AddDepartmentModal
// (same folder) exactly (§3A): 11px uppercase muted heading over a bordered
// surface, kept local (not a cross-import — CLAUDE.md §2: an entity page must not
// reach into another entity's internals) so every customer sub-modal reads as one system.
const cardHead = { fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 3 }
const cardBox = { borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', padding: 12, display: 'flex', flexDirection: 'column' as const, gap: 12 }
const row2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }
const row3Even = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }
// Two CARDS side by side (distinct from row2/row3Even, which pair FIELDS inside
// one card) — mirrors MatchPlacementModal's twoColSections idiom.
const cardPair = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' as const }

interface CustomerForm {
  name: string; debtorNumber: string; status: string; ownerId: string; industry: string; city: string
  // BRANCH-1 (Danny 27-07): every customer hangs on one of the tenant's own
  // establishments — same /locations source as the drawer's OverviewTab picker,
  // so the create form and the drawer offer exactly one list.
  branchId: string
  // Danny 27-07 addendum ("+ Klant ... mist heel veel informatie"): the
  // CustomerRequest::sharedRules fields this create form never collected, even
  // though create+update share the same validator. All optional.
  website: string; employeeCount: string; toneOfVoice: string; costCenter: string; billingEmail: string
}
interface ModalUser { id: Id; name: string }

// 422 field-error keys are snake_case; map them back to this form's field names.
const API_TO_FORM: Record<string, string> = {
  name: 'name', debtor_number: 'debtorNumber', status: 'status', owner_id: 'ownerId', industry: 'industry', city: 'city',
  location_id: 'branchId', website: 'website', employee_count: 'employeeCount', tone_of_voice: 'toneOfVoice',
  cost_center: 'costCenter', billing_email: 'billingEmail',
}

/**
 * AddCustomerModal — create a customer. Status comes from the tenant lookup,
 * account manager from the user list, industry from /industries and the
 * establishment from /locations — never hardcoded option lists. Awaits onCreate
 * (the page's POST) and only closes on success (C-18).
 *
 * Widened to the house WIDE_MODAL frame and regrouped into titled bordered cards
 * (Danny 27-07: "+ Klant is niet zo groot als + match en + nieuwe kandidaat EN
 * MIST HEEL VEEL INFORMATIE"). Every dropdown is now a searchable CreatableSelect.
 * Extended with the fields CustomerRequest::sharedRules already accepts on create
 * (branch/website/employeeCount/toneOfVoice/costCenter/billingEmail) — all
 * optional, so a quick "just the name" create still works unchanged. This modal
 * hands the WHOLE form object to `onCreate` (unchanged behaviour), so the new
 * fields already ride along; the page's create handler still needs to pick them
 * up into the actual POST body — see the delivery report for the exact diff.
 */
export default function AddCustomerModal({ onClose, onCreate, users = [], statuses = [] }: {
  onClose: () => void; onCreate?: (form: CustomerForm) => unknown; users?: ModalUser[]; statuses?: LookupOption[]
}) {
  const { t } = useTranslation(['customers', 'common'])
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)
  const { industries } = useIndustries()
  // The tenant's own establishments (GET /locations) — same source as OverviewTab's Vestiging picker.
  const branchOptions = useLocations().map(l => ({ value: String(l.value), label: l.label }))
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  // Non-field 422/generic failure.
  const [createError, setCreateError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<CustomerForm>({
    name: '', debtorNumber: '', status: statuses[0]?.value ?? '', ownerId: '', industry: '', city: '',
    branchId: '', website: '', employeeCount: '', toneOfVoice: '', costCenter: '', billingEmail: '',
  })

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
  const canSubmit = !!form.name.trim() && !saving
  const statusOptions = statuses.map(s => ({ value: s.value, label: s.label }))
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
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{t('modal.title')}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('modal.subtitle')}</div>
            </div>
          </div>
          <button onClick={onClose} aria-label={t('common:close')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Body — titled bordered cards: Bedrijf full width; Vestiging&plaats /
            Eigenaar&status paired; Online / Facturatie paired (mirrors the
            placement modal's "full-width block + paired cards below" idiom). */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={cardHead}>{t('modal.fields.cardCompany')}</div>
            <div style={cardBox}>
              <div>
                <Field label={t('modal.fields.name')} required>
                  <TextField value={form.name} onChange={v => set('name', v)} placeholder={t('modal.fields.namePlaceholder')} error={errors.name} />
                </Field>
                {errors.name && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 3 }}>{t('modal.required')}</div>}
              </div>
              <div style={row3Even}>
                <Field label={t('modal.fields.debtorNumber')}>
                  <TextField value={form.debtorNumber} onChange={v => set('debtorNumber', v)} placeholder="10042" />
                </Field>
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

          <div style={cardPair}>
            <div>
              <div style={cardHead}>{t('modal.fields.cardBranch')}</div>
              <div style={cardBox}>
                <div style={row2}>
                  {/* Vestiging (establishment) — searchable, same /locations source as
                      OverviewTab's picker (BRANCH-1, Danny 27-07). */}
                  <Field label={t('overview.branch')}>
                    <CreatableSelect value={form.branchId || null} onChange={v => set('branchId', v)} allowCreate={false}
                      placeholder={t('common:select')} options={branchOptions} />
                  </Field>
                  <Field label={t('modal.fields.city')}>
                    <TextField value={form.city} onChange={v => set('city', v)} placeholder={t('modal.fields.cityPlaceholder')} />
                  </Field>
                </div>
              </div>
            </div>
            <div>
              <div style={cardHead}>{t('modal.fields.cardOwnerStatus')}</div>
              <div style={cardBox}>
                <div style={row2}>
                  <Field label={t('modal.fields.accountManager')}>
                    <CreatableSelect value={form.ownerId || null} onChange={v => set('ownerId', v)} allowCreate={false}
                      placeholder={t('modal.fields.selectOwner')} options={userOptions} />
                  </Field>
                  <Field label={t('modal.fields.status')}>
                    {/* Placeholder given even though a default is always selected — it
                        becomes the search box's accessible label once opened (§6). */}
                    <CreatableSelect value={form.status || null} onChange={v => set('status', v)} allowCreate={false}
                      placeholder={t('modal.fields.status')} options={statusOptions} />
                  </Field>
                </div>
              </div>
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
                  <Field label={t('overview.toneOfVoice')}>
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
