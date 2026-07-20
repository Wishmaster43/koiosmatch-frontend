/**
 * WorkCard — the "Werk" card: function title (lookup combobox) + owner picker.
 * Pure presentational: form values in, `set()` callback out.
 */
import { useTranslation } from 'react-i18next'
import type { FormState } from '../AddCandidateModal'
import { Field, SelectField, CreatableSelect, cardHead, cardBox, type FieldOption } from './fields'

interface WorkCardProps {
  form: FormState
  set: (k: keyof FormState, v: string) => void
  isReq: (k: keyof FormState) => boolean
  allowFreeEntry: boolean
  functions: Array<string | FieldOption>
  ownerOptions: FieldOption[]
}

export default function WorkCard({ form, set, isReq, allowFreeEntry, functions, ownerOptions }: WorkCardProps) {
  const { t } = useTranslation(['candidates', 'common'])
  return (
    <div>
      <div style={cardHead}>{t('modal.fields.cardWork')}</div>
      <div style={cardBox}>
        <Field label={t('modal.fields.functionTitle')} required={isReq('functionTitle')}>
          <CreatableSelect value={form.functionTitle || null} onChange={(v: string) => set('functionTitle', v)} allowCreate={allowFreeEntry}
          placeholder={t('modal.fields.functionPlaceholder')} options={functions} menuWidth={280} />
        </Field>
        <Field label={t('modal.fields.owner')}>
          <SelectField value={String(form.ownerId)} onChange={v => set('ownerId', v)}
            placeholder={t('common:select')} options={ownerOptions} />
        </Field>
      </div>
    </div>
  )
}
