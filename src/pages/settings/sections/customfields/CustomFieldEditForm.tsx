import { Caption } from '@/components/ui/typography'
import { useTranslation } from 'react-i18next'
import SearchSelect from '@/components/ui/SearchSelect'
import EditorRowFooter from '@/components/ui/EditorRowFooter'
import { FIELD_TYPES, type CustomField, type EditForm, type FieldType } from './types'
import { inputStyle, labelStyle } from './customFieldStyles'

// Props: the field and its draft, plus the edit/save/delete/close callbacks bound by the row.
interface CustomFieldEditFormProps {
  field: CustomField
  ef: EditForm
  saving: boolean
  onEdit: (k: keyof EditForm, v: EditForm[keyof EditForm]) => void
  onSave: () => void
  onDelete: () => void
  onClose: () => void
}

// The expanded edit form of one custom field (label, key, type, options, footer).
export default function CustomFieldEditForm({ field, ef, saving, onEdit, onSave, onDelete, onClose }: CustomFieldEditFormProps) {
  const { t } = useTranslation('settings')
  const currentType = ef.type ?? field.type
  return (
    <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Label — placeholder mirrors the currently chosen type, so switching
          type (Danny 13-09, row 17) swaps the example without touching the value. */}
      <div>
        <label style={labelStyle}>{t('customFieldsSettings.label')}</label>
        <input value={ef.label ?? field.label} onChange={e => onEdit('label', e.target.value)}
          placeholder={t(`customFieldsSettings.examples.${currentType}.label`)} style={inputStyle} />
      </div>

      {/* Key (immutable) */}
      <div>
        <label style={labelStyle}>{t('customFieldsSettings.key')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({t('customFieldsSettings.immutable')})</span></label>
        <input value={field.key} disabled style={{ ...inputStyle, opacity: 0.5, cursor: 'not-allowed' }} />
      </div>

      {/* Type — locked once the field has data: switching type on stored
          values has no safe conversion (e.g. text -> number), so the
          selector goes inert via SearchSelect's own `disabled` prop
          (the single source of truth — no per-callsite guard/styling). */}
      <div>
        <label style={labelStyle}>{t('customFieldsSettings.type')} {field.has_data && <span style={{ color: 'var(--color-warning-text)', fontWeight: 400 }}>({t('customFieldsSettings.hasData')})</span>}</label>
        {/* Herhaal-audit r4 finding 5/6/7: SearchSelect's own default
            single-pick trigger face (closeOnToggle, no renderTrigger) —
            never a hand-painted trigger button per call site. */}
        <SearchSelect
          options={FIELD_TYPES.map(tp => ({ value: tp, label: t(`customFieldsSettings.types.${tp}`) }))}
          selected={[currentType]}
          onToggle={(v: string) => onEdit('type', v as FieldType)}
          closeOnToggle
          searchable={false}
          disabled={field.has_data}
          triggerLabel={t(`customFieldsSettings.types.${currentType}`)}
        />
      </div>

      {/* Options — only for select type */}
      {currentType === 'select' && (
        <div>
          <label style={labelStyle}>{t('customFieldsSettings.options')} *</label>
          <input value={ef.options ?? (field.options ?? []).join(', ')} onChange={e => onEdit('options', e.target.value)}
            placeholder={t('customFieldsSettings.optionsPlaceholder')} style={inputStyle} />
          {ef.optionError && (
            <p style={{ fontSize: 11, color: 'var(--color-danger-text)', marginTop: 3 }}>{t('customFieldsSettings.optionsRequired')}</p>
          )}
          <Caption as="p" style={{ marginTop: ef.optionError ? 1 : 3 }}>{t('customFieldsSettings.optionsHint')}</Caption>
        </div>
      )}

      {/* Actions — herhaal-audit r4 finding 4: Button's own dangerSoft/
          secondary recipe covers the disabled look; no per-callsite
          background/colour ternary needed anymore. */}
      <div style={{ marginTop: 4 }}>
      <EditorRowFooter
        onDelete={() => onDelete()}
        deleteLabel={t('customFieldsSettings.delete')}
        deleteDisabled={field.has_data}
        deleteTitle={field.has_data ? t('customFieldsSettings.deleteBlocked') : t('customFieldsSettings.delete')}
        onCancel={() => onClose()}
        cancelLabel={t('common.cancel')}
        onSave={() => onSave()}
        saveLabel={t('common.save')}
        savingLabel={t('common.saving')}
        saving={saving}
      />
      </div>
    </div>
  )
}
