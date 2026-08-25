// VacancySettings — the vacancy-feature Settings sub-tabs: the tenant default
// application-field settings a new vacancy inherits, plus the tenant-maintainable
// status/phase/seniority/education/channel lookups (each via StatusListEditor).
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Save } from 'lucide-react'
import SelectMenu from '@/components/ui/SelectMenu'
import { useAllSettings, getJsonSetting, saveSettingsKeys } from '@/lib/settings/useAllSettings'
import StatusListEditor from './StatusListEditor'
import { resolveGenericLookupIcon } from './lookupIcons'
import SaveButton from '@/components/ui/SaveButton'

// Curated icon subset for job boards — channels are web portals/career listings,
// so scope the picker to web/portal-ish glyphs instead of the full generic set
// (mirrors TaskSettings' TASK_TYPE_ICON_NAMES curation).
const VACANCY_CHANNEL_ICON_NAMES = ['globe', 'briefcase', 'building', 'star', 'smartphone', 'mail']

// Tenant default application settings — the fields + their 3-state values.
const APP_FIELDS = ['cv', 'cover_letter', 'photo', 'remarks', 'interview_consent']
const DEFAULT_APP_SETTINGS = { cv: 'required', cover_letter: 'optional', photo: 'optional', remarks: 'optional', interview_consent: 'hidden' }
const VACANCY_APP_DEFAULTS_KEY = 'vacancy_default_application_settings'

/** Application settings — the tenant default a new vacancy inherits (cv required, …). */
export function VacancyApplicationDefaultsSettings() {
  const { t } = useTranslation('settings')
  const settings = useAllSettings()
  const saved = getJsonSetting(settings, VACANCY_APP_DEFAULTS_KEY, DEFAULT_APP_SETTINGS)
  const [draft, setDraft] = useState(saved)
  // Re-seed when the settings blob arrives/changes (adjust state during render).
  const [prev, setPrev] = useState(JSON.stringify(saved))
  const key = JSON.stringify(saved)
  if (key !== prev) { setPrev(key); setDraft(saved) }
  const [ok, setOk] = useState(false)

  const setField = (f, val) => setDraft(d => ({ ...d, [f]: val }))
  const save = async () => { await saveSettingsKeys({ [VACANCY_APP_DEFAULTS_KEY]: draft }); setOk(true); setTimeout(() => setOk(false), 1500) }

  const valueOptions = ['required', 'optional', 'hidden'].map(v => ({ value: v, label: t(`vacancies:publishing.values.${v}`) }))

  return (
    <div style={{ maxWidth: 640 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{t('vacancy.appDefaultsTitle')}</h3>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>{t('vacancy.appDefaultsSubtitle')}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {APP_FIELDS.map(f => (
          <div key={f} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--text)' }}>{t(`vacancies:publishing.fields.${f}`)}</span>
            <div style={{ width: 160 }}>
              <SelectMenu value={draft[f] ?? 'optional'} options={valueOptions} onChange={val => setField(f, val)} menuWidth={160} />
            </div>
          </div>
        ))}
      </div>
      {/* SaveButton — the ONE saved-state save action (§4 success token pair). */}
      <SaveButton saved={ok} onClick={save}>
        {ok ? <><Check size={13} /> {t('common.saved')}</> : <><Save size={13} /> {t('common.save')}</>}
      </SaveButton>
    </div>
  )
}

/**
 * Vacancy statuses — backend /vacancy-statuses (name + colour), own sub-tab.
 * VACSTATUS-OPEN-1 (C.5, round-4 audit finding #1): `is_open`/`is_closed` are the
 * semantic flags the intake gate binds on (VacancyStatusController::lookupExtraRules,
 * both `sometimes|boolean`) — wired here as flagFields (checkbox + row badge), same
 * shape as CustomerPhasesSettings' `is_customer` flagField, even though the backend
 * also enforces both as a HasSingletonFlag singleton: the model clears the losing
 * row server-side on every save, so the truth is always correct after a refresh.
 * `is_default` (VACSTATUS-DEFAULT-1) reuses the same DefaultToggle singleton pill
 * as seniority/education above.
 */
export function VacancyStatusSettings() {
  const { t } = useTranslation('settings')
  return (
    <div style={{ maxWidth: 640 }}>
      <StatusListEditor compact withColor title={t('vacancy.title')} subtitle={t('vacancy.subtitle')}
        endpoint="/vacancy-statuses" addLabel={t('vacancy.add')}
        flagFields={[
          { key: 'is_open', label: t('vacancy.flagOpen'), description: t('vacancy.flagOpenDesc') },
          { key: 'is_closed', label: t('vacancy.flagClosed'), description: t('vacancy.flagClosedDesc') },
        ]}
        defaultField={{ key: 'is_default' }} />
    </div>
  )
}

/** Vacancy phases — backend /vacancy-phases (name + colour + sort_order), own sub-tab. */
export function VacancyPhaseSettings() {
  const { t } = useTranslation('settings')
  return (
    <div style={{ maxWidth: 640 }}>
      <StatusListEditor compact withColor title={t('vacancy.phasesTitle')} subtitle={t('vacancy.phasesSubtitle')}
        endpoint="/vacancy-phases" addLabel={t('vacancy.phasesAdd')} />
    </div>
  )
}

/**
 * Seniority levels — lookup, backend /vacancy-seniority-levels.
 * `is_default` (DEFAULTS-1/V11) is a backend-enforced singleton (HasSingletonFlag,
 * whitelisted in VacancySeniorityLevelController::lookupExtraRules) — the shared
 * DefaultToggle promotes one row and clears the rest. Consumed by
 * VacancyLookupsContext.defaultSeniority → the drawer's Eisen proposal.
 */
export function VacancySenioritySettings() {
  const { t } = useTranslation('settings')
  return (
    <div style={{ maxWidth: 640 }}>
      <StatusListEditor compact withColor title={t('vacancy.seniorityTitle')} subtitle={t('vacancy.senioritySubtitle')}
        endpoint="/vacancy-seniority-levels" addLabel={t('vacancy.seniorityAdd')}
        defaultField={{ key: 'is_default' }} />
    </div>
  )
}

/**
 * Education levels — lookup, backend /vacancy-education-levels.
 * Same backend-enforced `is_default` singleton as seniority (DEFAULTS-1/V19);
 * consumed by VacancyLookupsContext.defaultEducation.
 */
export function VacancyEducationSettings() {
  const { t } = useTranslation('settings')
  return (
    <div style={{ maxWidth: 640 }}>
      <StatusListEditor compact withColor title={t('vacancy.educationTitle')} subtitle={t('vacancy.educationSubtitle')}
        endpoint="/vacancy-education-levels" addLabel={t('vacancy.educationAdd')}
        defaultField={{ key: 'is_default' }} />
    </div>
  )
}

/**
 * Job boards — tenant publish channels, backend /vacancy-channels (round-4 audit
 * finding #2). The 2026-06-15 create_vacancy_table migration DOES carry a `color`
 * column on vacancy_channels (nullable, default swatch grey) — `withColor={false}`
 * was stale, dropping a field the backend already persists. `active` and
 * `default_enabled` (VacancyChannelController::lookupExtraRules, both
 * `sometimes|boolean`) are wired as flagFields, NOT defaultField: the migration's
 * own comment marks `default_enabled` explicitly "multi — no singleton" (several
 * job boards can each be pre-checked) and the model carries no HasSingletonFlag,
 * so StatusListEditor's DefaultToggle (which optimistically clears every sibling
 * row locally) would misrepresent it as a single-select — flagFields' independent
 * checkbox+badge is the correct shape (mirrors OpportunityLookupsSettings' is_won/
 * is_lost: "never a DefaultToggle-style singleton").
 */
export function VacancyChannelSettings() {
  const { t } = useTranslation('settings')
  return (
    <div style={{ maxWidth: 640 }}>
      <StatusListEditor compact withColor title={t('vacancy.channelsTitle')} subtitle={t('vacancy.channelsSubtitle')}
        endpoint="/vacancy-channels" addLabel={t('vacancy.channelsAdd')}
        iconPicker={{ icons: VACANCY_CHANNEL_ICON_NAMES, resolve: resolveGenericLookupIcon }}
        flagFields={[
          { key: 'active', label: t('vacancy.channelActive'), description: t('vacancy.channelActiveDesc') },
          { key: 'default_enabled', label: t('vacancy.channelDefaultEnabled'), description: t('vacancy.channelDefaultEnabledDesc') },
        ]} />
    </div>
  )
}

// Vacancy custom fields moved to the shared "Eigen velden" settings group
// (§3B custom-fields wave, 2026-07-14) — one CRUD implementation for every entity
// instead of a per-entity fork. See settings/sections/CustomFieldsSettings.jsx
// (rendered for entityType="vacancy" via registry.jsx's custom_fields group).
