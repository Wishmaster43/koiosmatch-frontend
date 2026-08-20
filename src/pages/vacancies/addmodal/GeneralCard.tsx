/**
 * GeneralCard — Algemeen: titel (required) + functie + branche. Status moved
 * out to the header pill row (punt 7); klant/locatie/afdeling/contactpersoon
 * moved to their own ClientCascadeCard (punt 6) — this card now only answers
 * "what job is this".
 */
import { useTranslation } from 'react-i18next'
import { FieldRow, TextField } from '@/components/forms/fields'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { cardHead, cardBox } from '@/components/ui/modalCards'

interface Props {
  title: string; onTitleChange: (v: string) => void; titleError?: boolean
  category: string; onCategoryChange: (v: string) => void
  functions: string[]
  industry: string; onIndustryChange: (v: string) => void
  industries: string[]
}

export default function GeneralCard({
  title, onTitleChange, titleError, category, onCategoryChange, functions, industry, onIndustryChange, industries,
}: Props) {
  const { t } = useTranslation(['vacancies', 'common'])
  return (
    <div>
      <div style={cardHead}>{t('modal.fields.cardGeneral')}</div>
      <div style={cardBox}>
        <div>
          <FieldRow label={t('modal.fields.title')} required>
            <TextField value={title} onChange={onTitleChange} placeholder={t('modal.titlePlaceholder')} error={titleError} />
          </FieldRow>
          {titleError && <div style={{ fontSize: 11, color: 'var(--color-danger-text)', marginTop: 3 }}>{t('modal.required')}</div>}
        </div>
        {/* Punt 5: "Categorie" -> "Functie" everywhere — the API key stays
            `category` (VacancyWriter aliases it onto `function_title`); only
            the i18n VALUE renames (see the delivery report's locale-key list —
            this file cannot edit locales, so the key name is unchanged). */}
        {/* VAC-CLEAR-1: both fields are `sometimes|nullable` server-side (StoreVacancyRequest) — optional, so both carry the clear cross. */}
        <FieldRow label={t('modal.fields.category')}>
          <CreatableSelect value={category || null} onChange={onCategoryChange} allowCreate={false}
            clearable clearLabel={t('modal.fields.category')}
            placeholder={t('common:select')} options={functions} />
        </FieldRow>
        <FieldRow label={t('modal.fields.industry')}>
          <CreatableSelect value={industry || null} onChange={onIndustryChange} allowCreate={false}
            clearable clearLabel={t('modal.fields.industry')}
            placeholder={t('common:select')} options={industries} />
        </FieldRow>
      </div>
    </div>
  )
}
