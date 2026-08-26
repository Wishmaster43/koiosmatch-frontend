/**
 * ContactLinkCard — the "Koppeling" card of AddContactPersonModal (location/
 * department pickers + status + primary toggle). Extracted so the parent modal
 * stays under the ~400-line split trigger (CLAUDE.md §3) once the CSV import
 * card (SUBENTITY-IMPORT-1) pushed it past that mark — pure presentational,
 * every value and callback comes from the parent's own form state.
 *
 * STATUS-HIDDEN-1 (Danny 02-08, second round: "+ nieuwe contactpersoon ... status
 * moet weg in de popup"): the parent decides `showStatusPicker` (tenant setting
 * gate, mirrors AddLocationModal/AddDepartmentModal's own) and this card only
 * renders the field when true — an empty filler keeps the toggle's own row
 * layout unchanged when the picker is absent.
 */
import { useTranslation } from 'react-i18next'
import { FieldRow } from '@/components/forms/fields'
import CreatableSelect from '@/components/ui/CreatableSelect'
import Toggle from '@/components/ui/Toggle'
import { cardHead, cardBox, row2 } from '@/components/ui/modalCards'
import type { LookupOption } from '@/types/common'

interface OptionRow { value: string; label: string }

// Matches the TextField input footprint exactly — mirrors the parent modal's
// own CREATABLE_STYLE (kept local since this is the only file that needs it now).
const CREATABLE_STYLE = { padding: '8px 11px', borderRadius: 8, fontSize: 13 }

interface ContactLinkCardProps {
  locationId: string | null
  departmentId: string | null
  statusId: string | null
  isPrimary: boolean
  locationOptions: OptionRow[]
  departmentOptions: OptionRow[]
  departmentPlaceholder: string
  statusOptions: LookupOption[]
  // `lockLocationId`/`lockDepartmentId` (adding "at this location"/"in this
  // department") hide ONLY the locked field — the other still renders and cascades.
  showLocationPicker: boolean
  showDepartmentPicker: boolean
  // STATUS-HIDDEN-1: hidden unless the tenant marked status_id required.
  showStatusPicker: boolean
  onLocationChange: (v: string) => void
  onDepartmentChange: (v: string) => void
  onStatusChange: (v: string) => void
  onPrimaryToggle: (v: boolean) => void
}

// Location/department/status/primary card for the add-contact modal; purely presentational, and hides the status field entirely when the tenant hasn't required it (see file header).
export default function ContactLinkCard({
  locationId, departmentId, statusId, isPrimary, locationOptions, departmentOptions, departmentPlaceholder, statusOptions,
  showLocationPicker, showDepartmentPicker, showStatusPicker, onLocationChange, onDepartmentChange, onStatusChange, onPrimaryToggle,
}: ContactLinkCardProps) {
  const { t } = useTranslation(['customers', 'common'])
  const statusSelectOptions = statusOptions.map(s => ({ value: String(s.id ?? s.value), label: s.label }))

  return (
    <div>
      <div style={cardHead}>{t('subModal.groups.link')}</div>
      <div style={cardBox}>
        {/* Location is picked at the top-level Contactpersonen tab —
            `lockLocationId` (adding "at this location") hides ONLY this field.
            Department is picked from the top-level tab or a location's nested
            list — `lockDepartmentId` (adding "in this department") hides ONLY
            that field. Whichever field stays visible keeps its half-width
            column via an empty filler cell, never a lone full-width control
            (mirrors the Function row above); when BOTH are locked the row
            folds away since there is nothing left to pick. */}
        {(showLocationPicker || showDepartmentPicker) && (
          <div style={row2}>
            {showLocationPicker && (
              <FieldRow label={t('subModal.selectLocation')}>
                {/* CLEAR-SWEEP (Danny 13-08): optional — useCustomerContacts.toApi
                    already coerces an empty locationId to null on save. */}
                <CreatableSelect value={locationId ? String(locationId) : null} allowCreate={false}
                  onChange={onLocationChange}
                  clearable clearLabel={t('subModal.selectLocation')}
                  placeholder={t('subModal.noneOption')} options={locationOptions}
                  style={CREATABLE_STYLE} />
              </FieldRow>
            )}
            {showDepartmentPicker && (
              <FieldRow label={t('subModal.selectDepartment')}>
                {/* CLEAR-SWEEP: optional — useCustomerContacts.toApi coerces an empty
                    departmentId to null on save the same way. */}
                <CreatableSelect value={departmentId ? String(departmentId) : null} allowCreate={false}
                  onChange={onDepartmentChange}
                  clearable clearLabel={t('subModal.selectDepartment')}
                  placeholder={departmentPlaceholder} options={departmentOptions} style={CREATABLE_STYLE} />
              </FieldRow>
            )}
            {showLocationPicker !== showDepartmentPicker && <div />}
          </div>
        )}
        <div style={{ ...row2, alignItems: 'end' }}>
          {/* STATUS-HIDDEN-1: hidden unless the tenant marked it required — an
              empty filler keeps the toggle at its half-width column instead of
              stretching across the row (mirrors the location/department filler
              convention above). */}
          {showStatusPicker ? (
            <FieldRow label={t('subModal.status')}>
              <CreatableSelect value={statusId ? String(statusId) : null} allowCreate={false}
                onChange={onStatusChange} placeholder={t('subModal.selectStatus')} options={statusSelectOptions}
                style={CREATABLE_STYLE} />
            </FieldRow>
          ) : <div />}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, paddingBottom: 8 }}>
            <Toggle checked={isPrimary} onChange={onPrimaryToggle} ariaLabel={t('subModal.isPrimary')} />
            <span style={{ fontSize: 12, color: 'var(--text)' }}>{t('subModal.isPrimary')}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
