/**
 * Preferences + Freelance (ZZP) tabs — both schema-driven EditableFieldTables.
 *
 * Each field is still declared once with its `group`, and each sub-tab below
 * simply FILTERS that one field list by group — one source of truth, no
 * duplicated field definitions. Every EditableFieldTable instance is handed the
 * SAME full `value`/`onSave` (never a group-scoped slice): its internal draft is
 * seeded from the complete value object, so saving from any one sub-tab still
 * round-trips the whole preferences/zzp set, exactly like the single-table
 * layout before it (Danny kandidaten-ronde-2, punten D/E — layout-only, no field/
 * behaviour change).
 */
import { useState } from 'react'
import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import EditableFieldTableJs from '@/components/forms/EditableFieldTable'
import SubTabBar from '@/components/drawer/SubTabBar'
import { useLookups } from '@/context/LookupsContext'
import { useDateFormat } from '@/lib/datetime'
import { useFunctions } from '@/lib/useFunctions'
import { useIndustries } from '@/lib/useIndustries'
import { useDriverLicenses } from '@/lib/useDriverLicenses'
import type { Candidate } from '@/types/candidate'

type AnyProps = Record<string, unknown>
// EditableFieldTable is still untyped JS — accept any props at the boundary.
const EditableFieldTable = EditableFieldTableJs as unknown as ComponentType<AnyProps>

// Normalise a stored multi-value (array OR comma string) to a string[].
const toArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(String) : (v ? String(v).split(',').map(s => s.trim()).filter(Boolean) : [])

// Weekday slugs in ISO order; labels come from Intl so they stay locale-correct.
const DAY_SLUGS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

export function PreferencesTab({ c, onSave, onTypesChange }: { c: Candidate; onSave?: (v: Record<string, unknown>) => void; onTypesChange?: (types: string[]) => void }) {
  const { t } = useTranslation('candidates')
  const { locale, formatDate } = useDateFormat()
  const { functions, allowFreeEntry } = useFunctions() as { functions: string[]; allowFreeEntry: boolean }
  const { industries } = useIndustries() as { industries: string[] }
  const { licenses } = useDriverLicenses() as { licenses: string[] }
  // Contract forms (colour per value) for the first chip row.
  const { candidateTypes, statusMeta } = useLookups() as unknown as { candidateTypes: Array<{ value: string; label: string; color?: string }>; statusMeta: (v?: string | null) => { label: string; color: string } }
  const pref = c.preferences

  // Chip/dropdown option lists from the tenant lookups (never hardcoded vocab).
  // Capitalised, locale-aware weekday labels (2024-01-01 is a Monday).
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  const dayOptions = DAY_SLUGS.map((value, i) => ({ value, label: cap(new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(new Date(2024, 0, 1 + i))) }))
  const industryOptions = industries.map(name => ({ value: name, label: name }))
  const licenseOptions = licenses.map(name => ({ value: name, label: name }))
  // Keep an existing free-entry function value selectable even if it's not in the list.
  const fnValue = (pref.function_pref as string) ?? ''
  const functionOptions = fnValue && !functions.includes(fnValue) ? [fnValue, ...functions] : functions

  // One grouped table (one Save). Multi-value chips sit as rows within their group:
  // Contractvorm/Dagen/Branche under Beschikbaarheid, Rijbewijs under Reizen. Chips
  // render as coloured soft chips — Contractvorm keeps its per-value colours.
  const candidateTypeOptions = candidateTypes.map(ct => ({ value: ct.value, label: ct.label, color: ct.color }))
  const value = {
    contractvorm:    c.candidateTypes ?? [],
    beschikbaar_per: pref.available_from ?? '',
    hoursPerWeek:   pref.hours_per_week ?? '',
    dagen:           toArray(pref.preferred_days),
    function:         fnValue,
    branche:         toArray(pref.sector_pref),
    reisafstand:     pref.max_travel_km  ?? '',
    reistijd:        pref.max_travel_min ?? '',
    eigen_vervoer:   pref.own_transport  ?? false,
    rijbewijs:       toArray(pref.license_categories),
    loonheffing:       pref.wage_tax       ?? false,
    loonheffing_vanaf: pref.wage_tax_from  ?? '',
    remarks:     pref.remarks        ?? '',
  }
  const fields = [
    { key: 'contractvorm',    label: t('drawer.candidateType'),      group: t('preferences.groupAvailability'), type: 'chips', chipOptions: candidateTypeOptions },
    { key: 'beschikbaar_per', label: t('preferences.availableFrom'), group: t('preferences.groupAvailability'), type: 'date' },
    { key: 'hoursPerWeek',   label: t('preferences.hoursPerWeek'),  group: t('preferences.groupAvailability') },
    { key: 'dagen',           label: t('preferences.days'),          group: t('preferences.groupAvailability'), type: 'chips', chipOptions: dayOptions },
    { key: 'function',         label: t('preferences.function'),      group: t('preferences.groupAvailability'), type: 'creatable', options: functionOptions, allowCreate: allowFreeEntry },
    { key: 'branche',         label: t('preferences.sector'),        group: t('preferences.groupAvailability'), type: 'chips', chipOptions: industryOptions },
    { key: 'reisafstand',     label: t('preferences.maxDistance'),   group: t('preferences.groupTravel') },
    { key: 'reistijd',        label: t('preferences.maxTravelTime'), group: t('preferences.groupTravel') },
    { key: 'eigen_vervoer',   label: t('preferences.ownTransport'),  group: t('preferences.groupTravel'), type: 'checkbox' },
    { key: 'rijbewijs',       label: t('preferences.license'),       group: t('preferences.groupTravel'), type: 'chips', chipOptions: licenseOptions },
    { key: 'loonheffing',      label: t('preferences.wageTax'),       group: t('preferences.groupPayroll'), type: 'checkbox' },
    { key: 'loonheffing_vanaf', label: t('preferences.wageTaxFrom'),  group: t('preferences.groupPayroll'), type: 'date' },
    { key: 'remarks',     label: t('preferences.remarks'),       group: t('preferences.groupOther'), type: 'richtext' },
  ]
  // Preferences blob — Contractvorm is routed separately (to candidateTypes, not preferences).
  const toApi = (v: Record<string, unknown>) => ({
    available_from:  v.beschikbaar_per,
    hours_per_week:  v.hoursPerWeek,
    preferred_days:  v.dagen,
    function_pref:   v.function,
    sector_pref:     v.branche,
    max_travel_km:   v.reisafstand,
    max_travel_min:  v.reistijd,
    own_transport:   v.eigen_vervoer,
    license_categories: v.rijbewijs,
    wage_tax:        v.loonheffing,
    wage_tax_from:   v.loonheffing_vanaf,
    remarks:         v.remarks,
  })
  const handleSave = (v: Record<string, unknown>) => { onTypesChange?.((v.contractvorm as string[]) ?? []); onSave?.(toApi(v)) }

  // Sub-tabs (Danny kandidaten-ronde-2, punt D, updated): Beschikbaarheid · Reizen ·
  // Financieel · Overig — Danny named this exact order, NOT alphabetical (unlike
  // punten B/C). Each sub-tab filters the ONE `fields` list above by its existing
  // `group`. Financieel took over Loonheffing (was under Overig) — Overig is now
  // just Opmerkingen.
  //
  // Redundant group-card titles are stripped (Danny addendum 4 — a sub-tab whose
  // OWN bar already says e.g. "Beschikbaarheid" doesn't need a second
  // "BESCHIKBAARHEID" card title inside it): Beschikbaarheid/Reizen/Overig each
  // hold exactly one group that equals their own sub-tab label, so `group` is
  // cleared for their filtered rows (EditableFieldTable then renders one calm,
  // un-headed card — same branch as ZzpTab's Facturatie below). Financieel keeps
  // "Loonheffing" as a real, DISTINCT sub-section heading (it isn't the same text
  // as "Financieel"), which will read clearly once RATE-WISH-1 adds the second
  // (desired-rate) group next to it — see the seam comment in the render below.
  const SUB_TABS = [
    { id: 'availability', label: t('preferences.groupAvailability') },
    { id: 'travel',       label: t('preferences.groupTravel') },
    { id: 'financial',    label: t('preferences.groupFinancial') },
    { id: 'other',        label: t('preferences.groupOther') },
  ]
  const [subTab, setSubTab] = useState('availability')
  const availabilityFields = fields.filter(f => f.group === t('preferences.groupAvailability')).map(f => ({ ...f, group: undefined }))
  const travelFields       = fields.filter(f => f.group === t('preferences.groupTravel')).map(f => ({ ...f, group: undefined }))
  const financialFields    = fields.filter(f => f.group === t('preferences.groupPayroll'))
  const otherFields        = fields.filter(f => f.group === t('preferences.groupOther')).map(f => ({ ...f, group: undefined }))

  // Current unavailability window (status axis) — read-only next to "Inzetbaar vanaf"
  // (Danny 2026-07-06). Hidden for ARCHIVED candidates (Danny 2026-07-13): the
  // archive banner tells the real story, the sick/leave window is stale noise then.
  const fmt = (d?: string | null) => (d ? formatDate(d) : '')
  const statusWindow = !c.archived && (c.statusChangedAt || c.statusReturnDate) && c.status && c.status !== 'available'
    ? [
        c.statusChangedAt ? t('drawer.statusSince', { status: statusMeta(c.status).label, date: fmt(c.statusChangedAt) }) : statusMeta(c.status).label,
        c.statusReturnDate ? t('drawer.availableAgain', { date: fmt(c.statusReturnDate) }) : null,
      ].filter(Boolean).join(' · ')
    : null

  return (
    <>
      {statusWindow && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, padding: '7px 11px', fontSize: 12,
          borderRadius: 8, color: statusMeta(c.status).color,
          background: `color-mix(in srgb, ${statusMeta(c.status).color} 10%, transparent)`,
          border: `1px solid color-mix(in srgb, ${statusMeta(c.status).color} 30%, transparent)` }}>
          {statusWindow}
        </div>
      )}
      <SubTabBar tabs={SUB_TABS} active={subTab} onChange={setSubTab} />
      {/* One EditableFieldTable per sub-tab, all fed the SAME full value/onSave (see
          file comment) — on Save, Contractvorm → candidateTypes, the rest → preferences. */}
      {subTab === 'availability' && <EditableFieldTable key={c.id} fields={availabilityFields} value={value} labelWidth={160} onSave={handleSave} />}
      {subTab === 'travel'       && <EditableFieldTable key={c.id} fields={travelFields}       value={value} labelWidth={160} onSave={handleSave} />}
      {subTab === 'financial' && (
        <>
          <EditableFieldTable key={c.id} fields={financialFields} value={value} labelWidth={160} onSave={handleSave} />
          {/* SEAM (Danny kandidaten-ronde-2, punt D update — RATE-WISH-1): a second
              group card for "gewenst uurloon" (desired_rate_min/desired_rate_max,
              a paired VAN–TOT EUR range) belongs here once the backend ships it.
              As of 2026-07-18 the fields are only an open CMFE→CMBE ask
              (COORDINATION-LOG.md, not yet in openapi.yaml or the candidate
              model/resource — measured against the api repo) — no input renders
              for them yet (CLAUDE.md: never a fake affordance that doesn't
              persist). When the fields land: add
              `desiredRateMin`/`desiredRateMax` to `value` (from
              `pref.desired_rate_min`/`desired_rate_max`), two `type: 'text'`
              (or numeric) rows with `half: true` under a NEW
              `t('preferences.groupDesiredRate')` group in `fields`, map them in
              `toApi`, and add that group's key to `financialFields` above. */}
        </>
      )}
      {subTab === 'other'        && <EditableFieldTable key={c.id} fields={otherFields}        value={value} labelWidth={160} onSave={handleSave} />}
    </>
  )
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
    straat:            zzp.street            ?? '',
    huisnummer:        zzp.house_number      ?? '',
    postcode:          zzp.postal_code       ?? '',
    plaats:            zzp.city              ?? '',
    land:              zzp.country           ?? '',
    crediteur:         zzp.creditor_number   ?? '',
    email_zakelijk:    zzp.business_email    ?? '',
    iban:              zzp.iban              ?? flat.iban         ?? '',
  }
  const fields = [
    { key: 'bedrijfsnaam',      label: t('zzp.companyName'),    group: t('zzp.groupCompany') },
    { key: 'kvk',               label: t('zzp.kvk'),            group: t('zzp.groupCompany') },
    { key: 'btw',               label: t('zzp.vat'),            group: t('zzp.groupCompany') },
    { key: 'kor',               label: t('zzp.kor'),            group: t('zzp.groupCompany'), type: 'checkbox' },
    { key: 'straat',            label: t('zzp.street'),         group: t('zzp.groupAddress') },
    { key: 'huisnummer',        label: t('zzp.houseNumber'),    group: t('zzp.groupAddress') },
    { key: 'postcode',          label: t('zzp.postalCode'),     group: t('zzp.groupAddress') },
    { key: 'plaats',            label: t('zzp.city'),           group: t('zzp.groupAddress') },
    { key: 'land',              label: t('zzp.country'),        group: t('zzp.groupAddress') },
    { key: 'crediteur',         label: t('zzp.creditor'),       group: t('zzp.groupInvoicing') },
    { key: 'email_zakelijk',    label: t('zzp.businessEmail'),  group: t('zzp.groupInvoicing'), inputType: 'email' },
    { key: 'iban',              label: t('zzp.iban'),           group: t('zzp.groupInvoicing') },
  ]
  const toApi = (v: Record<string, unknown>) => ({
    company_name:      v.bedrijfsnaam,
    kvk_number:        v.kvk,
    vat_number:        v.btw,
    kor:               v.kor,
    street:            v.straat,
    house_number:      v.huisnummer,
    postal_code:       v.postcode,
    city:              v.plaats,
    country:           v.land,
    creditor_number:   v.crediteur,
    business_email:    v.email_zakelijk,
    iban:              v.iban,
  })
  const handleSave = (v: Record<string, unknown>) => onSave?.(toApi(v))

  // Sub-tabs (Danny kandidaten-ronde-2, punt E): Bedrijf · Facturatie — order as
  // named, not alphabetical. Bedrijf absorbs the company address cluster too
  // ("Adres hoort bij bedrijf", Danny's clarification) — Facturatie is Crediteur/
  // e-mail/IBAN, the only group left.
  //
  // Redundant group-card titles stripped (addendum 4): Bedrijf's OWN "Bedrijf"
  // group-card would repeat the sub-tab bar right above it, so only ITS rows lose
  // their `group` — Adres stays a genuine, distinct sub-section within Bedrijf.
  // Facturatie has just the one group (same text as its own sub-tab label), so it
  // loses its heading entirely — one calm, un-headed card, like Beschikbaarheid/Reizen.
  const SUB_TABS = [
    { id: 'company',   label: t('zzp.groupCompany') },
    { id: 'invoicing', label: t('zzp.groupInvoicing') },
  ]
  const [subTab, setSubTab] = useState('company')
  const companyFields   = fields
    .filter(f => f.group === t('zzp.groupCompany') || f.group === t('zzp.groupAddress'))
    .map(f => f.group === t('zzp.groupCompany') ? { ...f, group: undefined } : f)
  const invoicingFields = fields.filter(f => f.group === t('zzp.groupInvoicing')).map(f => ({ ...f, group: undefined }))

  return (
    <>
      <SubTabBar tabs={SUB_TABS} active={subTab} onChange={setSubTab} />
      {subTab === 'company'   && <EditableFieldTable fields={companyFields}   value={value} labelWidth={180} onSave={handleSave} />}
      {subTab === 'invoicing' && <EditableFieldTable fields={invoicingFields} value={value} labelWidth={180} onSave={handleSave} />}
    </>
  )
}
