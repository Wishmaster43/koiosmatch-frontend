/**
 * OverviewTab — the customer's company fields, grouped into titled cards
 * (General / Online / Settings / Billing) with in-place edit via the shared
 * EditableFieldTable, plus a standalone Teksten section (Description +
 * Recruitment challenges) using the candidate profile-text pattern — its own
 * rich editor + pencil/save/cancel per field (Danny 2026-07-14), pulled OUT of
 * the EditableFieldTable groups since a bare textarea is no longer the house
 * pattern for prose. Industry options come from the /industries lookup (never
 * hardcoded). Saving flows back through onSave → the page's optimistic PATCH.
 * Billing card (Danny 2026-07-22): cost-centre is the TOP of the afdeling >
 * locatie > klant cascade read by the placement form; billing email here is
 * the customer's own — the ONE source invoicing always reads from, regardless
 * of the location/department picked on a match (see matchPlacement/helpers.ts).
 */
import { useTranslation } from 'react-i18next'
import EditableFieldTable from '@/components/forms/EditableFieldTable'
import type { FieldRow } from '@/components/forms/EditableFieldTable'
import { useIndustries } from '@/lib/useIndustries'
import { useLocations } from '@/lib/useLocations'
import KoiosAdviceBlock from '@/components/ai/KoiosAdviceBlock'
import EditableRichTextField from './EditableRichTextField'
import { buildCustomerAdviceInsights } from './customerAiInsights'
import type { Customer } from '@/types/customer'

export default function OverviewTab({ c, onSave }: { c: Customer; onSave?: (values: Record<string, unknown>) => void }) {
  const { t } = useTranslation('customers')
  const { industries } = useIndustries()
  // The tenant's own establishments (GET /locations) — the same source the match
  // form's Vestiging picker uses, so both screens offer exactly one list.
  const branchOptions = useLocations().map(l => ({ value: String(l.value), label: l.label }))

  const gGeneral  = t('overview.general')
  const gOnline   = t('overview.online')
  const gSettings = t('overview.settings')
  const gBilling  = t('overview.billing')

  // Field schema → grouped titled cards. Keys match the flat customer shape and
  // are translated to API keys in the page's updateCustomer. Description/
  // recruitmentProblems live in their own Teksten blocks below, not here.
  const fields: FieldRow[] = [
    // BRANCH-1 (Danny 27-07): every customer hangs on one of the tenant's own
    // establishments. The backend already delivered it (branch {id,name} + a
    // location_id validated against real establishments) — it was simply never
    // shown, so the drawer could not answer "which office owns this customer".
    { key: 'branchId', label: t('overview.branch'), type: 'select', options: branchOptions, group: gGeneral },
    { key: 'city',          label: t('overview.city'),         group: gGeneral },
    { key: 'industry',      label: t('overview.industry'),     type: 'select', options: industries, group: gGeneral },
    { key: 'employeeCount', label: t('overview.employeeCount'), inputType: 'number', group: gGeneral },
    { key: 'toneOfVoice',   label: t('overview.toneOfVoice'),  group: gGeneral },

    { key: 'website',          label: t('overview.website'),       group: gOnline },
    { key: 'privacyPolicyUrl', label: t('overview.privacyPolicyUrl'), group: gOnline },
    // No "Heeft carrièrepagina" (Danny 27-07): the career site is configured in
    // Settings, so a per-customer flag here was a second truth nobody maintained.

    { key: 'hideCompanyName',     label: t('overview.hideCompanyName'),     type: 'checkbox', group: gSettings },
    { key: 'showInVacancies',     label: t('overview.showInVacancies'),     type: 'checkbox', group: gSettings },
    { key: 'excludeFromSourcing', label: t('overview.excludeFromSourcing'), type: 'checkbox', group: gSettings },

    // Facturatie: the debtor number moved here from Algemeen (Danny 27-07) — it is
    // an invoicing fact, not a general one. Kostenplaats is the top of the
    // afdeling>locatie>klant cascade and the billing email is the ONE source
    // invoicing reads, regardless of the location/department picked on a match.
    { key: 'debtorNumber', label: t('overview.debtorNumber'), group: gBilling },
    { key: 'costCenter',  label: t('overview.costCenter'),  group: gBilling },
    { key: 'billingEmail', label: t('overview.billingEmail'), group: gBilling },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <EditableFieldTable fields={fields} value={c as unknown as Record<string, unknown>} onSave={onSave} />

      {/* Teksten — same rich editor + own pencil/save/cancel as the candidate profile text. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
          {t('overview.textsTitle')}
        </span>
        <EditableRichTextField label={t('overview.description')} value={c.description ?? ''}
          onSave={html => onSave?.({ description: html })} />
        <EditableRichTextField label={t('overview.recruitmentProblems')} value={c.recruitmentProblems ?? ''}
          onSave={html => onSave?.({ recruitmentProblems: html })} />
      </div>

      {/* Koios AI advisory — company/location completeness + relationship activity (§3A blueprint). */}
      <KoiosAdviceBlock namespace="customers" insights={buildCustomerAdviceInsights(c, t)} />
    </div>
  )
}
