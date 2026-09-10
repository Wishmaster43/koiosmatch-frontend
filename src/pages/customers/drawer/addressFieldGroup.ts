/**
 * addressFieldGroup — the shared 'address' composite FieldRow entry
 * (street/no/suffix/line2/postcode/city), byte-identical between the
 * customer's own Overview tab and a location's Adres & gegevens tab (DRY
 * round 11, CUSTTABS2). The group label and the city label key differ per
 * host, so they arrive as props (rule B); everything else — including the
 * LANE-I1b second address line — is one shared shape.
 */
import type { TFunction } from 'i18next'
import type { FieldRow } from '@/components/forms/EditableFieldTable'

// Returns the 'address' composite field row: street/no/suffix/line2/postcode/city
// collapse into ONE composed line in read mode and expand while editing.
export function addressFieldGroup(t: TFunction, { groupLabel, cityLabel }: { groupLabel: string; cityLabel: string }): FieldRow {
  return {
    key: 'address', label: groupLabel, type: 'address', group: groupLabel,
    addressFields: [
      { key: 'street', label: t('locations.detail.street'), type: 'text' },
      { key: 'houseNumber', label: t('locations.detail.houseNumber'), type: 'text' },
      { key: 'houseNumberSuffix', label: t('locations.detail.houseNumberSuffix'), type: 'text' },
      // LANE-I1b: optional second address line.
      { key: 'addressLine2', label: t('address.addressLine2'), type: 'text' },
      { key: 'postalCode', label: t('locations.detail.postalCode'), type: 'text' },
      { key: 'city', label: cityLabel, type: 'text' },
    ],
  }
}
