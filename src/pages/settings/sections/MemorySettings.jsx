/**
 * MemorySettings — free-text notes the AI keeps in mind (stored as `memory_notes`).
 * Migrated to the settings kit: the scaffold owns the header + dirty-aware save.
 *
 * These are standing facts about the tenant fed to the AI as context, not a
 * conversation, so this field never opts into "Actiepunten" - it rides
 * RichTextAssistBar's own improve+summarize-only default
 * (ACTIONS-SCOPE-DEFAULT-FLIP), no per-field override needed.
 */
import { useTranslation } from 'react-i18next'
import { useSettingsForm } from '../lib/useSettingsForm'
import { SettingsScaffold } from '../components/SettingsKit'
import RichTextEditor from '@/components/ui/RichTextEditor'

export default function MemorySettings() {
  const { t } = useTranslation('settings')
  const form = useSettingsForm({ memory_notes: '' })

  return (
    <SettingsScaffold title={t('memory.title')} subtitle={t('memory.subtitle')} maxWidth={640} form={form}>
      {/* House rule (CLAUDE.md 14/7): free text = rich-text editor, never a bare textarea. */}
      {/* MEMORY-RESIZE-1: roomier default + a drag handle to grow it further. */}
      <RichTextEditor value={form.values.memory_notes}
        onChange={v => form.set('memory_notes', v)}
        minHeight={240} resizable
        placeholder={t('memory.placeholder')} />
    </SettingsScaffold>
  )
}
