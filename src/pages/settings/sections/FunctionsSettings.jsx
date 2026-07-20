import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'
import { SettingCard, SettingRow, Toggle } from '../components/SettingsKit'
import { useAllSettings, getBoolSetting, saveSettingsKeys } from '@/lib/settings/useAllSettings'
import { useConfirm } from '@/hooks/useConfirm'

/**
 * FunctionsSettings — the tenant job-function list (/functions) plus the field-mode
 * toggle (creatable combobox ↔ strict dropdown), stored as the tenant setting
 * `functions_allow_free_entry`. Turning free-entry ON (strict → free) asks for
 * confirmation; turning it OFF (free → strict) lets the backend fold every used
 * function into the list so nothing is lost.
 */
export default function FunctionsSettings() {
  const { t } = useTranslation('settings')
  const settings = useAllSettings()
  // Strict by default (Danny 2026-07-16, job 26): checked really does mean "allowed"
  // here (Toggle checked={freeEntry}, label "Vrije invoer toestaan") — the bug was the
  // FALLBACK shown before any tenant explicitly saves this setting. It defaulted to
  // `true` (shows checked/allowed) while useFunctions() — and the backend's own
  // GET /functions.allow_free_entry — both default to `false` (strict), so a
  // never-configured tenant saw a checked toggle that lied about the actually
  // enforced (strict) behaviour. Mirror useFunctions.ts's default here; never touches
  // an already-persisted tenant value (getBoolSetting only falls back when unset).
  const freeEntry = getBoolSetting(settings, 'functions_allow_free_entry', false)
  const [busy, setBusy] = useState(false)
  const { confirm, dialog } = useConfirm()

  // Persist the mode; confirm before loosening to free-text (data-quality choice).
  const onToggle = (next) => {
    if (busy) return
    const persist = async () => {
      setBusy(true)
      try { await saveSettingsKeys({ functions_allow_free_entry: next }) } finally { setBusy(false) }
    }
    if (next) confirm(t('functionsSettings.confirmFreeEntry'), persist)
    else persist()
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <SettingCard>
        <SettingRow label={t('functionsSettings.freeEntry')} description={t('functionsSettings.freeEntryHint')}>
          <Toggle checked={freeEntry} onChange={onToggle} />
        </SettingRow>
      </SettingCard>

      <div style={{ marginTop: 20 }}>
        <StatusListEditor
          title={t('functionsSettings.title')}
          subtitle={t('functionsSettings.subtitle')}
          endpoint="/functions"
          addLabel={t('functionsSettings.add')}
          withColor={false}
        />
      </div>
      {dialog}
    </div>
  )
}
