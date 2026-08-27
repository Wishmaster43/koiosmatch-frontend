/**
 * CustomFieldsSection — the "Extra" tenant-custom-fields block for
 * AddApplicationModal (§3A(f): rendered only once ≥1 active def exists).
 * Extracted verbatim (R6) from that file — behaviour is unchanged, only the location.
 */
import { useTranslation } from 'react-i18next'
import RichTextEditor from '@/components/ui/RichTextEditor'
import { GroupLabel } from '@/components/ui/typography'
import CustomFieldInput from './CustomFieldInput'
import type { CustomFieldDef } from '@/lib/useCustomFields'

export default function CustomFieldsSection({
  simpleCustomFields, textCustomFields, customFieldValues, setCustomField, hasError,
}: {
  simpleCustomFields: CustomFieldDef[]
  textCustomFields: CustomFieldDef[]
  customFieldValues: Record<string, unknown>
  setCustomField: (key: string, v: unknown) => void
  hasError: boolean
}) {
  const { t } = useTranslation('applications')
  return (
    <div style={hasError ? { border: '1px solid var(--color-danger)', borderRadius: 8, padding: 10 } : undefined}>
      <GroupLabel style={{ letterSpacing: '0.04em', marginBottom: 8 }}>
        {t('common:customFieldsCard.title')}
      </GroupLabel>
      {simpleCustomFields.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
          {simpleCustomFields.map(def => {
            // §6: a real <label htmlFor> — never a bare div floating near the input.
            const inputId = `app-cf-${def.key}`
            return (
              <div key={def.key}>
                <label htmlFor={inputId} style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>{def.label}</label>
                <CustomFieldInput id={inputId} def={def} value={customFieldValues[def.key]} onChange={v => setCustomField(def.key, v)} />
              </div>
            )
          })}
        </div>
      )}
      {textCustomFields.map(def => (
        <div key={def.key} style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>{def.label}</div>
          <RichTextEditor value={String(customFieldValues[def.key] ?? '')} onChange={v => setCustomField(def.key, v)} minHeight={80} />
        </div>
      ))}
    </div>
  )
}
