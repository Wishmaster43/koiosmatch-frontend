/**
 * AddDepartmentModal — create (or edit, via `initial`) a department. Full field set
 * CustomerDepartmentController accepts: location (required — a department always
 * lives under a location), name, description, status, cost centre (Danny 2026-07-22
 * — the middle department>location>customer cascade level; no billing email here, that
 * stays customer-only, see OverviewTab). One component serves both the top-level
 * Afdelingen tab AND the location detail's nested list (Danny: "reuse the same
 * components, don't fork") — `lockLocation` hides the location picker when
 * creating one scoped to a specific location (it's implied, not user-chosen there).
 *
 * Widened to the house "wide form" frame (Danny 27-07: "+ afdeling ook nalopen!" —
 * every create modal must match +Match/+Kandidaat's footprint) via the shared
 * WIDE_MODAL constant, and regrouped into titled, bordered cards (Algemeen/
 * Zakelijk/Omschrijving) stacked full-width, using the shared
 * `@/components/ui/modalCards` chrome (CLAUDE.md §11: one source instead of a
 * per-entity copy) so the "customers" sub-modals read as one system. The
 * location + status pickers become searchable CreatableSelects (allowCreate=
 * {false} — real relational ids, never a free-text create). This entity
 * genuinely has fewer fields than Location (5 vs 13), so its cards stay
 * lighter — see report re: not padding the layout with empty space.
 *
 * COLLAPSIBLE-TEXT-1 / STATUS-HIDDEN-1 (Danny 02-08, second round): Omschrijving
 * became the shared collapsed-ghost block (same shape as +Match's Opmerkingen,
 * mirrors AddLocationModal's own pass), and the status picker is hidden by
 * default — DepartmentDetail's own title-row editor is where status is actually
 * set — reappearing only when the tenant marked status_id required
 * (customer_department_required_fields, FlatRequiredFieldsGuard catalog).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Building } from 'lucide-react'
import { useSafePermission } from '@/hooks/useSafePermission'
import { FieldRow, TextField } from '@/components/forms/fields'
import CreatableSelect from '@/components/ui/CreatableSelect'
import CollapsibleRichText from '@/components/ui/CollapsibleRichText'
import { useAllSettings, getJsonSetting } from '@/lib/settings/useAllSettings'
import { cardHead, cardBox, row2, row3Even } from '@/components/ui/modalCards'
import SubEntityImportCard from './SubEntityImportCard'
import SubEntityModalFrame from './addmodal/SubEntityModalFrame'
import CreateErrorAlert from './addmodal/CreateErrorAlert'
import { useSubEntitySave } from './hooks/useSubEntitySave'
import type { DepartmentPayload } from './hooks/useCustomerDepartments'
import type { Department } from '@/types/customer'
import type { Id } from '@/types/common'
import type { LookupOption } from '@/types/common'

interface LocationOption { id: Id; name: string }

// 422 field-error keys are snake_case; map them back to this form's field names.
const API_TO_FORM: Record<string, string> = {
  name: 'name', location_id: 'locationId', description: 'description', status_id: 'statusId',
  cost_center: 'costCenter',
}

// Create/edit modal for a customer department, with an in-header CSV import path
// (mirrors AddCustomerModal) that closes this modal once a real import lands rows.
export default function AddDepartmentModal({ onClose, onCreate, onImported, locations = [], customerName, statuses = [], initial, lockLocationId }: {
  onClose: () => void
  onCreate?: (v: DepartmentPayload) => void
  /** Called once a real CSV import lands at least one record — the parent refreshes its list. */
  onImported?: () => void
  locations?: LocationOption[]
  customerName?: string
  statuses?: LookupOption[]
  initial?: Department | null
  // Pre-select + lock the location (creating "at this location" from the location detail).
  lockLocationId?: Id
}) {
  const { t } = useTranslation(['customers', 'common'])
  const hasPermission = useSafePermission()
  const canViewImportTemplate = hasPermission('customers.view')
  const canRunImport = hasPermission('customers.create')
  // Shared state/error management (DRY-SUBENTITY-1): import wizard
  // and 422 error handling extracted into a reusable hook.
  const { isEdit, importWizard, importOpen, setImportOpen, errors, setErrors, createError, handleApiError } =
    useSubEntitySave({ initial, apiToFormMap: API_TO_FORM, t, onImported, onClose, importEntity: 'departments' })
  const [form, setForm] = useState<DepartmentPayload>({
    name: initial?.name ?? '',
    locationId: initial?.locationId ?? lockLocationId ?? locations[0]?.id ?? '',
    description: initial?.description ?? '',
    // Kostenplaats (Danny 2026-07-22) — the middle cascade level; settable on
    // create too, not just via the DepartmentDetail edit path.
    costCenter: initial?.costCenter ?? '',
    // K-249 C.4 (31-08): billingEmail joined costCenter as an editable middle-cascade
    // field (no input on this modal yet — same as costCenter used to be — but the
    // payload shape must carry it since DepartmentPayload now requires it).
    billingEmail: initial?.billingEmail ?? '',
    statusId: initial?.statusId ?? (statuses[0]?.id as string | undefined) ?? null,
    customFields: initial?.customFields ?? {},
  })
  const set = <K extends keyof DepartmentPayload>(k: K, v: DepartmentPayload[K]) => {
    setForm(f => ({ ...f, [k]: v }))
    if (errors[k]) setErrors(e => ({ ...e, [k]: false }))
  }
  // COLLAPSIBLE-TEXT-1: Omschrijving's own collapsed/editing state.
  const [descExpanded, setDescExpanded] = useState(false)
  const [descEditing, setDescEditing] = useState(false)
  // STATUS-HIDDEN-1 (Danny 02-08, second round: "+ nieuwe afdeling ... status moet
  // weg in de popup" — status must go from the popup): hidden unless the tenant
  // marked it required — mirrors
  // AddLocationModal's own gate, same flat-array setting shape.
  const settings = useAllSettings()
  const showStatusPicker = getJsonSetting<string[]>(settings, 'customer_department_required_fields', []).includes('status_id')

  // Validate the required name/location fields, then create or update the department via the API.
  const submit = async () => {
    if (!form.name.trim() || !form.locationId) {
      setErrors({ name: !form.name.trim(), locationId: !form.locationId })
      return
    }
    const payload = { ...form, name: form.name.trim() }
    // Edit path: update() keeps its existing toast-based error handling — unchanged,
    // closes immediately.
    if (isEdit) { onCreate?.(payload); onClose(); return }
    // Create path: add() rethrows on failure (C-18) so 422 field errors land under
    // their fields here instead of a generic toast while the modal closed regardless.
    try {
      await onCreate?.(payload)
      onClose()
    } catch (err) {
      handleApiError(err)
    }
  }

  const canSubmit = !!form.name.trim() && !!form.locationId
  const statusOptions = statuses.map(s => ({ value: String(s.id ?? s.value), label: s.label }))
  const showLocationPicker = !lockLocationId

  // Render the error alert banner if present.
  const alertElement = createError && (
    <CreateErrorAlert message={createError} />
  )

  // Render the import card component if the wizard is active.
  const importCardElement = (
    <SubEntityImportCard entity="departments" wizard={importWizard} customerName={customerName}
      canView={canViewImportTemplate} canImport={canRunImport} />
  )

  return (
    <SubEntityModalFrame
      open
      onClose={onClose}
      ariaLabel={isEdit ? t('subModal.editDepartment') : t('subModal.addDepartment')}
      persistKey="customer-add-department"
      isEdit={isEdit}
      title={isEdit ? t('subModal.editDepartment') : t('subModal.addDepartment')}
      subtitle={customerName}
      icon={Building}
      iconColor="var(--color-violet)"
      iconBg="var(--color-violet-bg)"
      importOpen={importOpen}
      setImportOpen={setImportOpen}
      importButtonTitle={t('subModal.import.title', { entity: t('settings:import.entities.departments.label') })}
      importCardTitle={t('subModal.import.title', { entity: t('settings:import.entities.departments.label') })}
      alert={alertElement}
      importCard={importCardElement}
      onCancel={onClose}
      onSubmit={submit}
      cancelLabel={t('subModal.cancel')}
      submitLabel={isEdit ? t('subModal.save') : t('subModal.create')}
      submitDisabled={!canSubmit}
    >
      {/* Algemeen — name, locatie (searchable, hidden when locked), status.
          Location+status pair in one row when both show; status alone stays
          constrained to ~a third of the width (row3Even) rather than
          stretching a lone field across the full panel. */}
      <div>
        <div style={cardHead}>{t('subModal.groups.general')}</div>
        <div style={cardBox}>
          <div>
            <FieldRow label={t('subModal.departmentName')} required>
              <TextField value={form.name} onChange={v => set('name', v)} placeholder={t('subModal.departmentPlaceholder')} error={errors.name} />
            </FieldRow>
            {errors.name && <div style={{ fontSize: 11, color: 'var(--color-danger-text)', marginTop: 3 }}>{t('subModal.required')}</div>}
          </div>

          {showLocationPicker ? (
            <div style={row2}>
              <div>
                <FieldRow label={t('subModal.selectLocation')} required>
                  {locations.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--color-warning-text)', padding: '8px 11px', border: '1px solid var(--color-warning)', borderRadius: 8, background: 'var(--color-warning-bg)' }}>
                      {t('subModal.noLocationsFirst')}
                    </div>
                  ) : (
                    // Searchable (Danny 27-07): a customer can have many locations.
                    // The placeholder also drives the search box's accessible
                    // label (CreatableSelect's own a11y contract), not just the
                    // empty-state trigger text.
                    <CreatableSelect value={form.locationId ? String(form.locationId) : null} onChange={v => set('locationId', v)}
                      allowCreate={false} placeholder={t('subModal.selectLocation')}
                      options={locations.map(l => ({ value: String(l.id), label: l.name }))} />
                  )}
                </FieldRow>
                {errors.locationId && <div style={{ fontSize: 11, color: 'var(--color-danger-text)', marginTop: 3 }}>{t('subModal.required')}</div>}
              </div>
              {/* STATUS-HIDDEN-1: hidden unless the tenant marked it required — an
                  empty filler keeps the location field at its half-width column
                  instead of stretching across the row (mirrors ContactLinkCard's
                  own showLocationPicker/showDepartmentPicker filler convention). */}
              {showStatusPicker ? (
                <FieldRow label={t('subModal.status')}>
                  <CreatableSelect value={form.statusId ? String(form.statusId) : null} onChange={v => set('statusId', v || null)} allowCreate={false}
                    placeholder={t('subModal.selectStatus')} options={statusOptions} />
                </FieldRow>
              ) : <div />}
            </div>
          ) : showStatusPicker && (
            <div style={row3Even}>
              <FieldRow label={t('subModal.status')}>
                <CreatableSelect value={form.statusId ? String(form.statusId) : null} onChange={v => set('statusId', v || null)} allowCreate={false}
                  placeholder={t('subModal.selectStatus')} options={statusOptions} />
              </FieldRow>
            </div>
          )}
        </div>
      </div>

      {/* Zakelijk — kostenplaats (Danny 2026-07-22), reuses the shared
          subModal.costCenter label (same field as AddLocationModal, one
          translation source). Its own card, same as Location's, so a future
          business field (e.g. billing) has an obvious home. */}
      <div>
        <div style={cardHead}>{t('subModal.groups.business')}</div>
        <div style={cardBox}>
          <div style={row3Even}>
            <FieldRow label={t('subModal.costCenter')}><TextField value={form.costCenter} onChange={v => set('costCenter', v)} /></FieldRow>
          </div>
        </div>
      </div>

      {/* Omschrijving — its own card, same convention as AddLocationModal's
          (COLLAPSIBLE-TEXT-1, 02-08 round 2): the always-open editor became the
          shared collapsed-ghost block (same shape as +Match's Opmerkingen) so
          every create modal behaves identically; read mode still renders the
          stored HTML via SafeHtml (DepartmentDetail's Omschrijving block).
          ARIA-LABEL-1: this modal's own footer button is ALSO labelled
          subModal.create ("Toevoegen"/"Add", same word as the generic
          common:add placeholder) — a distinct aria-label (the card's own
          heading) prevents two buttons sharing one accessible name. */}
      <div>
        <div style={cardHead}>{t('departments.detail.description')}</div>
        <div style={cardBox}>
          <CollapsibleRichText t={t} value={form.description} onChange={v => set('description', v)}
            expanded={descExpanded} setExpanded={setDescExpanded}
            editing={descEditing} setEditing={setDescEditing}
            placeholder={t('common:add')} ariaLabel={t('departments.detail.description')} />
        </div>
      </div>
    </SubEntityModalFrame>
  )
}
