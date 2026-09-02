/**
 * LocationAddressTab — the "Adres & gegevens" ("Address & details") sub-tab
 * body of LocationDetail
 * (§0.3 split, this task — LocationDetail passed ~450 lines once
 * ARCHIVE-SUBENTITY-1/LOCATIE-SAMENVOEGEN-1/TAKEN-OP-LOCATIE-1 landed). Same
 * block order as the customer's Bedrijf ("Company") tab (Danny 28-07: "zelfde
 * format als klant" — "same format as customer"): Gegevens · Adres · Contact ·
 * Omschrijving · Koios advies · Vestiging ("Details · Address · Contact ·
 * Description · Koios advice · Branch").
 * Pure presentational — LocationDetail still owns all state/handlers and hands
 * them down as props (§3A: details stay thin containers).
 */
import type { TFunction } from 'i18next'
import EditableFieldTable from '@/components/forms/EditableFieldTable'
import type { FieldRow } from '@/components/forms/EditableFieldTable'
import EditableRichTextField from './EditableRichTextField'
import LocationContactSection from './LocationContactSection'
import KoiosAdviceBlock from '@/components/ai/KoiosAdviceBlock'
import LocationBranchSection from './LocationBranchSection'
import { kvkValue, vatValue } from '@/components/drawer/contactLinks'
import { useIdentifierValidation } from '@/hooks/useIdentifierValidation'
import { buildLocationAdviceInsights } from './locationAiInsights'
import { isPrimaryForLocation } from '../hooks/useCustomerContacts'
import type { Contact, Location } from '@/types/customer'
import type { Id } from '@/types/common'
import type { ContactPayload } from '../hooks/useCustomerContacts'
import type { LocationPayload } from '../hooks/useCustomerLocations'

interface Props {
  location: Location
  customerId?: Id
  contacts: Contact[]
  t: TFunction
  provinceOptions: { value: string; label: string }[]
  countryOptions: { value: string; label: string }[]
  branchOptions: { value: string; label: string }[]
  onSave: (id: Id, payload: Partial<LocationPayload>) => void
  onAddContact: (payload: ContactPayload) => Promise<Contact | void> | void
  /** Jump to the Contactpersonen sub-tab, optionally opening one contact directly. */
  onGoToContacts: (openId?: Id) => void
}

// The location drawer's address/registration tab: field cards + per-country
// KVK/BTW validation (mirrors the customer's own Bedrijf tab, see below).
export default function LocationAddressTab({
  location: l, customerId, contacts, t, provinceOptions, countryOptions, branchOptions, onSave, onAddContact, onGoToContacts,
}: Props) {
  // CONTACT-LOCATION-PRIMARY-1: THIS site's own primary contact — a real record resolved
  // from the contact↔location coupling flag, not a name matched against free text.
  const primaryContact = contacts.find(c => isPrimaryForLocation(c, l.id as Id)) ?? null

  // KVK/BTW-PER-LAND-1 (Danny 08-08, points 10 + 11): same per-country check as the
  // customer's own Bedrijf tab — this SITE's country decides the rule (a Belgian site
  // under a Dutch customer is checked as Belgian), the tenant setting decides whether
  // a mismatch blocks or only warns.
  const identifiers = useIdentifierValidation()
  const validateCoc = (v: unknown, values: Record<string, unknown>) =>
    identifiers.notice('coc', v as string, (values.country as string) ?? l.country)
  const validateVat = (v: unknown, values: Record<string, unknown>) =>
    identifiers.notice('vat', v as string, (values.country as string) ?? l.country)

  // Algemeen/Adres/Registratie ("General/Address/Registration") — street/no/suffix/postcode/city collapse into ONE
  // composed line in read mode (the 'address' composite) and only expand to loose
  // fields while editing; state/country stay their own rows.
  const generalFields: FieldRow[] = [
    { key: 'name', label: t('locations.detail.name'), type: 'text', group: t('overview.details') },
    { key: 'address', label: t('subModal.groups.address'), type: 'address', group: t('subModal.groups.address'),
      addressFields: [
        { key: 'street', label: t('locations.detail.street'), type: 'text' },
        { key: 'houseNumber', label: t('locations.detail.houseNumber'), type: 'text' },
        { key: 'houseNumberSuffix', label: t('locations.detail.houseNumberSuffix'), type: 'text' },
        { key: 'postalCode', label: t('locations.detail.postalCode'), type: 'text' },
        { key: 'city', label: t('locations.detail.city'), type: 'text' },
      ] },
    // Searchable pickers, not free text (Danny 28-07). NOTE the value format: unlike the
    // candidate, a location stores the country NAME ("Nederland"), not an ISO-2 code.
    { key: 'state', label: t('locations.detail.state'), type: 'select', options: provinceOptions, group: t('subModal.groups.address') },
    { key: 'country', label: t('locations.detail.country'), type: 'select', options: countryOptions, group: t('subModal.groups.address') },
    { key: 'cocNumber', label: t('locations.detail.coc'), type: 'text', group: t('overview.details'),
      renderValue: v => kvkValue(v, t('locations.detail.openKvk')), validate: validateCoc },
    { key: 'vatNumber', label: t('locations.detail.vat'), type: 'text', group: t('overview.details'),
      renderValue: v => vatValue(v, t('locations.detail.openVies')), validate: validateVat },
    // Kostenplaats ("Cost center") sits in Gegevens ("Details") (Danny 28-07).
    { key: 'costCenter', label: t('locations.detail.costCenter'), type: 'text', group: t('overview.details') },
    // K-249 C.4 (Danny 31-08): a location's OWN billing e-mail now feeds the
    // match billing resolver (department → location → customer) — the earlier
    // "invoicing always comes from the customer" call is superseded by that
    // decision, so the field is editable here again, mirroring the customer's own.
    { key: 'billingEmail', label: t('locations.detail.billingEmail'), type: 'text', group: t('overview.details') },
  ]

  const values = {
    name: l.name,
    street: l.street, houseNumber: l.houseNumber, houseNumberSuffix: l.houseNumberSuffix,
    postalCode: l.postalCode, city: l.city, state: l.state, country: l.country,
    cocNumber: l.cocNumber, vatNumber: l.vatNumber,
    costCenter: l.costCenter, billingEmail: l.billingEmail,
  }

  // Maps the EditableFieldTable's edited values back onto the location patch shape.
  const save = (v: Record<string, unknown>) => {
    onSave(l.id as Id, {
      name: v.name as string,
      street: v.street as string, houseNumber: v.houseNumber as string, houseNumberSuffix: v.houseNumberSuffix as string,
      postalCode: v.postalCode as string, city: v.city as string, state: v.state as string, country: v.country as string,
      cocNumber: v.cocNumber as string, vatNumber: v.vatNumber as string,
      costCenter: v.costCenter as string, billingEmail: v.billingEmail as string,
    })
  }

  // LOCATIE-OMSCHRIJVING-1 (Danny 02-08): its own rich-text block, same pattern the
  // department detail uses — a bare textarea is not the house pattern for prose.
  const saveDescription = (html: string) => onSave(l.id as Id, { description: html })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* CANON-DIVIDER-1 (Danny 05-08): candidate ProfileTab canon — no line
          between rows, 11px labels. */}
      {/* Canon width (fieldRowCanon, 05-08): EditableFieldTable's own default now matches. */}
      {[t('overview.details'), t('subModal.groups.address')].map(group => (
        <EditableFieldTable key={group} title={group} value={values} onSave={save}
          fields={generalFields.filter(f => f.group === group).map(f => ({ ...f, group: undefined }))} />
      ))}

      {/* CONTACT-LOCATION-PRIMARY-1, round two (Danny 02-08) — ONE contact block, and the
          coupling is the only truth it shows as a link. Setting/changing it lives on the
          Contactpersonen ("Contact persons") sub-tab (the "make primary" star). */}
      <LocationContactSection
        primaryContact={primaryContact}
        legacyName={l.contactName ?? ''} legacyEmail={l.email ?? ''} legacyPhone={l.phone ?? ''}
        onOpenContact={id => onGoToContacts(id)}
        onPickContact={() => onGoToContacts()}
        contacts={contacts} customerId={customerId} locationId={l.id as Id} onAddContact={onAddContact} />

      {/* Mirrors the Bedrijf tab exactly — description right after the contact block.
          K3/K4c: same second-screen icon + Koios generate the customer/department
          description already have — 'location' is a known /ai/koios/generate entity
          and a standalone GET/PATCH /locations/{id} route backs the pop-out window. */}
      <EditableRichTextField label={t('locations.detail.description')} value={l.description ?? ''} onSave={saveDescription}
        popout={l.id != null ? { entity: 'customer', id: l.id as Id, field: 'locationText' } : undefined}
        assistGenerate={l.id != null ? { entity: 'location', id: String(l.id) } : undefined} />

      {/* Koios advice — pure FE heuristics over this location's OWN completeness. */}
      <KoiosAdviceBlock namespace="customers" insights={buildLocationAdviceInsights(l, t)} />

      {/* Vestiging ("Branch") — which of OUR branches this site works under, and whether that is
          inherited from the customer or set here on purpose (LOCATIE-VESTIGING-1). */}
      <LocationBranchSection
        branchIds={l.branchIds} branches={l.branches}
        inherited={l.branchInherited} effectiveBranches={l.effectiveBranches}
        options={branchOptions}
        onChange={ids => onSave(l.id as Id, { branchIds: ids })} />
    </div>
  )
}
