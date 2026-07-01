import type { ComponentType, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useDateFormat } from '@/lib/datetime'
import EditableFieldTable from '@/components/forms/EditableFieldTable'
import type { FieldRow } from '@/components/forms/EditableFieldTable'
import { useOpportunityServiceTypes, useOpportunityAgreementTypes } from '@/lib/useOpportunityLookups'
import DetailTableJs from '@/components/ui/DetailTable'
import type { Opportunity } from '@/types/opportunity'
import type { Id } from '@/types/common'

type AnyProps = Record<string, unknown>
const DetailTable = DetailTableJs as unknown as ComponentType<AnyProps>

// Titled card wrapper — one per related field group.
function Card({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{title}</div>
      <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>{children}</div>
    </div>
  )
}

interface DetailsTabProps {
  opportunity: Opportunity
  onUpdate?: (id: Id | undefined, patch: Record<string, unknown>) => void
}

/**
 * DetailsTab — the deal fields (value · hours · term · service/agreement type) as an
 * in-place editable card, plus a read-only organisation card (customer → location →
 * department → contact, edited via the header pickers / dependent pickers per C-42).
 * Service/agreement types come from tenant lookups (seed fallback until the backend).
 */
export default function DetailsTab({ opportunity: o, onUpdate }: DetailsTabProps) {
  const { t } = useTranslation('opportunities')
  const { formatDate } = useDateFormat()
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
      serviceTypeColor:   svc?.color ?? '#9CA3AF',
      agreementTypeId:    agr?.id ?? null,
      agreementTypeValue: (v.agreementType as string) || null,
      agreementType:      agr?.label ?? '',
      agreementTypeColor: agr?.color ?? '#9CA3AF',
    })
  }

  // Customer hierarchy (klant/locatie/afdeling/contact) lives in the Klant tab now.
  const organisation = [
    [t('details.stage'),   o.stage || '—'],
    [t('details.owner'),   o.owner || '—'],
    [t('details.created'), formatDate(o.date)],
  ]

  return (
    <div>
      <EditableFieldTable title={t('details.groups.deal')} fields={dealFields} value={dealValue}
        onSave={onUpdate ? saveDeal : undefined} />
      <Card title={t('details.groups.organisation')}><DetailTable rows={organisation} lastBorder={false} /></Card>
    </div>
  )
}
