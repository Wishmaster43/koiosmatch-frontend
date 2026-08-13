/**
 * RecruiterCard — the owner (recruiter) picker. Defaults to the logged-in user
 * when they are assignable (punt 8, the default itself lives in
 * useAddVacancyForm, mirroring AddCustomerModal's ACCOUNTMANAGER-DEFAULT-1);
 * this card only renders the picker.
 */
import { useTranslation } from 'react-i18next'
import { FieldRow } from '@/components/forms/fields'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { cardHead, cardBox } from '@/components/ui/modalCards'

interface Props {
  ownerId: string; onOwnerChange: (v: string) => void
  userOptions: Array<{ value: string; label: string }>
}

export default function RecruiterCard({ ownerId, onOwnerChange, userOptions }: Props) {
  const { t } = useTranslation(['vacancies', 'common'])
  return (
    <div>
      <div style={cardHead}>{t('modal.fields.cardOwner')}</div>
      <div style={cardBox}>
        {/* VAC-CLEAR-1: `owner_id` is `sometimes|nullable` server-side (StoreVacancyRequest) — optional, so the picker carries the clear cross. */}
        <FieldRow label={t('modal.fields.owner')}>
          <CreatableSelect value={ownerId || null} onChange={onOwnerChange} allowCreate={false}
            clearable clearLabel={t('modal.fields.owner')}
            placeholder={t('common:select')} options={userOptions} />
        </FieldRow>
      </div>
    </div>
  )
}
