import { initialsOf } from '@/lib/initials'

// Map a raw API opportunity → the flat shape the table/insights/drawer render
// (snake_case-tolerant). Nested customer/stage/owner arrive as objects (the API
// shape); the flat *_id / *_name forms are tolerated as a fallback.
export function mapOpportunity(o) {
  const customer = (o.customer && typeof o.customer === 'object') ? o.customer
    : (o.client && typeof o.client === 'object') ? o.client : null
  const client = o.client_name ?? customer?.name ?? '—'
  const title  = o.title ?? o.name ?? '—'
  const stageObj = (o.stage && typeof o.stage === 'object') ? o.stage : null
  const ownerObj = (o.owner && typeof o.owner === 'object') ? o.owner : null
  return {
    id:         o.id,
    title,
    initials:   initialsOf([title, client].find(v => v && v !== '—')),
    client,
    clientId:   customer?.id ?? o.customer_id ?? o.client_id ?? null,
    stage:      stageObj?.label ?? (typeof o.stage === 'string' ? o.stage : null) ?? o.stage_label ?? o.status ?? '',
    stageValue: stageObj?.value ?? o.stage_value ?? null,
    stageColor: stageObj?.color ?? o.stage_color ?? '#6E8FD6',
    value:      typeof (o.value ?? o.amount ?? o.deal_value) === 'number'
      ? (o.value ?? o.amount ?? o.deal_value) : null,
    currency:   o.currency ?? 'EUR',
    owner:      ownerObj?.name ?? o.owner_name ?? '',
    ownerId:    ownerObj?.id ?? o.owner_id ?? null,
    date:       o.created_at ?? o.expected_close_at ?? o.close_date ?? '',
    expectedCloseAt: o.expected_close_at ?? null,
  }
}
