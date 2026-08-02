/**
 * ContactLinkCard — the "Koppeling" card of AddContactPersonModal (location/
 * department pickers + status + primary toggle). Extracted so the parent modal
 * stays under the ~400-line split trigger (CLAUDE.md §3) once the CSV import
 * card (SUBENTITY-IMPORT-1) pushed it past that mark — pure presentational,
 * every value and callback comes from the parent's own form state.
 */
import { useTranslation } from 'react-i18next'
import { Field } from '@/components/forms/fields'
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
  onLocationChange: (v: string) => void
  onDepartmentChange: (v: string) => void
  onStatusChange: (v: string) => void
  onPrimaryToggle: (v: boolean) => void
}

export default function ContactLinkCard({
  locationId, departmentId, statusId, isPrimary, locationOptions, departmentOptions, departmentPlaceholder, statusOptions,
  showLocationPicker, showDepartmentPicker, onLocationChange, onDepartmentChange, onStatusChange, onPrimaryToggle,
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
              <Field label={t('subModal.selectLocation')}>
                <CreatableSelect value={locationId ? String(locationId) : null} allowCreate={false}
                  onChange={onLocationChange}
                  placeholder={t('subModal.noneOption')} options={locationOptions}
                  style={CREATABLE_STYLE} />
              </Field>
            )}
            {showDepartmentPicker && (
              <Field label={t('subModal.selectDepartment')}>
                <CreatableSelect value={departmentId ? String(departmentId) : null} allowCreate={false}
                  onChange={onDepartmentChange}
                  placeholder={departmentPlaceholder} options={departmentOptions} style={CREATABLE_STYLE} />
              </Field>
            )}
            {showLocationPicker !== showDepartmentPicker && <div />}
          </div>
        )}
        <div style={{ ...row2, alignItems: 'end' }}>
          <Field label={t('subModal.status')}>
            <CreatableSelect value={statusId ? String(statusId) : null} allowCreate={false}
              onChange={onStatusChange} placeholder={t('subModal.selectStatus')} options={statusSelectOptions}
              style={CREATABLE_STYLE} />
          </Field>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, paddingBottom: 8 }}>
            <Toggle checked={isPrimary} onChange={onPrimaryToggle} ariaLabel={t('subModal.isPrimary')} />
            <span style={{ fontSize: 12, color: 'var(--text)' }}>{t('subModal.isPrimary')}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
