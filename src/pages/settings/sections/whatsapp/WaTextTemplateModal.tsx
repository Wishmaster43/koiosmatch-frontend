/**
 * WaTextTemplateModal (WA-WEB-TEMPLATES-1): create/edit form for one wa_web text template.
 * Mirrors StatusListModal (FloatingPanel + ModalFooter); the body takes named placeholders
 * through the workflow variable picker. Validation runs on Save only.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import FloatingPanel from '@/components/ui/FloatingPanel'
import ModalFooter from '@/components/ui/ModalFooter'
import Toggle from '@/components/ui/Toggle'
import FieldNotice from '@/components/ui/FieldNotice'
import { Caption, SectionTitle } from '@/components/ui/typography'
import { FieldRow, TextField, SelectField } from '@/components/forms/fields'
import { TextFieldWithVars } from '@/components/layout/workflow/VariablePicker'
import { languageDisplayName } from '@/lib/languageNames'
import { SHIPPED_LOCALES } from '@/i18n/shippedLocales'
import type { WhatsappTextTemplate, WhatsappTextTemplateInput } from '@/components/whatsappWeb/whatsappTextTemplatesApi'
import type { WorkflowField } from '@/types/workflow'

// The body field descriptor handed to the shared variable-picker textarea.
const BODY_FIELD: WorkflowField = { key: 'body', type: 'textarea' }
// BE StoreWhatsappTextTemplateRequest: body max 4096 (checked here first so the user reads our sentence, not Laravel's).
const BODY_MAX = 4096

export default function WaTextTemplateModal({ editing, placeholders, onSave, onClose }: {
  editing: WhatsappTextTemplate | null
  // Placeholder names supplied by the BE list answer (never hardcoded here).
  placeholders: string[]
  onSave: (input: WhatsappTextTemplateInput) => Promise<void>
  onClose: () => void
}) {
  const { t, i18n } = useTranslation('settings')
  const [name, setName] = useState(editing?.name ?? '')
  const [language, setLanguage] = useState(editing?.language ?? i18n.language.slice(0, 2))
  const [body, setBody] = useState(editing?.body ?? '')
  const [isActive, setIsActive] = useState(editing?.is_active ?? true)
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)

  // One variable group built only from the BE-supplied names.
  const variables = [{ nodeId: 'placeholders', moduleType: 'whatsapp_text_template', hasRun: true, customName: t('waTextTemplates.placeholdersGroup'),
    fields: placeholders.map(p => ({ token: `{{${p}}}`, label: p })) }]
  const languageOptions = SHIPPED_LOCALES.map(code => ({ value: code, label: languageDisplayName(code, i18n.language) }))
  const nameMissing = submitted && !name.trim()
  const bodyMissing = submitted && !body.trim()
  const languageMissing = submitted && !language
  const bodyTooLong = body.length > BODY_MAX

  // Validates, then hands the input to the screen; closes once the save resolved.
  const submit = async () => {
    setSubmitted(true)
    if (!name.trim() || !body.trim() || bodyTooLong || !language) return
    setSaving(true)
    try {
      await onSave({ name: name.trim(), body, language, is_active: isActive })
      onClose()
    } catch {
      // The screen already toasted the failure; the form stays open for a retry.
    } finally {
      setSaving(false)
    }
  }

  const title = editing ? t('waTextTemplates.editTitle') : t('waTextTemplates.createTitle')
  return (
    <FloatingPanel open onClose={onClose} ariaLabel={title}
      header={<SectionTitle as="div" style={{ flex: 1 }}>{title}</SectionTitle>}
      persistKey="wa-text-template" resizable scrollBody={false} width={520}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <FieldRow label={t('waTextTemplates.name')} required>
          <TextField value={name} onChange={setName} error={nameMissing} />
        </FieldRow>
        <FieldNotice text={nameMissing ? t('waTextTemplates.nameRequired') : null} />
        {/* DROPDOWN-CLEAR-1: the language picker clears like every form field; an empty value is refused on Save, never persisted. */}
        <FieldRow label={t('waTextTemplates.language')} required>
          <SelectField value={language} onChange={setLanguage} options={languageOptions} />
        </FieldRow>
        <FieldNotice text={languageMissing ? t('waTextTemplates.languageRequired') : null} />
        <FieldRow label={t('waTextTemplates.body')} required>
          <TextFieldWithVars field={{ ...BODY_FIELD, label: t('waTextTemplates.body') }} value={body}
            onChange={(_k, v) => setBody(String(v ?? ''))} variables={variables} multiline insertMode="token" />
        </FieldRow>
        <Caption as="div">{t('waTextTemplates.placeholdersHint')}</Caption>
        <FieldNotice text={bodyMissing ? t('waTextTemplates.bodyRequired') : bodyTooLong ? t('waTextTemplates.bodyTooLong') : null} />
        <FieldRow label={t('waTextTemplates.active')}>
          <Toggle checked={isActive} onChange={setIsActive} ariaLabel={t('waTextTemplates.toggleActive')} />
        </FieldRow>
      </div>
      <ModalFooter onCancel={onClose} onSubmit={submit} disabled={saving} busy={saving}
        cancelLabel={t('common.cancel')} submitLabel={t('waTextTemplates.save')} />
    </FloatingPanel>
  )
}
