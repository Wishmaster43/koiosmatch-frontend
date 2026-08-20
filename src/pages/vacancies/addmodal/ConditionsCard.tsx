/**
 * ConditionsCard — Voorwaarden: salaris min/max + periode, uren min/max (punt
 * 16). Salary/hours are the only "voorwaarden" that exist backend-side — a
 * free-text arbeidsvoorwaarden field was NOT invented. min/max placeholders
 * stay literal ('min'/'max'), mirroring DetailsConditionsTab's own documented
 * choice (not new i18n scope for a pre-existing convention).
 */
import { useTranslation } from 'react-i18next'
import { FieldRow, TextField } from '@/components/forms/fields'
import { cardHead, cardBox, row3Even, row2 } from '@/components/ui/modalCards'

type ConditionsKey = 'salaryMin' | 'salaryMax' | 'salaryPeriod' | 'hoursMin' | 'hoursMax'

interface Props {
  salaryMin: string; salaryMax: string; salaryPeriod: string
  hoursMin: string; hoursMax: string
  onChange: (k: ConditionsKey, v: string) => void
}

export default function ConditionsCard({ salaryMin, salaryMax, salaryPeriod, hoursMin, hoursMax, onChange }: Props) {
  const { t } = useTranslation(['vacancies', 'common'])
  return (
    <div>
      <div style={cardHead}>{t('details.groups.conditions')}</div>
      <div style={cardBox}>
        <FieldRow label={t('details.salary')}>
          <div style={row3Even}>
            <TextField type="number" value={salaryMin} onChange={v => onChange('salaryMin', v)} placeholder={t('common:placeholders.min')} />
            <TextField type="number" value={salaryMax} onChange={v => onChange('salaryMax', v)} placeholder={t('common:placeholders.max')} />
            <TextField value={salaryPeriod} onChange={v => onChange('salaryPeriod', v)} placeholder={t('modal.fields.salaryPeriodPlaceholder')} />
          </div>
        </FieldRow>
        <FieldRow label={t('details.hours')}>
          <div style={row2}>
            <TextField type="number" value={hoursMin} onChange={v => onChange('hoursMin', v)} placeholder={t('common:placeholders.min')} />
            <TextField type="number" value={hoursMax} onChange={v => onChange('hoursMax', v)} placeholder={t('common:placeholders.max')} />
          </div>
        </FieldRow>
      </div>
    </div>
  )
}
