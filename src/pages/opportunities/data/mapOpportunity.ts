import { initialsOf } from '@/lib/initials'
import type { ApiOpportunity, Opportunity } from '@/types/opportunity'

// Map a raw API opportunity → the flat shape the table/insights/drawer render
// (snake_case-tolerant). Nested customer/stage/owner arrive as objects (the API
// shape); the flat *_id / *_name forms are tolerated as a fallback.
export function mapOpportunity(o: ApiOpportunity): Opportunity {
  const customer = (o.customer && typeof o.customer === 'object') ? o.customer
    : (o.client && typeof o.client === 'object') ? o.client : null
  const client = o.client_name ?? customer?.name ?? '—'
  const title  = o.title ?? o.name ?? '—'
  const stageObj = (o.stage && typeof o.stage === 'object') ? o.stage : null
  const ownerObj = (o.owner && typeof o.owner === 'object') ? o.owner : null
  const svc = (o.service_type   && typeof o.service_type   === 'object') ? o.service_type   : null
  const agr = (o.agreement_type && typeof o.agreement_type === 'object') ? o.agreement_type : null
  const loc = (o.location   && typeof o.location   === 'object') ? o.location   : null
  const dep = (o.department && typeof o.department === 'object') ? o.department : null
  const con = (o.contact    && typeof o.contact    === 'object') ? o.contact    : null
  // Decimal fields (value/hours) may arrive as a string — coerce to a number or null.
  const num = (v: unknown): number | null =>
    typeof v === 'number' ? v : (v != null && String(v).trim() !== '' && !isNaN(Number(v)) ? Number(v) : null)
  const rawValue = o.value ?? o.amount ?? o.deal_value
  return {
    id:         o.id,
    title,
    initials:   initialsOf([title, client].find(v => v && v !== '—')),
    client,
    clientId:   customer?.id ?? o.customer_id ?? o.client_id ?? null,
    stage:      stageObj?.label ?? (typeof o.stage === 'string' ? o.stage : null) ?? o.stage_label ?? o.status ?? '',
    stageValue: stageObj?.value ?? o.stage_value ?? null,
    stageColor: stageObj?.color ?? o.stage_color ?? '#6E8FD6',
    value:      num(rawValue),
    currency:   o.currency ?? 'EUR',
    owner:      ownerObj?.name ?? o.owner_name ?? '',
    ownerId:    ownerObj?.id ?? o.owner_id ?? null,
    date:       o.created_at ?? o.expected_close_at ?? o.close_date ?? '',
    expectedCloseAt: o.expected_close_at ?? null,
    archived:   Boolean(o.archived ?? o.deleted_at),
    // Zorg-detachering fields (C-42) — tolerated absent until the backend lands.
    hours:            num(o.hours),
    hoursPeriod:      o.hours_period ?? 'week',
    startDate:        o.start_date ?? null,
    endDate:          o.end_date ?? null,
    serviceType:      svc?.label ?? (typeof o.service_type === 'string' ? o.service_type : '') ?? '',
    serviceTypeValue: svc?.value ?? null,
    serviceTypeColor: svc?.color ?? '#9CA3AF',
    serviceTypeId:    svc?.id ?? o.service_type_id ?? null,
    agreementType:      agr?.label ?? (typeof o.agreement_type === 'string' ? o.agreement_type : '') ?? '',
    agreementTypeValue: agr?.value ?? null,
    agreementTypeColor: agr?.color ?? '#9CA3AF',
    agreementTypeId:    agr?.id ?? o.agreement_type_id ?? null,
    location:      loc?.name ?? o.location_name ?? '',
    locationId:    loc?.id ?? o.location_id ?? null,
    department:    dep?.name ?? '',
    departmentId:  dep?.id ?? o.department_id ?? null,
    contact:       con?.name ?? '',
    contactId:     con?.id ?? o.contact_id ?? null,
  }
}
