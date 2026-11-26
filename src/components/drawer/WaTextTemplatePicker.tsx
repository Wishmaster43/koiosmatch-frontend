/**
 * WaTextTemplatePicker (WA-WEB-TEMPLATES-1): the text template dropdown above the wa_web
 * composer. Renders nothing when the feature is absent (404/403/empty), so the composer
 * stays calm; placeholders stay raw in the draft, the BE renders them at send time.
 */
import { useId, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { languageDisplayName } from '@/lib/languageNames'
import { useWhatsappTextTemplates } from '@/components/whatsappWeb/useWhatsappTextTemplates'

interface WaTextTemplatePickerProps {
  value: string | null
  // Writes the picked template's body into the draft.
  onPick: (body: string) => void
  onIdChange: (id: string | null) => void
}

export default function WaTextTemplatePicker({ value, onPick, onIdChange }: WaTextTemplatePickerProps) {
  const { t, i18n } = useTranslation('candidates')
  const labelId = useId()
  const { templates } = useWhatsappTextTemplates(true)
  // Only active templates are offered, labelled with name and language.
  const active = useMemo(() => templates.filter(tpl => tpl.is_active), [templates])
  const options = useMemo(() => active.map(tpl => ({
    value: tpl.id, label: `${tpl.name} · ${languageDisplayName(tpl.language, i18n.language)}`,
  })), [active, i18n.language])
  if (active.length === 0) return null

  // DROPDOWN-CLEAR-1: '' clears the pick and leaves the draft as typed.
  const handleChange = (id: string) => {
    const tpl = active.find(x => x.id === id)
    if (!id || !tpl) { onIdChange(null); return }
    onPick(tpl.body)
    onIdChange(id)
  }

  return (
    <div style={{ marginTop: 4 }}>
      {/* CreatableSelect has no aria-label prop: a visually hidden label names the trigger. */}
      <span id={labelId} className="sr-only">
        {t('conversations.textTemplateLabel')}
      </span>
      <CreatableSelect aria-labelledby={labelId} value={value ?? ''} options={options} onChange={handleChange} allowCreate={false}
        clearLabel={t('conversations.textTemplateLabel')}
        placeholder={t('conversations.textTemplatePlaceholder')} />
    </div>
  )
}
