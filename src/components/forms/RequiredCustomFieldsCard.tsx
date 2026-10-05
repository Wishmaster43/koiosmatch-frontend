/**
 * RequiredCustomFieldsCard — ONIX N-005: a create modal (candidate, location,
 * department, contact) renders the entity's REQUIRED tenant custom fields so a
 * server-side 422 on `custom_fields.<key>` can no longer fail with no visible
 * cause. Renders only the defs the backend actually refuses today
 * (`required_always || required_for.length > 0`); returns null — the card
 * disappears entirely — when none are required, mirroring the drawer's own
 * Extra-tab gate (§3A(f)). Field layout follows the create-modal canon
 * (`FieldRow`, label LEFT) rather than CustomFieldsTab's two-column grid,
 * since this card lives inside the create form, not the drill-down.
 */
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { useCustomFields } from '@/lib/useCustomFields'
import type { CustomFieldEntityType } from '@/lib/useCustomFields'
import { FieldRow } from '@/components/forms/fields'
import { CustomFieldInput } from '@/components/forms/CustomFieldInput'
import RichTextEditor from '@/components/ui/RichTextEditor'
import SectionCard from '@/components/ui/SectionCard'
import FieldNotice from '@/components/ui/FieldNotice'
import { isRequiredCustomField } from '@/components/forms/requiredCustomFields'
import { RAW_REQUIRED_RE } from '@/lib/extractApiError'

interface Props {
  entityType: CustomFieldEntityType
  values: Record<string, unknown>
  onChange: (key: string, value: unknown) => void
  // Red-border flags / server messages, keyed by the dotted 422 bag key (`custom_fields.<key>`).
  errors?: Record<string, boolean>
  messages?: Record<string, string>
  // Layout hook for the host (e.g. a grid column span) — merged into the card's own
  // style, so a host never needs a wrapper element that would render even when the
  // card renders nothing (an empty grid item still adds a row and its gap).
  style?: CSSProperties
}

export default function RequiredCustomFieldsCard({ entityType, values, onChange, errors = {}, messages = {}, style }: Props) {
  const { t } = useTranslation('common')
  const { fields } = useCustomFields(entityType)
  const required = fields.filter(isRequiredCustomField)

  // §3A(f): the card appears ONLY when ≥1 required custom field is active — a
  // tenant with none configured sees nothing different (MODULE-FACE-BEVRIES).
  if (required.length === 0) return null

  return (
    <SectionCard title={t('customFieldsCard.title')} style={{ display: 'flex', flexDirection: 'column', gap: 10, ...style }}>
      {required.map(def => {
        const bagKey = `custom_fields.${def.key}`
        const hasError = !!errors[bagKey]
        const rawMessage = messages[bagKey]
        // A raw Laravel "The X field is required." sentence is replaced by the
        // translated, named notice; any other server message passes through as-is.
        const message = hasError
          ? (!rawMessage || RAW_REQUIRED_RE.test(rawMessage) ? t('validation.fieldRequiredNamed', { field: def.label }) : rawMessage)
          : null
        return (
          <div key={def.key}>
            <FieldRow label={def.label} required>
              {def.type === 'textarea'
                // Every free-text field is rich text, never a bare textarea (§3A).
                ? <RichTextEditor value={String(values[def.key] ?? '')} onChange={v => onChange(def.key, v)} minHeight={80} />
                : <CustomFieldInput def={def} value={values[def.key]} onChange={v => onChange(def.key, v)} error={hasError} />}
            </FieldRow>
            <FieldNotice text={message} />
          </div>
        )
      })}
    </SectionCard>
  )
}
