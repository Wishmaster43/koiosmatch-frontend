import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'
// B8: the shared always-visible checkbox list — a hand-rolled `<label><input
// type="checkbox">` row per field is a finding (§0, "ALTIJD een zoekbare
// dropdown … óók een lijst van drie opties"); OpenCheckGroup is the ONE
// component for a small fixed vocabulary.
import OpenCheckGroup from '@/components/reports/filter/OpenCheckGroup'
import { resolveGenericLookupIcon } from './lookupIcons'
import { useAllSettings, saveSettingsKeys, invalidateAllSettingsCache, getNumberSetting, getJsonSetting } from '@/lib/settings/useAllSettings'
import { notifyError } from '@/lib/notify'

// Tenant-setting key — the duplicate-detection field set (v1: email/mobile/phone).
// Consumed TODAY by the backend DuplicateFinder (dedupeKeys(), default ['email','mobile'])
// for the live check-duplicate endpoint and the create 409 guard.
export const DEDUPE_KEYS_KEY = 'candidate_dedupe_keys'
const DEDUPE_KEYS_DEFAULT = ['email', 'mobile']
const DEDUPE_FIELDS = ['email', 'mobile', 'phone']

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

// Which fields count as a duplicate match on candidate create (email/mobile/phone).
// Checkbox toggle per field, optimistic with revert-on-failure (house pattern), stored
// as a JSON array so DuplicateFinder::dedupeKeys() can json_decode it directly.
function DedupeKeysField() {
  const { t } = useTranslation('settings')
  const settings = useAllSettings()
  const saved = getJsonSetting(settings, DEDUPE_KEYS_KEY, DEDUPE_KEYS_DEFAULT)
  const [keys, setKeys] = useState(saved)
  // Cold-cache sync: useAllSettings resolves async, so the initial state can be the
  // seed default while the tenant's stored value arrives a render later (control
  // round). Re-seed from the store until the user actually toggles.
  const touchedRef = useRef(false)
  useEffect(() => { if (!touchedRef.current) setKeys(saved) }, [JSON.stringify(saved)])

  // Toggle one field in the set and persist the full array — optimistic, revert on failure.
  const toggle = async (field) => {
    touchedRef.current = true
    const previous = keys
    const next = keys.includes(field) ? keys.filter(k => k !== field) : [...keys, field]
    // Never persist an empty set: the BE treats '[]' as falsy and silently falls
    // back to email+mobile (DuplicateFinder.php:66-68) — an unchecked-everything UI
    // claiming 'no dedupe' would lie (§3). At least one field stays required.
    if (next.length === 0) { notifyError(t('lastContactTypes.dedupeKeysMinOne')); return }
    setKeys(next)
    try {
      await saveSettingsKeys({ [DEDUPE_KEYS_KEY]: next })
      invalidateAllSettingsCache()
    } catch {
      setKeys(previous)
      notifyError(t('lastContactTypes.dedupeKeysSaveFailed'))
    }
  }

  return (
    <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{t('lastContactTypes.dedupeKeysTitle')}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, maxWidth: 460 }}>{t('lastContactTypes.dedupeKeysHint')}</div>
      <div style={{ maxWidth: 220 }}>
        <OpenCheckGroup group={{
          key: 'dedupeKeys',
          options: DEDUPE_FIELDS.map(field => ({ value: field, label: t(`lastContactTypes.dedupeKeys.${field}`) })),
          selected: keys,
          onToggle: toggle,
        }} />
      </div>
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
      <DedupeKeysField />
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
