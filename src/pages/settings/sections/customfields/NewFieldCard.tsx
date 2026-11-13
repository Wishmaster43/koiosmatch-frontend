import { Caption, monoStyle } from '@/components/ui/typography'
import { useTranslation } from 'react-i18next'
import SearchSelect from '@/components/ui/SearchSelect'
import AddFormFooter from '@/components/ui/AddFormFooter'
import { FIELD_TYPES, type FieldType, type NewFieldForm } from './types'
import { toSlug } from './helpers'
import { cardStyle, inputStyle, labelStyle } from './customFieldStyles'

// Props: the add-form draft with its updater, and the submit/cancel callbacks.
interface NewFieldCardProps {
  newForm: NewFieldForm
  onChange: (update: (p: NewFieldForm) => NewFieldForm) => void
  saving: boolean
  onSubmit: () => void
  onCancel: () => void
}

// The add-new-field form card.
export default function NewFieldCard({ newForm, onChange, saving, onSubmit, onCancel }: NewFieldCardProps) {
  const { t } = useTranslation('settings')
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={labelStyle}>{t('customFieldsSettings.label')} *</label>
            {/* Placeholder mirrors the chosen type (Danny 13-09, row 17) — switching
                type swaps the example immediately, never the typed value. */}
            <input value={newForm.label} onChange={e => onChange(p => ({ ...p, label: e.target.value, key: toSlug(e.target.value) }))}
              placeholder={t(`customFieldsSettings.examples.${newForm.type}.label`)} style={inputStyle} autoFocus />
          </div>
          <div>
            <label style={labelStyle}>{t('customFieldsSettings.key')}</label>
            <input value={newForm.key} onChange={e => onChange(p => ({ ...p, key: e.target.value }))}
              placeholder={t(`customFieldsSettings.examples.${newForm.type}.key`)} style={{ ...inputStyle, ...monoStyle }} />
          </div>
        </div>
        <div>
          <label style={labelStyle}>{t('customFieldsSettings.type')}</label>
          {/* Herhaal-audit r4 finding 5/6/7: SearchSelect's own default trigger face. */}
          <SearchSelect
            options={FIELD_TYPES.map(tp => ({ value: tp, label: t(`customFieldsSettings.types.${tp}`) }))}
            selected={[newForm.type]}
            onToggle={(v: string) => onChange(p => ({ ...p, type: v as FieldType }))}
            closeOnToggle
            searchable={false}
            triggerLabel={t(`customFieldsSettings.types.${newForm.type}`)}
          />
        </div>
        {newForm.type === 'select' && (
          <div>
            <label style={labelStyle}>{t('customFieldsSettings.options')} *</label>
            <input value={newForm.options} onChange={e => onChange(p => ({ ...p, options: e.target.value, optionError: false }))}
              placeholder={t('customFieldsSettings.optionsPlaceholder')} style={inputStyle} />
            {newForm.optionError && (
              <p style={{ fontSize: 11, color: 'var(--color-danger-text)', marginTop: 3 }}>{t('customFieldsSettings.optionsRequired')}</p>
            )}
            <Caption as="p" style={{ marginTop: newForm.optionError ? 1 : 3 }}>{t('customFieldsSettings.optionsHint')}</Caption>
          </div>
        )}
        <AddFormFooter
          onCancel={() => onCancel()}
          cancelLabel={t('common.cancel')}
          onSubmit={onSubmit}
          submitLabel={t('customFieldsSettings.add')}
          savingLabel={t('common.saving')}
          saving={saving}
          disabled={!newForm.label.trim()}
        />
      </div>
    </div>
  )
}
