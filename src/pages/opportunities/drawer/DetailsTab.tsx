import { useTranslation } from 'react-i18next'
import EditableFieldTable from '@/components/forms/EditableFieldTable'
import type { FieldRow } from '@/components/forms/EditableFieldTable'
import { useOpportunityServiceTypes, useOpportunityAgreementTypes } from '@/lib/useOpportunityLookups'
import OpportunityDescriptionBlock from './OpportunityDescriptionBlock'
import OpportunityKoiosBlock from './OpportunityKoiosBlock'
import SharedBranchSection from '@/components/drawer/BranchSection'
import { hasDescriptionText } from '../data/descriptionText'
import type { Opportunity } from '@/types/opportunity'
import type { Id, LookupOption } from '@/types/common'

interface DetailsTabProps {
  opportunity: Opportunity
  onUpdate?: (id: Id | undefined, patch: Record<string, unknown>) => void
  // Stage lookup (won/lost flags) for the Koios advice — same list the table gets.
  stages?: LookupOption[]
}

/**
 * DetailsTab — the deal fields (value · hours · term · service/agreement type) as an
 * in-place editable card (the organisation card was dropped 2026-07-13: customer /
 * location / department / contact live in the drawer-header pickers per C-42).
 * Service/agreement types come from tenant lookups (seed fallback until the backend).
 *
 * DRILLDOWN-VOLGORDE-CANON (Danny 21-08, §3A): the block order follows the
 * candidate/match blueprint — (1) INFORMATIE (the deal fields), (2) VRIJE TEKST
 * with its own second-screen pop-out (OPP-DESCRIPTION-1, "Kansomschrijving"),
 * (3) KOIOS AI, (4) VESTIGING last, read-only. This corrects the previous
 * order, which had the description block first, above the deal fields.
 */
export default function DetailsTab({ opportunity: o, onUpdate, stages = [] }: DetailsTabProps) {
  const { t } = useTranslation(['opportunities', 'candidates'])
  const { serviceTypes }   = useOpportunityServiceTypes()
  const { agreementTypes } = useOpportunityAgreementTypes()

  // Editable deal fields. Service/agreement selects key on the slug; the id resolves on save.
  const dealFields: FieldRow[] = [
    { key: 'value',        label: t('details.value'),        inputType: 'number', prefix: '€' },
    { key: 'currency',     label: t('details.currency') },
    { key: 'hours',        label: t('details.hours'),        inputType: 'number' },
    { key: 'hoursPeriod',  label: t('details.hoursPeriod'),  type: 'select',
      options: [
        { value: 'week',  label: t('details.periods.week') },
        { value: 'month', label: t('details.periods.month') },
        { value: 'total', label: t('details.periods.total') },
      ] },
    { key: 'startDate',    label: t('details.startDate'),    type: 'date' },
    { key: 'endDate',      label: t('details.endDate'),      type: 'date' },
    { key: 'serviceType',  label: t('details.serviceType'),  type: 'select',
      options: serviceTypes.map(s => ({ value: s.value, label: s.label })) },
    { key: 'agreementType', label: t('details.agreementType'), type: 'select',
      options: agreementTypes.map(a => ({ value: a.value, label: a.label })) },
  ]
  const dealValue = {
    value:         o.value ?? '',
    currency:      o.currency || 'EUR',
    hours:         o.hours ?? '',
    hoursPeriod:   o.hoursPeriod || 'week',
    startDate:     o.startDate ?? '',
    endDate:       o.endDate ?? '',
    serviceType:   o.serviceTypeValue ?? '',
    agreementType: o.agreementTypeValue ?? '',
  }

  // Resolve the picked slugs back to their lookup id + label, then patch (UI keys).
  const saveDeal = (v: Record<string, unknown>) => {
    const svc = serviceTypes.find(s => s.value === v.serviceType)
    const agr = agreementTypes.find(a => a.value === v.agreementType)
    onUpdate?.(o.id, {
      value:         v.value === '' || v.value == null ? null : Number(v.value),
      currency:      (v.currency as string) || 'EUR',
      hours:         v.hours === '' || v.hours == null ? null : Number(v.hours),
      hoursPeriod:   (v.hoursPeriod as string) || 'week',
      startDate:     (v.startDate as string) || null,
      endDate:       (v.endDate as string) || null,
      serviceTypeId:      svc?.id ?? null,
      serviceTypeValue:   (v.serviceType as string) || null,
      serviceType:        svc?.label ?? '',
      // eslint-disable-next-line no-restricted-syntax -- DATA fallback, not a UI colour choice
      serviceTypeColor:   svc?.color ?? '#9CA3AF',
      agreementTypeId:    agr?.id ?? null,
      agreementTypeValue: (v.agreementType as string) || null,
      agreementType:      agr?.label ?? '',
      // eslint-disable-next-line no-restricted-syntax -- DATA fallback, not a UI colour choice
      agreementTypeColor: agr?.color ?? '#9CA3AF',
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* (1) INFORMATIE — the deal fields. Canon (05-08): no row dividers,
          11px labels (candidate ProfileTab convention). */}
      <EditableFieldTable title={t('details.groups.deal')} fields={dealFields} value={dealValue}
        onSave={onUpdate ? saveDeal : undefined} />
      {/* Organisation card dropped (Danny 2026-07-13): fase/eigenaar/aangemaakt all live in the drawer header already. */}
      {/* (2) VRIJE TEKST — the "Kansomschrijving" (OPP-DESCRIPTION-1), own pencil/save/✕
          and second-screen pop-out (TEKST-POPOUT-1), independent of the
          EditableFieldTable's own edit state above. A cleared editor still
          emits stray markup ('<p></p>'), not '' — hasDescriptionText strips
          tags first so the clear path PATCHes description: null, never that
          literal markup string (measured live, 08-08). */}
      <OpportunityDescriptionBlock opportunityId={o.id} value={o.description ?? ''}
        onSave={html => onUpdate?.(o.id, { description: hasDescriptionText(html) ? html : null })} />
      {/* (3) KOIOS AI — the SAME advice the table's Koios column shows, plus
          honest derived default rows (deal health, close-date window) so the
          block ALWAYS renders, even with no real advice (mirrors matches/candidates). */}
      <OpportunityKoiosBlock opportunity={o} stages={stages} />
      {/* (4) VESTIGING last — the tenant's OWN branch (C-41, distinct from the
          customer's own site on the Customer tab). Read-only display: this deal
          derives its branch from the CREATE modal's Vestiging picker (no edit-modal
          route exists from this drill-down yet), so
          the drawer never offers a second, disconnected edit surface here
          (mirrors matches/drawer/OverviewTab.tsx's bottom block exactly). */}
      <SharedBranchSection readOnly label={t('candidates:matchesView.branch')}
        emptyLabel={t('candidates:sections.branchEmpty')}
        branches={o.branch ? [{ name: o.branch }] : []} />
    </div>
  )
}
