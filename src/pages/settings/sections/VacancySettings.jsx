import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Save } from 'lucide-react'
import SelectMenu from '@/components/ui/SelectMenu'
import { useAllSettings, getJsonSetting, saveSettingsKeys } from '@/lib/settings/useAllSettings'
import StatusListEditor from './StatusListEditor'

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
      <button onClick={save}
        style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px', fontSize: 13, fontWeight: 500,
          borderRadius: 8, border: 'none', cursor: 'pointer', background: ok ? 'var(--color-success)' : 'var(--color-primary)', color: 'white' }}>
        {ok ? <><Check size={13} /> {t('common.saved')}</> : <><Save size={13} /> {t('common.save')}</>}
      </button>
    </div>
  )
}

/** Vacancy statuses — backend /vacancy-statuses (name + colour), own sub-tab. */
export function VacancyStatusSettings() {
  const { t } = useTranslation('settings')
  return (
    <div style={{ maxWidth: 640 }}>
      <StatusListEditor compact withColor title={t('vacancy.title')} subtitle={t('vacancy.subtitle')}
        endpoint="/vacancy-statuses" addLabel={t('vacancy.add')} />
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

/** Seniority levels — lookup, backend /vacancy-seniority-levels. */
export function VacancySenioritySettings() {
  const { t } = useTranslation('settings')
  return (
    <div style={{ maxWidth: 640 }}>
      <StatusListEditor compact withColor title={t('vacancy.seniorityTitle')} subtitle={t('vacancy.senioritySubtitle')}
        endpoint="/vacancy-seniority-levels" addLabel={t('vacancy.seniorityAdd')} />
    </div>
  )
}

/** Education levels — lookup, backend /vacancy-education-levels. */
export function VacancyEducationSettings() {
  const { t } = useTranslation('settings')
  return (
    <div style={{ maxWidth: 640 }}>
      <StatusListEditor compact withColor title={t('vacancy.educationTitle')} subtitle={t('vacancy.educationSubtitle')}
        endpoint="/vacancy-education-levels" addLabel={t('vacancy.educationAdd')} />
    </div>
  )
}

/** Job boards — tenant publish channels, backend /vacancy-channels (name only). */
export function VacancyChannelSettings() {
  const { t } = useTranslation('settings')
  return (
    <div style={{ maxWidth: 640 }}>
      <StatusListEditor compact withColor={false} title={t('vacancy.channelsTitle')} subtitle={t('vacancy.channelsSubtitle')}
        endpoint="/vacancy-channels" addLabel={t('vacancy.channelsAdd')} />
    </div>
  )
}

// Vacancy custom fields moved to the shared "Eigen velden" settings group
// (§3B custom-fields wave, 2026-07-14) — one CRUD implementation for every entity
// instead of a per-entity fork. See settings/sections/CustomFieldsSettings.jsx
// (rendered for entityType="vacancy" via registry.jsx's custom_fields group).
