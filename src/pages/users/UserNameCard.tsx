/**
 * UserNameCard — the shared "Personal" titled card (first/last name, label-left
 * row pair) used by both NewUserModal and EditUserModal. Extracted once both
 * modals gained the same wide-form card layout (SETTINGS-INCON-B2, Danny 13-09)
 * and jscpd flagged the two blocks as an exact clone — one shared component
 * instead of two copies drifting apart later.
 */
import { useTranslation } from 'react-i18next'
import { cardHead, cardBox, row2 } from '@/components/ui/modalCards'
import { FieldRow, TextField } from '@/components/forms/fields'

// Props: current first/last name values + their own onChange, so both the create
// (plain useState) and edit (same shape) forms can wire it without adapting shape.
export default function UserNameCard({ firstname, lastname, onFirstname, onLastname }: {
  firstname: string
  lastname: string
  onFirstname: (v: string) => void
  onLastname: (v: string) => void
}) {
  const { t } = useTranslation('users')
  return (
    <div>
      <div style={cardHead}>{t('cardPersonal')}</div>
      <div style={cardBox}>
        <div style={row2}>
          <FieldRow label={t('firstName')} required>
            <TextField value={firstname} onChange={onFirstname} placeholder={t('common:placeholders.firstName')} />
          </FieldRow>
          <FieldRow label={t('lastName')}>
            <TextField value={lastname} onChange={onLastname} placeholder={t('common:placeholders.lastName')} />
          </FieldRow>
        </div>
      </div>
    </div>
  )
}
