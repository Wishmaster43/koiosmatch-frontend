/**
 * RetentionSettings (AVG-RET-2, Danny 22-07 punt 8) — the tenant-wide AVG/GDPR
 * retention windows: how long a candidate's data is kept before it becomes
 * eligible for erasure, split by whether they were ever placed (longer, for the
 * statutory tax/payroll retention duty) or never placed. A third window
 * (`retention_consent_months`, CandidateRetentionPolicy::KEY_CONSENT_MONTHS)
 * governs how long a granted retention-consent opt-in stays valid before it must
 * be re-confirmed — 0 is a deliberate "never expires" choice, so it is NOT
 * floored to 1 like the other two. A fourth window (`retention_contact_months`,
 * ContactRetentionPolicy::KEY_CONTACT_MONTHS) is the dormancy window after which a
 * customer contact is surfaced for review through the contact.retention_due event. These numbers are what the backend uses to
 * derive `retention_expires_at` on the candidate (CandidateDetailResource),
 * shown read-only on the Communication -> Toestemmingen tab (and the candidate
 * drill-down privacy block) — this screen is the only place that policy is
 * edited. The legacy single key `retention_candidate_months` is a backend-only
 * fallback and is deliberately never surfaced here (CMBE handoff 2026-08-13).
 */
import { useTranslation } from 'react-i18next'
import { useSettingsForm } from '../lib/useSettingsForm'
import { SettingsScaffold, SettingCardList, SettingRow, NumberField, SelectField } from '../components/SettingsKit'
import { WINDOW_UNIT_OPTIONS } from '../components/windowUnitOptions'
import CatalogSection from './CatalogSection'

// O23 UNIT-NAAST-BEDRAG-1: window-unit options translated for the SelectField shape.
function useWindowUnitOptions() {
  const { t } = useTranslation('settings')
  return WINDOW_UNIT_OPTIONS.map(o => ({ value: o.value, label: t(o.label) }))
}

// Tenant-wide AVG retention windows editor (see the module doc above): the only screen that edits the policy the backend derives retention_expires_at from.
export default function RetentionSettings() {
  const { t } = useTranslation('settings')
  // Tenant defaults per the backend policy (AVG-RET-2): 12 months for a candidate
  // never placed, 60 months for one placed at least once, 24 months for how long
  // a granted retention consent stays valid before it must be re-confirmed.
  const form = useSettingsForm({
    retention_months_never_placed: 12,
    retention_months_ever_placed: 60,
    retention_consent_months: 24,
    // settings-coherence-7 (K-247 lane C): months without activity after which a
    // customer contact is surfaced for review (contact.retention_due). The backend
    // read it (ContactRetentionPolicy::KEY_CONTACT_MONTHS, default 36, floored to 1)
    // but no screen wrote it until now.
    retention_contact_months: 36,
    // TRASH-OVERAL-2: days a pending-erase record stays in the trash before the
    // automatic hard erase (drives the "wordt rond {date}" wording app-wide).
    deletion_grace_days: 30,
    // Notification windows for retention: days before expiry to warn the recruiter,
    // and days an auto-archived dossier waits before daily escalation to the manager.
    retention_warning_days: 30,
    retention_escalation_days: 14,
    // O23 UNIT-NAAST-BEDRAG-1: the unit each of the three day-window amounts above
    // is expressed in — rendered inline right of the amount, never its own row.
    retention_warning_days_unit: 'days',
    retention_escalation_days_unit: 'days',
    deletion_grace_days_unit: 'days',
  })
  const unitOptions = useWindowUnitOptions()

  return (
    <>
    <SettingsScaffold title={t('retention.title')} subtitle={t('retention.subtitle')} maxWidth={640} form={form}>
      <SettingCardList>
        <SettingRow label={t('retention.neverPlaced.label')} description={t('retention.neverPlaced.description')}>
          <NumberField value={form.values.retention_months_never_placed}
            onChange={v => form.set('retention_months_never_placed', v)}
            min={1} max={120} unit={t('retention.unit')} />
        </SettingRow>
        <SettingRow label={t('retention.everPlaced.label')} description={t('retention.everPlaced.description')}>
          <NumberField value={form.values.retention_months_ever_placed}
            onChange={v => form.set('retention_months_ever_placed', v)}
            min={1} max={120} unit={t('retention.unit')} />
        </SettingRow>
        {/* 0 = deliberate "never expires" tenant choice (backend does not floor this
            key to 1), so the field allows 0 unlike the two windows above. */}
        <SettingRow label={t('retention.consentMonths.label')} description={t('retention.consentMonths.description')}>
          <NumberField value={form.values.retention_consent_months}
            onChange={v => form.set('retention_consent_months', v)}
            min={0} max={120} unit={t('retention.unit')} />
        </SettingRow>
        <SettingRow label={t('retention.contactMonths.label')} description={t('retention.contactMonths.description')}>
          <NumberField value={form.values.retention_contact_months}
            onChange={v => form.set('retention_contact_months', v)}
            min={1} max={120} unit={t('retention.unit')} />
        </SettingRow>
        {/* Days before retention term expires that the "due soon" notification fires;
            its unit picker sits inline right of the amount (O23 UNIT-NAAST-BEDRAG-1). */}
        <SettingRow label={t('retention.warningDays.label')} description={t('retention.warningDays.description')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <NumberField value={form.values.retention_warning_days}
              onChange={v => form.set('retention_warning_days', v)}
              min={0} max={365} />
            {/* DROPDOWN-CLEAR-1: this unit pairs with a required amount and must
                never persist empty. */}
            <SelectField value={form.values.retention_warning_days_unit}
              onChange={v => form.set('retention_warning_days_unit', v)}
              options={unitOptions} ariaLabel={t('settings.retention.retention_warning_days_unit.label')}
              clearable={false} />
          </div>
        </SettingRow>
        {/* Days an auto-archived dossier waits before daily escalation to the recruiter_manager role. */}
        <SettingRow label={t('retention.escalationDays.label')} description={t('retention.escalationDays.description')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <NumberField value={form.values.retention_escalation_days}
              onChange={v => form.set('retention_escalation_days', v)}
              min={0} max={365} />
            {/* DROPDOWN-CLEAR-1: this unit pairs with a required amount and must
                never persist empty. */}
            <SelectField value={form.values.retention_escalation_days_unit}
              onChange={v => form.set('retention_escalation_days_unit', v)}
              options={unitOptions} ariaLabel={t('settings.retention.retention_escalation_days_unit.label')}
              clearable={false} />
          </div>
        </SettingRow>
        {/* Trash grace window: amount plus its own unit picker (O23 UNIT-NAAST-BEDRAG-1). */}
        <SettingRow label={t('retention.graceDays.label')} description={t('retention.graceDays.description')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <NumberField value={form.values.deletion_grace_days}
              onChange={v => form.set('deletion_grace_days', v)}
              min={7} max={365} />
            {/* DROPDOWN-CLEAR-1: this unit pairs with a required amount and must
                never persist empty. */}
            <SelectField value={form.values.deletion_grace_days_unit}
              onChange={v => form.set('deletion_grace_days_unit', v)}
              options={unitOptions} ariaLabel={t('settings.retention.deletion_grace_days_unit.label')}
              clearable={false} />
          </div>
        </SettingRow>
      </SettingCardList>
    </SettingsScaffold>
    {/* CATALOG-EMBED-1 (Danny 13-09: "Hoort bij kandidaten"): the catalogue's
        "retention" section, candidates group (the legacy retention_candidate_months
        alias plus the after-care thank-you text) — every generic row gets a home
        under its own entity instead of a dedicated catalogue nav screen.
        F1 (Opus review 13-09): headedBy="group" reads "Kandidaten", not the section's
        own "Bewaartermijnen" — this page's OWN title already says that. */}
    <div style={{ marginTop: 24, maxWidth: 640 }}><CatalogSection section="retention" group="candidates" headedBy="group" embedded /></div>
    </>
  )
}
