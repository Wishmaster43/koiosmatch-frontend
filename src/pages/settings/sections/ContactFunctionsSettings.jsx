import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'
import { SettingCard, SettingRow, Toggle } from '../components/SettingsKit'
import { useAllSettings, getBoolSetting, saveSettingsKeys } from '@/lib/settings/useAllSettings'
import { useConfirm } from '@/hooks/useConfirm'

/**
 * ContactFunctionsSettings — the contact-person job-title list (/contact-functions,
 * FUNCTIONS-SPLIT-1) + the free-entry toggle (Danny 24-07: "ook voor deze het blok
 * vrije invoer toestaan"). Mirrors FunctionsSettings: the toggle persists
 * `contact_functions_allow_free_entry`; useContactFunctions reads the same chain
 * (Settings toggle → API flag → creatable default). The toggle default mirrors the
 * ENFORCED default (true/creatable here) so it never lies about behaviour.
 */
export default function ContactFunctionsSettings() {
  const { t } = useTranslation('settings')
  const settings = useAllSettings()
  const freeEntry = getBoolSetting(settings, 'contact_functions_allow_free_entry', true)
  const [busy, setBusy] = useState(false)
  const { confirm, dialog } = useConfirm()

  // Persist the mode; confirm before loosening to free-text (data-quality choice).
  const onToggle = (next) => {
    if (busy) return
    const persist = async () => {
      setBusy(true)
      try { await saveSettingsKeys({ contact_functions_allow_free_entry: next }) } finally { setBusy(false) }
    }
    if (next) confirm(t('contactFunctionsSettings.confirmFreeEntry'), persist)
    else persist()
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <SettingCard>
        <SettingRow label={t('contactFunctionsSettings.freeEntry')} description={t('contactFunctionsSettings.freeEntryHint')}>
          <Toggle checked={freeEntry} onChange={onToggle} />
        </SettingRow>
      </SettingCard>

      <div style={{ marginTop: 20 }}>
        <StatusListEditor
          title={t('contactFunctionsSettings.title')}
          subtitle={t('contactFunctionsSettings.subtitle')}
          endpoint="/contact-functions"
          addLabel={t('contactFunctionsSettings.add')}
          withColor={false}
          notFoundNotice={t('contactFunctionsSettings.notAvailable')}
        />
      </div>
      {dialog}
    </div>
  )
}
