// CandidateCommSettings — Settings pieces for how candidate contact is tracked:
// the duplicate-detection field set, the no-contact reminder window, and the
// tenant-maintainable last-contact-type lookup (LastContactTypesSettings).
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'
// Danny 07-09 (last-contact screen): "geen checkboxen maar toggles" — each dedupe
// field is a Toggle atom with its title above the switch, never a checkbox list.
import Toggle from '@/components/ui/Toggle'
import { resolveGenericLookupIcon } from './lookupIcons'
import { useAllSettings, saveSettingsKeys, invalidateAllSettingsCache, getJsonSetting } from '@/lib/settings/useAllSettings'
import { notifyError } from '@/lib/notify'
import { SectionTitle } from '@/components/ui/typography'
import NumberSettingField from '../components/NumberSettingField'
import SettingsLoadBanner from '../components/SettingsLoadBanner'

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
  // Deliberately keyed on the stringified snapshot, not the `saved` array reference
  // (getJsonSetting returns a fresh array every render, so depending on `saved`
  // itself would re-fire this effect on every render and fight the guard above).
  // eslint-disable-next-line react-hooks/exhaustive-deps -- see comment above
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
      <SectionTitle as="div" style={{ marginBottom: 4 }}>{t('lastContactTypes.dedupeKeysTitle')}</SectionTitle>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, maxWidth: 460 }}>{t('lastContactTypes.dedupeKeysHint')}</div>
      {/* One block per field: the field name ABOVE its own switch (Danny 07-09). */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-6)' }}>
        {DEDUPE_FIELDS.map(field => (
          <div key={field} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text)' }}>{t(`lastContactTypes.dedupeKeys.${field}`)}</span>
            <Toggle checked={keys.includes(field)} onChange={() => toggle(field)} ariaLabel={t(`lastContactTypes.dedupeKeys.${field}`)} />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Last-contact types — the channel of the last contact (Email/Phone/WhatsApp).
 * Tenant-maintainable lookup, backed by /last-contact-types (C-21). Feeds the
 * candidate `last_contact_type` field + the list column. Backend `last_contact_types`
 * carries a colour column too, so the editor now shows colour like every other lookup.
 * Also carries the tenant-wide no-contact reminder window (the shared NumberSettingField
 * below) — same screen a recruiter already visits to configure "how contact is tracked". */
export function LastContactTypesSettings() {
  const { t } = useTranslation('settings')
  return (
    <div style={{ maxWidth: 640 }}>
      <SettingsLoadBanner />
      <NumberSettingField id="candidate-no-contact-days" settingsKey={NO_CONTACT_DAYS_KEY}
        title={t('lastContactTypes.noContactDaysTitle')} hint={t('lastContactTypes.noContactDaysHint')}
        label={t('lastContactTypes.noContactDaysLabel')} saveFailedMessage={t('lastContactTypes.noContactDaysSaveFailed')}
        defaultValue={NO_CONTACT_DAYS_DEFAULT} min={NO_CONTACT_DAYS_MIN} max={NO_CONTACT_DAYS_MAX} />
      <DedupeKeysField />
      <StatusListEditor
        title={t('lastContactTypes.title')} subtitle={t('lastContactTypes.subtitle')}
        endpoint="/last-contact-types" addLabel={t('lastContactTypes.add')}
        withValueSlug withColor
        iconPicker={{ icons: CONTACT_CHANNEL_ICON_NAMES, resolve: resolveGenericLookupIcon }} />
    </div>
  )
}

// Note types moved to their own per-entity settings group (NOTE-TYPES-2/3, Danny
// "ieder zijn eigen" — "each its own" — 2026-07-20) — see ./NoteTypesSettings.jsx + registry.jsx's
// `note_types` group, one sub-tab per backend NoteType::ENTITIES value.
