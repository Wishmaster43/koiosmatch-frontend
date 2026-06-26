/**
 * Preferences + Freelance (ZZP) tabs — both are schema-driven EditableFieldTables.
 */
import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import EditableFieldTableJs from '@/components/forms/EditableFieldTable'
import type { Candidate } from '@/types/candidate'

type AnyProps = Record<string, unknown>
// EditableFieldTable is still untyped JS — accept any props at the boundary.
const EditableFieldTable = EditableFieldTableJs as unknown as ComponentType<AnyProps>

export function PreferencesTab({ c, onSave }: { c: Candidate; onSave?: (v: Record<string, unknown>) => void }) {
  const { t } = useTranslation('candidates')
  const pref = c.preferences
  const value = {
    beschikbaar_per: pref.available_from ?? '',
    hoursPerWeek:   pref.hours_per_week ?? '',
    dagen:           pref.preferred_days ?? '',
    reisafstand:     pref.max_travel_km  ?? '',
    reistijd:        pref.max_travel_min ?? '',
    rijbewijs:       pref.has_license    ?? false,
    eigen_vervoer:   pref.own_transport  ?? false,
    function:         pref.function_pref  ?? '',
    branche:         pref.sector_pref    ?? '',
    min_tarief:      pref.min_rate       ?? '',
    contract:        pref.contract_pref  ?? '',
    remarks:     pref.remarks        ?? '',
  }
  const fields = [
    { key: 'beschikbaar_per', label: t('preferences.availableFrom'), group: t('preferences.groupAvailability'), type: 'date' },
    { key: 'hoursPerWeek',   label: t('preferences.hoursPerWeek'),  group: t('preferences.groupAvailability') },
    { key: 'dagen',           label: t('preferences.days'),          group: t('preferences.groupAvailability') },
    { key: 'reisafstand',     label: t('preferences.maxDistance'),   group: t('preferences.groupTravel') },
    { key: 'reistijd',        label: t('preferences.maxTravelTime'), group: t('preferences.groupTravel') },
    { key: 'rijbewijs',       label: t('preferences.license'),       group: t('preferences.groupTravel'), type: 'checkbox' },
    { key: 'eigen_vervoer',   label: t('preferences.ownTransport'),  group: t('preferences.groupTravel'), type: 'checkbox' },
    { key: 'function',         label: t('preferences.function'),      group: t('preferences.groupWork') },
    { key: 'branche',         label: t('preferences.sector'),        group: t('preferences.groupWork') },
    { key: 'min_tarief',      label: t('preferences.minRate'),       group: t('preferences.groupWork') },
    { key: 'contract',        label: t('preferences.contract'),      group: t('preferences.groupWork') },
    { key: 'remarks',     label: t('preferences.remarks'),       group: t('preferences.groupOther') },
  ]
  const toApi = (v: Record<string, unknown>) => ({
    available_from:  v.beschikbaar_per,
    hours_per_week:  v.hoursPerWeek,
    preferred_days:  v.dagen,
    max_travel_km:   v.reisafstand,
    max_travel_min:  v.reistijd,
    has_license:     v.rijbewijs,
    own_transport:   v.eigen_vervoer,
    function_pref:   v.function,
    sector_pref:     v.branche,
    min_rate:        v.min_tarief,
    contract_pref:   v.contract,
    remarks:         v.remarks,
  })
  return <EditableFieldTable title={t('preferences.title')} fields={fields} value={value} labelWidth={160} onSave={(v: Record<string, unknown>) => onSave?.(toApi(v))} />
}

export function ZzpTab({ c, onSave }: { c: Candidate; onSave?: (v: Record<string, unknown>) => void }) {
  const { t } = useTranslation('candidates')
  const zzp = c.zzp
  // Legacy fallbacks live on the flat candidate record (not on the typed model).
  const flat = c as unknown as Record<string, unknown>
  const value = {
    bedrijfsnaam:      zzp.company_name      ?? flat.company_name ?? '',
    kvk:               zzp.kvk_number        ?? flat.kvk          ?? '',
    btw:               zzp.vat_number        ?? flat.btw          ?? '',
    kor:               zzp.kor               ?? flat.kor          ?? false,
    intracommunautair: zzp.intracommunautair ?? false,
    straat:            zzp.street            ?? '',
    huisnummer:        zzp.house_number      ?? '',
    postcode:          zzp.postal_code       ?? '',
    plaats:            zzp.city              ?? '',
    land:              zzp.country           ?? '',
    crediteur:         zzp.creditor_number   ?? '',
    email_zakelijk:    zzp.business_email    ?? '',
    email_factuur:     zzp.invoice_email     ?? '',
    iban:              zzp.iban              ?? flat.iban         ?? '',
    self_billing:      zzp.self_billing      ?? false,
    betalingskorting:  zzp.payment_discount  ?? '0,00',
    bemiddelingskosten:zzp.mediation_costs   ?? '0,00',
    betaaltermijn:     zzp.payment_term      ?? '',
  }
  const fields = [
    { key: 'bedrijfsnaam',      label: t('zzp.companyName'),    group: t('zzp.groupCompany') },
    { key: 'kvk',               label: t('zzp.kvk'),            group: t('zzp.groupCompany') },
    { key: 'btw',               label: t('zzp.vat'),            group: t('zzp.groupCompany') },
    { key: 'kor',               label: t('zzp.kor'),            group: t('zzp.groupCompany'), type: 'checkbox' },
    { key: 'intracommunautair', label: t('zzp.intracommunity'), group: t('zzp.groupCompany'), type: 'checkbox' },
    { key: 'straat',            label: t('zzp.street'),         group: t('zzp.groupAddress') },
    { key: 'huisnummer',        label: t('zzp.houseNumber'),    group: t('zzp.groupAddress') },
    { key: 'postcode',          label: t('zzp.postalCode'),     group: t('zzp.groupAddress') },
    { key: 'plaats',            label: t('zzp.city'),           group: t('zzp.groupAddress') },
    { key: 'land',              label: t('zzp.country'),        group: t('zzp.groupAddress') },
    { key: 'crediteur',         label: t('zzp.creditor'),       group: t('zzp.groupInvoicing') },
    { key: 'email_zakelijk',    label: t('zzp.businessEmail'),  group: t('zzp.groupInvoicing'), inputType: 'email' },
    { key: 'email_factuur',     label: t('zzp.invoiceEmail'),   group: t('zzp.groupInvoicing'), inputType: 'email' },
    { key: 'iban',              label: t('zzp.iban'),           group: t('zzp.groupInvoicing') },
    { key: 'self_billing',      label: t('zzp.selfBilling'),    group: t('zzp.groupInvoicing'), type: 'checkbox' },
    { key: 'betalingskorting',  label: t('zzp.paymentDiscount'),group: t('zzp.groupPayment') },
    { key: 'bemiddelingskosten',label: t('zzp.mediationCosts'), group: t('zzp.groupPayment'), prefix: '€' },
    { key: 'betaaltermijn',     label: t('zzp.paymentTerm'),    group: t('zzp.groupPayment') },
  ]
  const toApi = (v: Record<string, unknown>) => ({
    company_name:      v.bedrijfsnaam,
    kvk_number:        v.kvk,
    vat_number:        v.btw,
    kor:               v.kor,
    intracommunautair: v.intracommunautair,
    street:            v.straat,
    house_number:      v.huisnummer,
    postal_code:       v.postcode,
    city:              v.plaats,
    country:           v.land,
    creditor_number:   v.crediteur,
    business_email:    v.email_zakelijk,
    invoice_email:     v.email_factuur,
    iban:              v.iban,
    self_billing:      v.self_billing,
    payment_discount:  v.betalingskorting,
    mediation_costs:   v.bemiddelingskosten,
    payment_term:      v.betaaltermijn,
  })
  return <EditableFieldTable title={t('zzp.title')} fields={fields} value={value} labelWidth={180} onSave={(v: Record<string, unknown>) => onSave?.(toApi(v))} />
}
