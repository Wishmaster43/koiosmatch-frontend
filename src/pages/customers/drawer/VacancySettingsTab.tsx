/**
 * VacancySettingsTab — the three vacancy/sourcing visibility flags (hide company
 * name / show in "my vacancies" / exclude from sourcing), split out of the
 * Overview tab into their own tab (Danny 27-07: "logischer een apart tabje
 * toch?"). Each toggle applies immediately via `onSave` (the same optimistic
 * PATCH path OverviewTab already used for these keys — nothing about what gets
 * persisted changed, only where the control lives).
 *
 * Tenant defaults (Settings → Klanten → Vacature-zichtbaarheid, same `/settings`
 * blob as every other tenant setting) are read here purely for COMPARISON: the
 * customer record stores a plain boolean, not a tri-state "unset/follows
 * default", so there is no real inheritance to render. Instead every row shows
 * the tenant default next to the toggle and, once the customer's value differs
 * from it, offers a one-click "follow the default again" reset — the honest
 * approximation of the inheritance Danny asked for.
 */
import { useTranslation } from 'react-i18next'
import { RotateCcw } from 'lucide-react'
import { CheckboxField } from '@/components/forms/fields'
import EditableFieldTable from '@/components/forms/EditableFieldTable'
import { useAllSettings, getBoolSetting } from '@/lib/settings/useAllSettings'
import type { Customer } from '@/types/customer'

// Customer field → tenant-default settings key. Mirrors settings/schemas/
// customerVacancyDefaults.js (kept as a small local constant, not a cross-page
// import, per §2 — pages/customers never reaches into pages/settings internals).
const FIELDS = [
  { key: 'hideCompanyName', settingKey: 'customer_default_hide_company_name', fallback: false },
  { key: 'showInVacancies', settingKey: 'customer_default_show_in_vacancies', fallback: true },
  { key: 'excludeFromSourcing', settingKey: 'customer_default_exclude_from_sourcing', fallback: false },
] as const

interface Props { c: Customer; onSave?: (values: Record<string, unknown>) => void }

export default function VacancySettingsTab({ c, onSave }: Props) {
  const { t } = useTranslation('customers')
  const settings = useAllSettings()
  const values = c as unknown as Record<string, unknown>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
          {t('vacancySettings.title')}
        </span>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>{t('vacancySettings.subtitle')}</p>
      </div>

      {/* The privacy-policy link belongs with the career-site settings, not on the
          company tab (Danny 28-07). It is the URL an applicant is shown. */}
      <EditableFieldTable
        title={t('overview.online')}
        fields={[{ key: 'privacyPolicyUrl', label: t('overview.privacyPolicyUrl') }]}
        value={values}
        onSave={onSave}
      />

      <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        {FIELDS.map((f, i) => {
          const current = Boolean(values[f.key])
          const tenantDefault = getBoolSetting(settings, f.settingKey, f.fallback)
          const followsDefault = current === tenantDefault
          return (
            <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
              borderBottom: i < FIELDS.length - 1 ? '1px solid var(--border)' : 'none', background: 'var(--surface)' }}>
              <CheckboxField checked={current} onChange={v => onSave?.({ [f.key]: v })} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: 'var(--text)' }}>{t(`vacancySettings.fields.${f.key}`)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {t('vacancySettings.tenantDefault', { value: tenantDefault ? t('vacancySettings.on') : t('vacancySettings.off') })}
                  {' · '}
                  {followsDefault ? t('vacancySettings.followsDefault') : t('vacancySettings.deviates')}
                </div>
              </div>
              {!followsDefault && (
                <button onClick={() => onSave?.({ [f.key]: tenantDefault })} title={t('vacancySettings.resetToDefault')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 26, padding: '0 10px', flexShrink: 0,
                    fontSize: 11.5, fontWeight: 500, borderRadius: 6, cursor: 'pointer', color: 'var(--color-primary)',
                    background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--color-primary) 30%, transparent)' }}>
                  <RotateCcw size={12} /> {t('vacancySettings.resetToDefault')}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
