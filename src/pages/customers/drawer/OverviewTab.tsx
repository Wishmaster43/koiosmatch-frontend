/**
 * OverviewTab — the customer's company fields, grouped into titled cards
 * (General / Online / Billing) with in-place edit via the shared
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
 *
 * The vacancy-visibility flags (hideCompanyName/showInVacancies/excludeFromSourcing,
 * formerly the "Instellingen" group here) moved to their own VacancySettingsTab
 * (Danny 27-07: "logischer een apart tabje toch?") — see CustomerDrawer.tsx.
 *
 * BRANCH-LINKS-1 (Danny 28-07 "dit wil ik ook terug zien bij klanten"): the
 * "Vestiging koppelen" block at the bottom mirrors the candidate drawer's
 * BranchSection verbatim (shared component, §3A/§11) via useEntityBranches. This
 * is a DIFFERENT axis from the `branchId` field above: `branchId` (BRANCH-1,
 * MATCH-PLACEMENT-1) is the single establishment a placement's paperwork/invoicing
 * routes through; the linked-branches list (VESTIGING-2 fase 4) is which of the
 * tenant's branches can access this customer at all (behind the tenant flag
 * `branch_authz_enabled`, default OFF). Both stay — one scopes billing, the other
 * scopes visibility — see the BranchSection block below for why they are not merged.
 */
import { useTranslation } from 'react-i18next'
import EditableFieldTable from '@/components/forms/EditableFieldTable'
import type { FieldRow } from '@/components/forms/EditableFieldTable'
import { useIndustries } from '@/lib/useIndustries'
import { useLocations } from '@/lib/useLocations'
import KoiosAdviceBlock from '@/components/ai/KoiosAdviceBlock'
import BranchSection from '@/components/drawer/BranchSection'
import { emailValue, phoneValue, websiteValue } from '@/components/drawer/contactLinks'
import { useEntityBranches } from '@/components/drawer/useEntityBranches'
import EditableRichTextField from './EditableRichTextField'
import { buildCustomerAdviceInsights } from './customerAiInsights'
import type { Customer } from '@/types/customer'

export default function OverviewTab({ c, onSave }: { c: Customer; onSave?: (values: Record<string, unknown>) => void }) {
  const { t } = useTranslation('customers')
  const { industries } = useIndustries()
  // The tenant's own establishments (GET /locations) — the same source the match
  // form's Vestiging picker uses, so both screens offer exactly one list.
  const branchOptions = useLocations().map(l => ({ value: String(l.value), label: l.label }))
  // The customer's linked-branches membership (VESTIGING-2 fase 4) — no embedded
  // field on the Customer resource yet, so hydrate it once via GET on mount.
  const branchLinks = useEntityBranches({ prefix: 'customers', id: c.id, options: branchOptions, fetchOnMount: true })

  const gDetails = t('overview.details')
  const gAddress = t('overview.address')
  const gContact = t('overview.contact')
  const gBranch  = t('overview.branch')

  // Field schema → grouped titled cards. Keys match the flat customer shape and
  // are translated to API keys in the page's updateCustomer. Description/
  // recruitmentProblems live in their own Teksten blocks below, not here.
  // Danny 28-07 restructure of the (renamed) Bedrijf tab: Gegevens · Adres · Contact ·
  // Vestiging, mirroring the candidate drawer's grouping. Keys match the flat customer
  // shape and are translated to API keys in the page's updateCustomer.
  const fields: FieldRow[] = [
    { key: 'industry',      label: t('overview.industry'),      type: 'select', options: industries, group: gDetails },
    { key: 'employeeCount', label: t('overview.employeeCount'), inputType: 'number', group: gDetails },

    // ADRES — only `plaats` exists today. The customers table has no street/house
    // number/postcode/province/country (measured 28-07, filed as KLANT-ADRES-1), so this
    // is deliberately a one-row block instead of the candidate's composed address line:
    // rendering "…, Utrecht" from fields that do not exist would be a lie about the data.
    { key: 'city', label: t('overview.city'), group: gAddress },

    // CONTACT — the customer's OWN e-mail/phone (they existed on the API all along;
    // only the frontend never showed them).
    // Rendered as real mailto/tel links with a shortcut icon, exactly like the candidate
    // drawer (Danny 28-07) — one shared renderer, not a second copy.
    { key: 'email', label: t('overview.email'), inputType: 'email', group: gContact,
      renderValue: v => emailValue(v, t('overview.sendEmail')) },
    { key: 'phone', label: t('overview.phone'), group: gContact,
      renderValue: v => phoneValue(v, t('overview.callPhone')) },
    // The website is a way to reach the company, so it sits with the other contact
    // details (Danny 28-07) and opens in a new tab.
    { key: 'website', label: t('overview.website'), group: gContact,
      renderValue: v => websiteValue(v, t('overview.openWebsite')) },

  ]

  // Per-block rendering: the group title moves to the table's own header row, next to
  // that block's pencil, so `group` is cleared on the rows (a second in-card heading
  // would just repeat it).
  const block = (group: string) => fields.filter(f => f.group === group).map(f => ({ ...f, group: undefined }))
  const values = c as unknown as Record<string, unknown>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <EditableFieldTable title={gDetails} fields={block(gDetails)} value={values} onSave={onSave} />
      <EditableFieldTable title={gAddress} fields={block(gAddress)} value={values} onSave={onSave} />
      <EditableFieldTable title={gContact} fields={block(gContact)} value={values} onSave={onSave} />

      {/* BEDRIJFSTEKST — one free-text block for company info AND recruitment issues
          (Danny 28-07: "1 txt blok"), directly under Contact. It edits `description`.
          `recruitment_problems` AND `tone_of_voice` (Schrijfstijl) are no longer shown as
          separate fields — Danny 28-07: both belong in this one text. Their data stays
          server-side until CMBE merges it into `description` (BEDRIJFSTEKST-1), so
          nothing is destroyed here, only hidden. */}
      <EditableRichTextField label={t('overview.companyText')} value={c.description ?? ''}
        onSave={html => onSave?.({ description: html })} />

      {/* Koios AI advisory — company/location completeness + relationship activity (§3A blueprint). */}
      <KoiosAdviceBlock namespace="customers" insights={buildCustomerAdviceInsights(c, t)} />

      {/* VESTIGING — which of the tenant's establishments may see this customer. The
          single routing/invoicing branch that used to sit above it moved to the
          Facturatie block on the Prijsafspraken tab (Danny 28-07). */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <BranchSection
          label={gBranch}
          addLabel={t('overview.branchesLink')}
          emptyLabel={t('overview.branchesEmpty')}
          options={branchOptions}
          selectedIds={branchLinks.selectedIds}
          branches={branchLinks.branches}
          onToggle={branchLinks.toggle}
        />
      </div>

    </div>
  )
}
