/**
 * LocationGeneralCard — the "Algemeen" card of AddLocationModal: the location
 * name (required) plus an optional status picker. Extracted (§0.3 — the
 * ~400-line split trigger, 2026-08-03); pure presentational, every value and
 * callback comes from the parent's own form state.
 *
 * STATUS-HIDDEN-1 (Danny 02-08, second round): the status picker is hidden by
 * default — LocationDetail's own title-row status editor already covers create
 * AND edit — and only reappears when the tenant marked status_id required
 * (`showStatusPicker`, owned by the parent's settings read).
 */
import { useTranslation } from 'react-i18next'
import { Field, TextField } from '@/components/forms/fields'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { cardHead, cardBox, row2 } from '@/components/ui/modalCards'

// FIELD-HEIGHT-1: same literal as the parent modal's own `pickerStyle` (kept
// local since this is the only field in this card that needs it).
const pickerStyle = { padding: '8px 11px', borderRadius: 8, fontSize: 13 } as const

interface OptionRow { value: string; label: string }

interface LocationGeneralCardProps {
  name: string
  onNameChange: (v: string) => void
  nameError?: boolean
  showStatusPicker: boolean
  statusId: string | null
  onStatusChange: (v: string) => void
  statusOptions: OptionRow[]
}

export default function LocationGeneralCard({
  name, onNameChange, nameError, showStatusPicker, statusId, onStatusChange, statusOptions,
}: LocationGeneralCardProps) {
  const { t } = useTranslation(['customers', 'common'])
  return (
    <div>
      <div style={cardHead}>{t('subModal.groups.general')}</div>
      <div style={cardBox}>
        <div>
          <Field label={t('subModal.locationName')} required>
            <TextField value={name} onChange={onNameChange} placeholder={t('subModal.locationPlaceholder')} error={nameError} />
          </Field>
          {nameError && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 3 }}>{t('subModal.required')}</div>}
        </div>
        {/* STATUS-HIDDEN-1: hidden unless the tenant marked it required —
            LocationDetail's own title-row picker is where status is set. */}
        {showStatusPicker && (
          <div style={{ ...row2, alignItems: 'end' }}>
            <Field label={t('subModal.status')}>
              <CreatableSelect value={statusId ? String(statusId) : null} onChange={onStatusChange} allowCreate={false}
                placeholder={t('subModal.selectStatus')} options={statusOptions} style={pickerStyle} />
            </Field>
            <div />
          </div>
        )}
      </div>
    </div>
  )
}
