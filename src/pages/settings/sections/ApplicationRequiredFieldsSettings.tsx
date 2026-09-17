/**
 * ApplicationRequiredFieldsSettings — Settings → Sollicitaties → Verplichte velden
 * (APP-REQUIRED-FE-1, Danny: "hoe zorg ik dat BRON bij nieuwe sollicitatie
 * verplicht is? moet bij instellingen komen" — "how do I make SOURCE required on
 * a new application? it needs to be in Settings").
 *
 * The application has no phase axis of its own here (the funnel stage is a
 * per-application picker, not a settings-facing axis) — this mirrors the
 * customer sub-entities' FLAT shape (`FlatRequiredFieldsToggleList`, already built
 * for Location/Department/Contact) rather than the candidate/customer phase
 * matrix: one toggle per field, saved whole to the flat `application_required_fields`
 * array `FlatRequiredFieldsGuard('application')` reads on `ApplicationController::store`.
 *
 * No seeded default: an absent setting means nothing extra is required — the same
 * "everything off is the honest state" rule as every other required-fields screen.
 *
 * ── FIELDS-2-FE-3 (17-09): rows now come from `GET /settings/field-inventory`
 * (VERPLICHTE-VELDEN-INVENTARIS-1, `useFieldInventory('application')`) instead of the
 * static `APPLICATION_FIELDS` array — that array only ever covered 4 of the 13 keys
 * the backend actually publishes (see requiredFieldsCatalog.ts's own doc comment).
 * Labels still come from that module, now kept as a `key -> labelKey` map only;
 * `requirable:false` rows (custom_fields / new_candidate / phase_key — never a real
 * DB column the guard can read back) render disabled with their reason, never hidden.
 */
import { useTranslation } from 'react-i18next'
import FlatRequiredFieldsToggleList from './customers/FlatRequiredFieldsToggleList'
import { APPLICATION_FIELD_LABEL_KEYS } from './applications/requiredFieldsCatalog'
import { buildInventoryRows } from '@/pages/settings/requiredFieldsReason'
import { useFieldInventory } from '@/pages/settings/hooks/useFieldInventory'
import { useSafePermission } from '@/hooks/useSafePermission'
import ErrorBanner from '@/components/ui/ErrorBanner'
import Spinner from '@/components/ui/Spinner'
import { BodyText } from '@/components/ui/typography'

const KEY = 'application_required_fields'

// Flat one-toggle-per-field required-fields screen (see the module doc above): mirrors the customer sub-entities' shape since an application has no phase axis here. The settings registry mounts sections under the app-level QueryClientProvider (App.tsx), so useFieldInventory resolves without a local provider.
export default function ApplicationRequiredFieldsSettings() {
  const { t } = useTranslation(['settings', 'applications'])
  const hasPermission = useSafePermission()
  const { fields: inventoryFields, isLoading, isError, refetch } = useFieldInventory('application')
  // Shared builder (§11): filters requires_permission, resolves the label, translates the reason.
  const rows = buildInventoryRows(inventoryFields, APPLICATION_FIELD_LABEL_KEYS, hasPermission, t)

  return (
    <div style={{ maxWidth: 760 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
        {t('applicationRequiredFields.title')}
      </h3>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
        {t('applicationRequiredFields.subtitle')}
      </p>
      {/* Four explicit states (§3): loading the inventory, a failed fetch with retry, an (unexpected but honest) empty inventory, and the real list. */}
      {isLoading && <Spinner label={t('common:loading')} />}
      {!isLoading && isError && (
        <ErrorBanner onRetry={() => { void refetch() }}>{t('requiredFields.inventoryLoadFailed')}</ErrorBanner>
      )}
      {!isLoading && !isError && rows.length === 0 && (
        <BodyText style={{ color: 'var(--text-muted)' }}>{t('requiredFields.inventoryEmpty')}</BodyText>
      )}
      {!isLoading && !isError && rows.length > 0 && (
        <FlatRequiredFieldsToggleList settingKey={KEY} fields={rows} hintKey="applicationRequiredFields.hint" />
      )}
    </div>
  )
}
