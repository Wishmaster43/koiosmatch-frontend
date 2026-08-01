/**
 * customerBillingAddress (FACTUURADRES-1) — the resolution rule an invoice depends on:
 * the block resolves as a WHOLE, a blank string counts as empty, and empty falls back
 * to the visit address. Every case here is one an invoice can be sent to the wrong
 * address by, so they are asserted on values, not on "it returned something".
 */
import { describe, it, expect } from 'vitest'
import {
  mapCustomerBilling, readCustomerBilling,
  resolveCustomerBillingAddress, BILLING_API_FIELDS, BILLING_KEYS,
} from './customerBillingAddress'
// One address composer for the whole app — this module used to carry a byte-identical
// third copy of it (§11).
import { composeAddressLine } from '@/components/forms/EditableFieldTable'
import type { Customer } from '@/types/customer'

// A mapped customer carrying only the fields these helpers read.
const customer = (overrides: Record<string, unknown> = {}): Customer => ({
  id: 1, street: 'Dorpsstraat', houseNumber: '12', houseNumberSuffix: 'a',
  postalCode: '1234 AB', city: 'Amsterdam', country: 'NL',
  ...overrides,
} as unknown as Customer)

describe('customerBillingAddress · API key contract', () => {
  it('maps every UI key to the exact backend column (a key the rules do not list is dropped by Laravel)', () => {
    expect(BILLING_API_FIELDS).toEqual({
      billingPoBox: 'billing_po_box',
      billingStreet: 'billing_street',
      billingHouseNumber: 'billing_house_number',
      billingHouseNumberSuffix: 'billing_house_number_suffix',
      billingPostalCode: 'billing_postcode',
      billingCity: 'billing_city',
      billingCountry: 'billing_country',
    })
  })

  it('carries no province key — a Dutch invoice does not have one, so the column does not exist', () => {
    expect(BILLING_KEYS.some(k => /province|state/i.test(k))).toBe(false)
    expect(Object.values(BILLING_API_FIELDS).some(v => /province|state/.test(v))).toBe(false)
  })
})

describe('customerBillingAddress · mapCustomerBilling (raw API → UI block)', () => {
  it('reads each billing column into its UI key', () => {
    expect(mapCustomerBilling({
      billing_po_box: 'Postbus 1234', billing_street: 'Keizersgracht', billing_house_number: '7',
      billing_house_number_suffix: 'B', billing_postcode: '1015 CJ', billing_city: 'Amsterdam',
      billing_country: 'NL',
    })).toEqual({
      billingPoBox: 'Postbus 1234', billingStreet: 'Keizersgracht', billingHouseNumber: '7',
      billingHouseNumberSuffix: 'B', billingPostalCode: '1015 CJ', billingCity: 'Amsterdam',
      billingCountry: 'NL',
    })
  })

  it('defaults a missing, null or non-string column to an empty string (the form never shows "undefined")', () => {
    const mapped = mapCustomerBilling({ billing_po_box: null, billing_city: 42 })
    expect(mapped.billingPoBox).toBe('')
    expect(mapped.billingCity).toBe('')
    expect(mapped.billingStreet).toBe('')
  })

  it('survives a missing payload entirely', () => {
    expect(mapCustomerBilling(undefined).billingStreet).toBe('')
  })
})

describe('customerBillingAddress · resolve (empty means "use the visit address")', () => {
  it('falls back to the visit address when no billing field is filled', () => {
    const r = resolveCustomerBillingAddress(customer())
    expect(r.own).toBe(false)
    expect(r.visitLine).toBe('Dorpsstraat 12-a, 1234 AB Amsterdam')
  })

  it('treats whitespace-only values as empty (a form submits "" for the fields left alone)', () => {
    const r = resolveCustomerBillingAddress(customer({
      billingPoBox: '   ', billingStreet: '', billingCity: '\t',
    }))
    expect(r.own).toBe(false)
  })

  it('resolves as a WHOLE — one filled field means the customer has its own invoice address', () => {
    const r = resolveCustomerBillingAddress(customer({ billingPoBox: 'Postbus 1234' }))
    expect(r.own).toBe(true)
    // The visit street is NOT mixed in: half of one address and half of another is a
    // place that does not exist, and an invoice sent there is lost.
    expect(r.fields.billingStreet).toBe('')
    expect(r.fields.billingPoBox).toBe('Postbus 1234')
  })

  it('never pre-fills the form with the visit address (that would freeze a copy that then drifts)', () => {
    const r = resolveCustomerBillingAddress(customer())
    expect(r.fields).toEqual({
      billingPoBox: '', billingStreet: '', billingHouseNumber: '', billingHouseNumberSuffix: '',
      billingPostalCode: '', billingCity: '', billingCountry: '',
    })
  })

  it('reports an empty visit line when the customer has no visit address either', () => {
    const r = resolveCustomerBillingAddress(customer({
      street: '', houseNumber: '', houseNumberSuffix: '', postalCode: '', city: '',
    }))
    expect(r.own).toBe(false)
    expect(r.visitLine).toBe('')
  })

  it('handles a missing customer without throwing (drawer opens before the detail lands)', () => {
    const r = resolveCustomerBillingAddress(undefined)
    expect(r.own).toBe(false)
    expect(r.visitLine).toBe('')
  })
})

describe('customerBillingAddress · readCustomerBilling / composeAddressLine', () => {
  it('reads the billing block back off a mapped customer', () => {
    expect(readCustomerBilling(customer({ billingCity: 'Rotterdam' })).billingCity).toBe('Rotterdam')
  })

  it('composes the NL one-line address the drawer already uses', () => {
    expect(composeAddressLine({ street: 'Keizersgracht', houseNumber: '7', postalCode: '1015 CJ', city: 'Amsterdam' }))
      .toBe('Keizersgracht 7, 1015 CJ Amsterdam')
  })

  it('drops the empty halves instead of leaving stray separators', () => {
    expect(composeAddressLine({ city: 'Amsterdam' })).toBe('Amsterdam')
    expect(composeAddressLine({ street: 'Keizersgracht', houseNumber: '7' })).toBe('Keizersgracht 7')
    expect(composeAddressLine({})).toBe('')
  })
})
