/**
 * AddDepartmentModal — create (or edit, via `initial`) a department. Full field set
 * CustomerDepartmentController accepts: location (required — a department always
 * lives under a location), name, description, status, cost centre (Danny 2026-07-22
 * — the middle afdeling>locatie>klant cascade level; no billing email here, that
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
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { Building } from 'lucide-react'
import FloatingPanel from '@/components/ui/FloatingPanel'
import { FieldRow, TextField } from '@/components/forms/fields'
import CreatableSelect from '@/components/ui/CreatableSelect'
import CollapsibleRichText from '@/components/ui/CollapsibleRichText'
import { useAllSettings, getJsonSetting } from '@/lib/settings/useAllSettings'
import { BTN_H } from '@/config/buttonMetrics'
import { WIDE_MODAL } from '@/components/ui/modalMetrics'
import { cardHead, cardBox, row2, row3Even } from '@/components/ui/modalCards'
import CollapsedCard from '@/components/ui/CollapsedCard'
import SubEntityImportCard, { subEntityImportTitle } from './SubEntityImportCard'
import { useImportWizard } from '@/pages/settings/sections/importeren/useImportWizard'
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
  const authCtx = useAuth() as unknown as { hasPermission?: (permName: string) => boolean } | null
  // SUBENTITY-IMPORT-1: falls back to "no permission" rather than crashing when the
  // context is mid-boot OR genuinely absent (this modal is also mounted from screens
  // with no AuthProvider ancestor in tests) — mirrors AddCustomerModal's own fallback.
  const hasPermission = authCtx?.hasPermission ?? (() => false)
  const canViewImportTemplate = hasPermission('customers.view')
  const canRunImport = hasPermission('customers.create')
  // The wizard state lives HERE (container), not in the card — mirrors AddCustomerModal.
  const importWizard = useImportWizard('departments')
  const isEdit = Boolean(initial)
  const [form, setForm] = useState<DepartmentPayload>({
    name: initial?.name ?? '',
    locationId: initial?.locationId ?? lockLocationId ?? locations[0]?.id ?? '',
    description: initial?.description ?? '',
    // Kostenplaats (Danny 2026-07-22) — the middle cascade level; settable on
    // create too, not just via the DepartmentDetail edit path.
    costCenter: initial?.costCenter ?? '',
    statusId: initial?.statusId ?? (statuses[0]?.id as string | undefined) ?? null,
    customFields: initial?.customFields ?? {},
  })
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  // Non-field 422/generic failure — only reachable on the CREATE path (see submit()).
  const [createError, setCreateError] = useState<string | null>(null)
  // COLLAPSIBLE-TEXT-1: Omschrijving's own collapsed/editing state.
  const [descExpanded, setDescExpanded] = useState(false)
  const [descEditing, setDescEditing] = useState(false)
  // STATUS-HIDDEN-1 (Danny 02-08, second round: "+ nieuwe afdeling ... status moet
  // weg in de popup"): hidden unless the tenant marked it required — mirrors
  // AddLocationModal's own gate, same flat-array setting shape.
  const settings = useAllSettings()
  const showStatusPicker = getJsonSetting<string[]>(settings, 'customer_department_required_fields', []).includes('status_id')
  const set = <K extends keyof DepartmentPayload>(k: K, v: DepartmentPayload[K]) => {
    setForm(f => ({ ...f, [k]: v }))
    if (errors[k]) setErrors(e => ({ ...e, [k]: false }))
    setCreateError(null)
  }

  // SUBENTITY-IMPORT-1: a real run that landed at least one row means the department(s)
  // already exist — close this modal (and let the parent refresh its list) so the
  // untouched manual form below can never also fire a second, duplicate create.
  useEffect(() => {
    if (importWizard.run.status !== 'success') return
    const { summary } = importWizard.run.result
    if (summary.create + summary.update === 0) return
    onImported?.()
    onClose()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the run RESULT changing, not onClose/onImported identity
  }, [importWizard.run])

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
      const e = err as { response?: { data?: { errors?: Record<string, unknown>; message?: string } } }
      const apiErrors = e?.response?.data?.errors
      if (apiErrors) {
        const e2: Record<string, boolean> = {}
        Object.keys(apiErrors).forEach(k => { e2[API_TO_FORM[k] ?? k] = true })
        setErrors(e2)
      } else {
        setCreateError(e?.response?.data?.message ?? t('common:errorGeneric'))
      }
    }
  }

  const canSubmit = !!form.name.trim() && !!form.locationId
  const statusOptions = statuses.map(s => ({ value: String(s.id ?? s.value), label: s.label }))
  const showLocationPicker = !lockLocationId

  return (
    // POPUP-SLEEP-1: swapped the bespoke overlay/panel shell for the shared
    // draggable FloatingPanel — same focus-trap/backdrop/Esc semantics.
    <FloatingPanel open onClose={onClose}
      ariaLabel={isEdit ? t('subModal.editDepartment') : t('subModal.addDepartment')}
      persistKey="customer-add-department" scrollBody={false}
      width="min(calc(100vw - 48px), 1060px)" maxWidth={`${WIDE_MODAL.maxWidth}px`}
      header={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--color-violet-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Building size={15} color="var(--color-violet)" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{isEdit ? t('subModal.editDepartment') : t('subModal.addDepartment')}</div>
            {customerName && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{customerName}</div>}
          </div>
        </div>
      }>
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
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
                {errors.name && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 3 }}>{t('subModal.required')}</div>}
              </div>

              {showLocationPicker ? (
                <div style={row2}>
                  <div>
                    <FieldRow label={t('subModal.selectLocation')} required>
                      {locations.length === 0 ? (
                        <div style={{ fontSize: 12, color: 'var(--color-warning)', padding: '8px 11px', border: '1px solid var(--color-warning)', borderRadius: 8, background: 'var(--color-warning-bg)' }}>
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
                    {errors.locationId && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 3 }}>{t('subModal.required')}</div>}
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

          {/* SUBENTITY-IMPORT-1 (moved to the bottom + collapsed, Danny 03-08 A+D
              decision): a secondary/optional bulk-create path must never force a
              scroll past it before the required manual fields are even visible.
              No column split here — this form is too short to justify one (unlike
              AddLocationModal's own two-column pass). */}
          {!isEdit && (
            <CollapsedCard title={subEntityImportTitle(t, 'departments')} filled={!!importWizard.file}>
              <SubEntityImportCard entity="departments" wizard={importWizard} customerName={customerName}
                canView={canViewImportTemplate} canImport={canRunImport} />
            </CollapsedCard>
          )}
        </div>

        {/* Server-side rejection (non-field 422 / other failure) — shown in place, modal stays open. */}
        {createError && (
          <div role="alert" style={{ margin: '0 22px 8px', padding: '8px 10px', fontSize: 12, borderRadius: 8,
            color: 'var(--color-danger)', background: 'var(--color-danger-bg)',
            border: '1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)', flexShrink: 0 }}>
            {createError}
          </div>
        )}

        {/* BTN_H (§4/§9): one explicit height for every text/action button, everywhere. */}
        <div style={{ padding: '12px 22px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
          <button onClick={onClose} style={{ height: BTN_H, padding: '0 16px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--text)', cursor: 'pointer' }}>{t('subModal.cancel')}</button>
          <button onClick={submit} disabled={!canSubmit} style={{ height: BTN_H, padding: '0 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', background: canSubmit ? 'var(--color-primary)' : 'var(--border)', color: canSubmit ? 'var(--color-on-accent)' : 'var(--text-muted)', cursor: canSubmit ? 'pointer' : 'not-allowed' }}>
            {isEdit ? t('subModal.save') : t('subModal.create')}
          </button>
        </div>
    </FloatingPanel>
  )
}
