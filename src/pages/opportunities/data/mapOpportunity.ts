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
  // OPP-LOC-1: the customer's OWN location/site (`customer_location`) — distinct
  // from `location`, which is the TENANT's own branch (C-41, mirrors Match.branch_id).
  // The Klant tab's cascade (customer → location → department → contact) reads
  // customer_location, never `location` — reading the wrong one silently prefilled
  // an empty/mismatched pick in the drawer's edit mode (Danny, 2026-07-14).
  const loc = (o.customer_location && typeof o.customer_location === 'object') ? o.customer_location : null
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
    // eslint-disable-next-line no-restricted-syntax -- DATA fallback, not a UI colour choice
    stageColor: stageObj?.color ?? o.stage_color ?? '#6E8FD6',
    value:      num(rawValue),
    currency:   o.currency ?? 'EUR',
    owner:      ownerObj?.name ?? o.owner_name ?? '',
    ownerId:    ownerObj?.id ?? o.owner_id ?? null,
    date:       o.created_at ?? o.expected_close_at ?? o.close_date ?? '',
    expectedCloseAt: o.expected_close_at ?? null,
    archived:   Boolean(o.archived ?? o.deleted_at),
    archivedAt: o.deleted_at ?? null,
    // Zorg-detachering fields (C-42) — tolerated absent until the backend lands.
    hours:            num(o.hours),
    hoursPeriod:      o.hours_period ?? 'week',
    // R-4 unit-awareness: an hours-typed deal never inflates the € pipeline and vice versa.
    dealTypeUnit:     o.deal_type?.unit ?? null,
    startDate:        o.start_date ?? null,
    endDate:          o.end_date ?? null,
    serviceType:      svc?.label ?? (typeof o.service_type === 'string' ? o.service_type : '') ?? '',
    serviceTypeValue: svc?.value ?? null,
    // eslint-disable-next-line no-restricted-syntax -- DATA fallback, not a UI colour choice
    serviceTypeColor: svc?.color ?? '#9CA3AF',
    serviceTypeId:    svc?.id ?? o.service_type_id ?? null,
    agreementType:      agr?.label ?? (typeof o.agreement_type === 'string' ? o.agreement_type : '') ?? '',
    agreementTypeValue: agr?.value ?? null,
    // eslint-disable-next-line no-restricted-syntax -- DATA fallback, not a UI colour choice
    agreementTypeColor: agr?.color ?? '#9CA3AF',
    agreementTypeId:    agr?.id ?? o.agreement_type_id ?? null,
    location:      loc?.name ?? o.location_name ?? '',
    locationId:    loc?.id ?? o.customer_location_id ?? null,
    department:    dep?.name ?? '',
    departmentId:  dep?.id ?? o.department_id ?? null,
    contact:       con?.name ?? '',
    contactId:     con?.id ?? o.contact_id ?? null,
    // C-41 free-form tags (always an array for the drawer tags-editor).
    tags: Array.isArray(o.tags) ? o.tags.map(String) : [],
    // Tenant custom-field values (§3B "Eigen velden").
    customFieldValues: o.custom_fields ?? {},
  }
}
