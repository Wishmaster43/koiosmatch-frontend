import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'
import { resolveGenericLookupIcon } from './lookupIcons'
import { useAllSettings, saveSettingsKeys, invalidateAllSettingsCache, getNumberSetting } from '@/lib/settings/useAllSettings'
import { notifyError } from '@/lib/notify'

// Curated contact-channel icon subset (mirrors DocumentTypesSettings' own bespoke
// iconPicker) — a narrower slice of the generic lookupIcons set, scoped to the
// channels this lookup actually represents (Email/Phone/WhatsApp/…).
const CONTACT_CHANNEL_ICON_NAMES = ['mail', 'phone', 'smartphone', 'message-circle', 'message-square', 'video']

// Tenant-setting key — the generic /settings key/value store (no dedicated column,
// SettingController::store accepts any string key up to 10000 chars, no whitelist —
// verified against koiosmatch-api). Consumed by the backend `candidates:no-contact-due`
// command (DispatchNoContactDueEvents::SETTING_KEY) to decide how many days without a
// last_contact_at stamp before a candidate fires the `candidate.no_contact` automation
// event (workflows + webhooks). Same commit-on-blur / optimistic / revert-on-failure
// pattern as the Koios conversation-memory field (WhatsAppLog.tsx).
export const NO_CONTACT_DAYS_KEY = 'candidate_no_contact_days'
const NO_CONTACT_DAYS_DEFAULT = 90
const NO_CONTACT_DAYS_MIN = 1
const NO_CONTACT_DAYS_MAX = 365

// How many days without a recorded last contact before a candidate counts as
// "not contacted" for automation. Commits on blur (not per keystroke), optimistic
// with revert-on-failure.
function NoContactDaysField() {
  const { t } = useTranslation('settings')
  const settings = useAllSettings()
  const saved = getNumberSetting(settings, NO_CONTACT_DAYS_KEY, NO_CONTACT_DAYS_DEFAULT)
  const [value, setValue] = useState(saved)

  // Persist one clamped value — optimistic, revert + toast on failure (house pattern).
  const commit = async (raw) => {
    const clamped = Math.min(NO_CONTACT_DAYS_MAX, Math.max(NO_CONTACT_DAYS_MIN, Number(raw) || NO_CONTACT_DAYS_DEFAULT))
    if (clamped === saved) { setValue(clamped); return }
    setValue(clamped)
    try {
      await saveSettingsKeys({ [NO_CONTACT_DAYS_KEY]: clamped })
      invalidateAllSettingsCache()
    } catch {
      setValue(saved)
      notifyError(t('lastContactTypes.noContactDaysSaveFailed'))
    }
  }

  return (
    <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{t('lastContactTypes.noContactDaysTitle')}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, maxWidth: 460 }}>{t('lastContactTypes.noContactDaysHint')}</div>
      <label htmlFor="candidate-no-contact-days" style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
        {t('lastContactTypes.noContactDaysLabel')}
      </label>
      <input id="candidate-no-contact-days" type="number" min={NO_CONTACT_DAYS_MIN} max={NO_CONTACT_DAYS_MAX}
        value={value}
        onChange={e => setValue(Number(e.target.value))}
        onBlur={e => commit(Number(e.target.value))}
        style={{ width: 100, height: 32, padding: '0 8px', borderRadius: 6, border: '1px solid var(--border)',
          background: 'var(--surface)', color: 'var(--text)', fontSize: 12 }} />
    </div>
  )
}

/** Last-contact types — the channel of the last contact (Email/Phone/WhatsApp).
 * Tenant-maintainable lookup, backed by /last-contact-types (C-21). Feeds the
 * candidate `last_contact_type` field + the list column. Backend `last_contact_types`
 * carries a colour column too, so the editor now shows colour like every other lookup.
 * Also carries the tenant-wide no-contact reminder window (NoContactDaysField above) —
 * same screen a recruiter already visits to configure "how contact is tracked". */
export function LastContactTypesSettings() {
  const { t } = useTranslation('settings')
  return (
    <div style={{ maxWidth: 640 }}>
      <NoContactDaysField />
      <StatusListEditor
        title={t('lastContactTypes.title')} subtitle={t('lastContactTypes.subtitle')}
        endpoint="/last-contact-types" addLabel={t('lastContactTypes.add')}
        iconPicker={{ icons: CONTACT_CHANNEL_ICON_NAMES, resolve: resolveGenericLookupIcon }} />
    </div>
  )
}

// Note types moved to their own per-entity settings group (NOTE-TYPES-2/3, Danny
// "ieder zijn eigen" 2026-07-20) — see ./NoteTypesSettings.jsx + registry.jsx's
// `note_types` group, one sub-tab per backend NoteType::ENTITIES value.
