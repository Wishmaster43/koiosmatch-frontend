/**
 * MemorySettings — free-text notes the AI keeps in mind (stored as `memory_notes`).
 * Migrated to the settings kit: the scaffold owns the header + dirty-aware save.
 */
import { useTranslation } from 'react-i18next'
import { useSettingsForm } from '../lib/useSettingsForm'
import { SettingsScaffold, TextareaField } from '../components/SettingsKit'

export default function MemorySettings() {
  const { t } = useTranslation('settings')
  const form = useSettingsForm({ memory_notes: '' })

  return (
    <SettingsScaffold title={t('memory.title')} subtitle={t('memory.subtitle')} maxWidth={640} form={form}>
      <TextareaField value={form.values.memory_notes}
        onChange={v => form.set('memory_notes', v)}
        placeholder={t('memory.placeholder')} />
    </SettingsScaffold>
  )
}
