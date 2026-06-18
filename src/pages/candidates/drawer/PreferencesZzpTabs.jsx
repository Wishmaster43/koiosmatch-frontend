/**
 * Preferences + Freelance (ZZP) tabs — both are schema-driven EditableFieldTables.
 */
import { useTranslation } from 'react-i18next'
import EditableFieldTable from '../../../components/forms/EditableFieldTable'

export function PreferencesTab({ c }) {
  const { t } = useTranslation('candidates')
  const pref = c.preferences ?? c.preferences ?? {}
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
    { key: 'beschikbaar_per', label: t('preferences.availableFrom') },
    { key: 'hoursPerWeek',   label: t('preferences.hoursPerWeek') },
    { key: 'dagen',           label: t('preferences.days') },
    { key: 'reisafstand',     label: t('preferences.maxDistance') },
    { key: 'reistijd',        label: t('preferences.maxTravelTime') },
    { key: 'rijbewijs',       label: t('preferences.license'),      type: 'checkbox' },
    { key: 'eigen_vervoer',   label: t('preferences.ownTransport'), type: 'checkbox' },
    { key: 'function',         label: t('preferences.function') },
    { key: 'branche',         label: t('preferences.sector') },
    { key: 'min_tarief',      label: t('preferences.minRate') },
    { key: 'contract',        label: t('preferences.contract') },
    { key: 'remarks',     label: t('preferences.remarks') },
  ]
  return <EditableFieldTable title={t('preferences.title')} fields={fields} value={value} labelWidth={160} onSave={() => {}} />
}

export function ZzpTab({ c }) {
  const { t } = useTranslation('candidates')
  const zzp = c.zzp ?? {}
  const value = {
    bedrijfsnaam:      zzp.company_name      ?? c.company_name ?? '',
    kvk:               zzp.kvk_number        ?? c.kvk          ?? '',
    btw:               zzp.vat_number        ?? c.btw          ?? '',
    kor:               zzp.kor               ?? c.kor          ?? false,
    intracommunautair: zzp.intracommunautair ?? false,
    straat:            zzp.street            ?? '',
    huisnummer:        zzp.house_number      ?? '',
    postcode:          zzp.postal_code       ?? '',
    plaats:            zzp.city              ?? '',
    land:              zzp.country           ?? '',
    crediteur:         zzp.creditor_number   ?? '',
    email_zakelijk:    zzp.business_email    ?? '',
    email_factuur:     zzp.invoice_email     ?? '',
    iban:              zzp.iban              ?? c.iban         ?? '',
    self_billing:      zzp.self_billing      ?? false,
    betalingskorting:  zzp.payment_discount  ?? '0,00',
    bemiddelingskosten:zzp.mediation_costs   ?? '0,00',
    betaaltermijn:     zzp.payment_term      ?? '',
  }
  const fields = [
    { key: 'bedrijfsnaam',      label: t('zzp.companyName') },
    { key: 'kvk',               label: t('zzp.kvk') },
    { key: 'btw',               label: t('zzp.vat') },
    { key: 'kor',               label: t('zzp.kor'),            type: 'checkbox' },
    { key: 'intracommunautair', label: t('zzp.intracommunity'), type: 'checkbox' },
    { key: 'straat',            label: t('zzp.street') },
    { key: 'huisnummer',        label: t('zzp.houseNumber') },
    { key: 'postcode',          label: t('zzp.postalCode') },
    { key: 'plaats',            label: t('zzp.city') },
    { key: 'land',              label: t('zzp.country') },
    { key: 'crediteur',         label: t('zzp.creditor') },
    { key: 'email_zakelijk',    label: t('zzp.businessEmail'), inputType: 'email' },
    { key: 'email_factuur',     label: t('zzp.invoiceEmail'),  inputType: 'email' },
    { key: 'iban',              label: t('zzp.iban') },
    { key: 'self_billing',      label: t('zzp.selfBilling'),    type: 'checkbox' },
    { key: 'betalingskorting',  label: t('zzp.paymentDiscount') },
    { key: 'bemiddelingskosten',label: t('zzp.mediationCosts'), prefix: '€' },
    { key: 'betaaltermijn',     label: t('zzp.paymentTerm') },
  ]
  return <EditableFieldTable title={t('zzp.title')} fields={fields} value={value} labelWidth={180} onSave={() => {}} />
}
