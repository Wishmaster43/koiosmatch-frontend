/**
 * GeneralCard — Algemeen: titel (required) + functie + branche. Status moved
 * out to the header pill row (punt 7); klant/locatie/afdeling/contactpersoon
 * moved to their own ClientCascadeCard (punt 6) — this card now only answers
 * "what job is this".
 */
import { useTranslation } from 'react-i18next'
import { Field, TextField } from '@/components/forms/fields'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { cardHead, cardBox, row2 } from '@/components/ui/modalCards'

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
          <Field label={t('modal.fields.title')} required>
            <TextField value={title} onChange={onTitleChange} placeholder={t('modal.titlePlaceholder')} error={titleError} />
          </Field>
          {titleError && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 3 }}>{t('modal.required')}</div>}
        </div>
        <div style={row2}>
          {/* Punt 5: "Categorie" -> "Functie" everywhere — the API key stays
              `category` (VacancyWriter aliases it onto `function_title`); only
              the i18n VALUE renames (see the delivery report's locale-key list —
              this file cannot edit locales, so the key name is unchanged). */}
          <Field label={t('modal.fields.category')}>
            <CreatableSelect value={category || null} onChange={onCategoryChange} allowCreate={false}
              placeholder={t('common:select')} options={functions} />
          </Field>
          <Field label={t('modal.fields.industry')}>
            <CreatableSelect value={industry || null} onChange={onIndustryChange} allowCreate={false}
              placeholder={t('common:select')} options={industries} />
          </Field>
        </div>
      </div>
    </div>
  )
}
