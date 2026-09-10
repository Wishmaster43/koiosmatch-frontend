import { describe, it, expect } from 'vitest'
import type { TFunction } from 'i18next'
import { addressFieldGroup } from './addressFieldGroup'

// Identity translator with a marker per key — asserts the KEYS this shared unit resolves.
const t = ((key: string) => `[${key}]`) as unknown as TFunction

describe('addressFieldGroup', () => {
  it('builds the address composite with the caller-supplied group/city labels (LocationAddressTab shape)', () => {
    const field = addressFieldGroup(t, { groupLabel: 'subModal.groups.address label', cityLabel: '[locations.detail.city]' })

    expect(field.key).toBe('address')
    expect(field.type).toBe('address')
    expect(field.label).toBe('subModal.groups.address label')
    expect(field.group).toBe('subModal.groups.address label')
    expect(field.addressFields?.map(f => f.key)).toEqual([
      'street', 'houseNumber', 'houseNumberSuffix', 'addressLine2', 'postalCode', 'city',
    ])
    // The city label is the one field a prop must carry (Rule B) — LocationAddressTab vs OverviewTab differ here.
    expect(field.addressFields?.find(f => f.key === 'city')?.label).toBe('[locations.detail.city]')
  })

  it('carries the LANE-I1b second address line and resolves the shared field labels through t()', () => {
    const field = addressFieldGroup(t, { groupLabel: 'overview.address label', cityLabel: '[overview.city]' })

    expect(field.addressFields?.find(f => f.key === 'addressLine2')?.label).toBe('[address.addressLine2]')
    expect(field.addressFields?.find(f => f.key === 'street')?.label).toBe('[locations.detail.street]')
  })
})
