/**
 * OpportunityGeneralCard — the "Algemeen" card of AddOpportunityModal: title +
 * the customer→location→department→contact cascade + owner + Vestiging branch.
 * Extracted (§0.3 — the ~400-line split trigger) so the parent modal stays a
 * thin container; pure presentational, every value/handler comes from the
 * parent's form state.
 */
import type { TFunction } from 'i18next'
import { FieldRow, TextField } from '@/components/forms/fields'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { cardHead, cardBox } from '@/components/ui/modalCards'

interface Option { value: string; label: string }

interface OpportunityGeneralCardProps {
  t: TFunction
  title: string; onTitleChange: (v: string) => void; titleError?: boolean; titlePlaceholder: string
  clientId: string; onClientChange: (v: string) => void; customerOptions: Option[]
  // Whether a client is picked yet — gates the "pick client first" placeholder
  // on the dependent contact/location/department pickers below.
  clientPicked: boolean
  // A failed GET /customers must read as an honest error on this picker, not an empty list (R8).
  customersError?: boolean
  contactId: string; onContactChange: (v: string) => void; contactOptions: Option[]
  locationId: string; onLocationChange: (v: string) => void; locationOptions: Option[]
  departmentId: string; onDepartmentChange: (v: string) => void; departmentOptions: Option[]
  ownerId: string; onOwnerChange: (v: string) => void; ownerOptions: Option[]
  // K2: the tenant's own branch (Vestiging) — independent of the customer cascade above.
  branchId: string; onBranchChange: (v: string) => void; branchOptions: Option[]
}

// Add-opportunity modal card: title plus the customer cascade (client/contact/
// location/department), owner and branch pickers — client/contract fields the "pick client first" gate applies to.
export default function OpportunityGeneralCard({
  t, title, onTitleChange, titleError, titlePlaceholder,
  clientId, onClientChange, customerOptions, clientPicked, customersError,
  contactId, onContactChange, contactOptions,
  locationId, onLocationChange, locationOptions,
  departmentId, onDepartmentChange, departmentOptions,
  ownerId, onOwnerChange, ownerOptions,
  branchId, onBranchChange, branchOptions,
}: OpportunityGeneralCardProps) {
  const cascadePlaceholder = clientPicked ? t('common:select') : t('pickClientFirst')
  return (
    <div>
      <div style={cardHead}>{t('modal.groups.general')}</div>
      <div style={cardBox}>
        <FieldRow label={t('modal.fields.title')} required>
          <TextField value={title} onChange={onTitleChange} placeholder={titlePlaceholder} error={titleError} />
          {titleError && <div style={{ fontSize: 11, color: 'var(--color-danger-text)', marginTop: 3 }}>{t('modal.required')}</div>}
        </FieldRow>
        {/* MODAL-FIELD-CANON (§3A): one labelled field per row, full row width —
            two-pairs-per-row squeezed name-bearing selects (Danny screenshot). */}
        <FieldRow label={t('modal.fields.client')}>
          {/* Searchable, pick-only (allowCreate=false) — a customer is a real
              relational id, never a free-text create.
              CLEAR-SWEEP (Danny 13-08): every field here rides `|| null` in the
              submit body (AddOpportunityModal.handleSubmit) — genuinely optional,
              so clearable. */}
          <CreatableSelect allowCreate={false} value={clientId || null} onChange={onClientChange}
            clearable clearLabel={t('modal.fields.client')}
            placeholder={t('common:select')} options={customerOptions} />
          {/* R8: a failed /customers load must read as an error, never as "this tenant has no customers". */}
          {customersError && <div style={{ fontSize: 11, color: 'var(--color-danger-text)', marginTop: 3 }}>{t('common:errorGeneric')}</div>}
        </FieldRow>
        <FieldRow label={t('modal.fields.contact')}>
          {/* Danny 28-07: same-named contacts (one per location/department
              coupling) were indistinguishable — the label carries the
              function title, mirroring RelationsSection's contact picker
              (resolved in the parent's contactOptions). */}
          <CreatableSelect value={contactId || null} onChange={onContactChange} allowCreate={false}
            clearable clearLabel={t('modal.fields.contact')}
            placeholder={cascadePlaceholder} options={contactOptions} />
        </FieldRow>
        <FieldRow label={t('modal.fields.location')}>
          <CreatableSelect value={locationId || null} onChange={onLocationChange} allowCreate={false}
            clearable clearLabel={t('modal.fields.location')}
            placeholder={cascadePlaceholder} options={locationOptions} />
        </FieldRow>
        <FieldRow label={t('modal.fields.department')}>
          <CreatableSelect value={departmentId || null} onChange={onDepartmentChange} allowCreate={false}
            clearable clearLabel={t('modal.fields.department')}
            placeholder={cascadePlaceholder} options={departmentOptions} />
        </FieldRow>
        <FieldRow label={t('modal.fields.owner')}>
          <CreatableSelect value={ownerId || null} onChange={onOwnerChange} allowCreate={false}
            clearable clearLabel={t('modal.fields.owner')}
            placeholder={t('common:select')} options={ownerOptions} />
        </FieldRow>
        {/* K2: Vestiging — the bureau's own branch handling this deal
            (`location_id`, distinct from the customer's site above). */}
        <FieldRow label={t('modal.fields.branch')}>
          <CreatableSelect value={branchId || null} onChange={onBranchChange} allowCreate={false}
            clearable clearLabel={t('modal.fields.branch')}
            placeholder={t('common:select')} options={branchOptions} />
        </FieldRow>
      </div>
    </div>
  )
}
