/**
 * customerBillingAddress (FACTUURADRES-1, Danny 2026-08-01) — the customer's OWN
 * invoice address: seven columns on `customers` (billing_po_box … billing_country).
 * There is deliberately no `billing_province`: a Dutch invoice does not carry one.
 * A main customer may invoice through a PO box, which can never be a vestiging, so
 * the billing-branch coupling could not answer this case.
 *
 * EMPTY MEANS "use the visit address" — that is the whole point of the decision, so
 * nobody maintains one address twice. The block resolves as a WHOLE (one filled field
 * = its own address); a blank string counts as empty, because a form always submits ''
 * for the fields left alone and that must never promote an empty block over the visit
 * address. This mirrors the backend's Customer::billingAddress() one-for-one.
 *
 * Why resolve here instead of reading the API's already-resolved `billing_address`:
 * the drawer patches optimistically, so the screen must flip between "own address" and
 * "uses the visit address" the moment the user saves — a server-resolved block would
 * only catch up a round-trip later and read as a broken toggle.
 *
 * Folding these keys into mapCustomer and the shared `Customer` type is the follow-up.
 */
import type { Customer } from '@/types/customer'
import { composeAddressLine } from '@/components/forms/EditableFieldTable'

// The invoice address as the UI holds it — camelCase, mirroring the visit-address
// field names on Customer (`postalCode`, never `postcode`).
export interface CustomerBillingFields {
  billingPoBox: string
  billingStreet: string
  billingHouseNumber: string
  billingHouseNumberSuffix: string
  billingPostalCode: string
  billingCity: string
  billingCountry: string
}

/**
 * UI key → API column. ONE source for the mapper below and for useCustomerRecord's
 * FIELD_MAP, so a PATCH can never travel under a key the backend does not validate
 * (an unlisted key is silently dropped by Laravel).
 */
export const BILLING_API_FIELDS: Record<keyof CustomerBillingFields, string> = {
  billingPoBox: 'billing_po_box',
  billingStreet: 'billing_street',
  billingHouseNumber: 'billing_house_number',
  billingHouseNumberSuffix: 'billing_house_number_suffix',
  billingPostalCode: 'billing_postcode',
  billingCity: 'billing_city',
  billingCountry: 'billing_country',
}

export const BILLING_KEYS = Object.keys(BILLING_API_FIELDS) as Array<keyof CustomerBillingFields>

// Raw API customer → the flat billing block. Defensive like mapCustomer: a missing or
// non-string column reads as '' so the edit form never renders `undefined`.
export function mapCustomerBilling(raw: unknown): CustomerBillingFields {
  const r = (raw ?? {}) as Record<string, unknown>
  const out = {} as CustomerBillingFields
  BILLING_KEYS.forEach(k => {
    const v = r[BILLING_API_FIELDS[k]]
    out[k] = typeof v === 'string' ? v : ''
  })
  return out
}

// Pull the billing block back off an already-mapped customer. The keys are attached by
// mapCustomerBilling but cannot be declared on the shared `Customer` type from this
// lane, so the widening cast happens here once instead of at every call site.
export function readCustomerBilling(c: Customer | null | undefined): CustomerBillingFields {
  const r = (c ?? {}) as unknown as Record<string, unknown>
  const out = {} as CustomerBillingFields
  BILLING_KEYS.forEach(k => {
    const v = r[k]
    out[k] = typeof v === 'string' ? v : ''
  })
  return out
}

export interface ResolvedBillingAddress {
  /** True when the customer carries its OWN invoice address (any billing field filled). */
  own: boolean
  /** The block exactly as stored — the edit form's values, never pre-filled from the visit address. */
  fields: CustomerBillingFields
  /** The visit address as one line — what an invoice falls back to while `own` is false. */
  visitLine: string
}

/**
 * Resolve which address an invoice actually goes to (mirrors Customer::billingAddress()).
 * The form always edits the RAW fields, never the resolved result: pre-filling the visit
 * address into the form would turn "same as visit address" into a frozen copy that then
 * drifts — exactly the maintenance burden this design avoids.
 */
export function resolveCustomerBillingAddress(c: Customer | null | undefined): ResolvedBillingAddress {
  const fields = readCustomerBilling(c)
  const own = BILLING_KEYS.some(k => fields[k].trim() !== '')
  return { own, fields, visitLine: composeAddressLine({
    street: c?.street, houseNumber: c?.houseNumber, houseNumberSuffix: c?.houseNumberSuffix,
    postalCode: c?.postalCode, city: c?.city,
  }) }
}
