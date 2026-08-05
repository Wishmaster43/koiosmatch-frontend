/**
 * Preferences + Freelance (ZZP) tabs — both schema-driven EditableFieldTables.
 *
 * Each field is still declared once with its `group`, and each sub-tab/section
 * below FILTERS that one field list by group — one source of truth, no
 * duplicated field definitions. Every EditableFieldTable instance is still
 * seeded from the SAME complete `value` object (so a draft never loses sight of
 * fields it doesn't render), but each section owns its OWN editing state (a
 * separate component instance) and its OWN narrow `onSave` that emits ONLY that
 * section's API keys (PREF-PENCIL-SPLIT-1, Danny 05-08 — the Financieel sub-tab
 * used to share one pencil/save across Loonheffing AND Gewenst tarief, the same
 * class of bug as VAC-DETAILS-SPLIT-1). ZzpTab's three blocks were already split
 * this way (28-07) and keep sending their full block payload — no bug there.
 */
import { useState } from 'react'
import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit2 } from 'lucide-react'
import EditableFieldTableJs from '@/components/forms/EditableFieldTable'
import SubTabBar from '@/components/drawer/SubTabBar'
import { useLookups } from '@/context/LookupsContext'
import { useDateFormat } from '@/lib/datetime'
import { useFunctions } from '@/lib/useFunctions'
import { useIndustries } from '@/lib/useIndustries'
import { useDriverLicenses } from '@/lib/useDriverLicenses'
import type { Candidate } from '@/types/candidate'

// Documented exception to the fieldRowCanon 120px label width (Danny 05-08 unify pass):
// this tab's labels include "Max. reisafstand (km)" / "Zakelijk e-mailadres" (~20+
// chars), which visibly wrap at 120px — kept wider, and unified to ONE value here
// (was inconsistently 160 on availability/travel/financial/other, 180 on the ZZP
// company/address/invoicing blocks in the same file — that internal drift is fixed
// even though the canon width itself is not adopted for this one tab).
const WIDE_LABEL_WIDTH = 150

type AnyProps = Record<string, unknown>
// EditableFieldTable is still untyped JS — accept any props at the boundary.
const EditableFieldTable = EditableFieldTableJs as unknown as ComponentType<AnyProps>

// Normalise a stored multi-value (array OR comma string) to a string[].
const toArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(String) : (v ? String(v).split(',').map(s => s.trim()).filter(Boolean) : [])

// Weekday slugs in ISO order; labels come from Intl so they stay locale-correct.
const DAY_SLUGS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

export function PreferencesTab({ c, onSave, onTypesChange, onEditStatus }: { c: Candidate; onSave?: (v: Record<string, unknown>) => void; onTypesChange?: (types: string[]) => void
  // Optional (Danny 2026-07-20, job A): reopens the status modal prefilled to edit
  // the current status's reason/return date. Only passed when the host (CandidateDrawer)
  // resolves the current status as reason/date-carrying — additive, no behaviour change
  // for callers that omit it.
  onEditStatus?: () => void }) {
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

  // One shared field schema, sliced per section below (each with its own Save).
  // Multi-value chips sit as rows within their group: Contractvorm/Dagen/Branche
  // under Beschikbaarheid, Rijbewijs under Reizen. Chips render as coloured soft
  // chips — Contractvorm keeps its per-value colours.
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
    // RATE-WISH-1: root fields on the candidate, not the preferences blob.
    desiredRateMin: (c as { desiredRateMin?: string }).desiredRateMin ?? '',
    desiredRateMax: (c as { desiredRateMax?: string }).desiredRateMax ?? '',
  }
  const fields = [
    { key: 'contractvorm',    label: t('drawer.candidateType'),      group: t('preferences.groupAvailability'), type: 'chips', chipOptions: candidateTypeOptions },
    { key: 'beschikbaar_per', label: t('preferences.availableFrom'), group: t('preferences.groupAvailability'), type: 'date' },
    { key: 'hoursPerWeek',   label: t('preferences.hoursPerWeek'),  group: t('preferences.groupAvailability'), inputType: 'number' },
    { key: 'dagen',           label: t('preferences.days'),          group: t('preferences.groupAvailability'), type: 'chips', chipOptions: dayOptions },
    { key: 'function',         label: t('preferences.function'),      group: t('preferences.groupAvailability'), type: 'creatable', options: functionOptions, allowCreate: allowFreeEntry },
    { key: 'branche',         label: t('preferences.sector'),        group: t('preferences.groupAvailability'), type: 'chips', chipOptions: industryOptions },
    { key: 'reisafstand',     label: t('preferences.maxDistance'),   group: t('preferences.groupTravel'), inputType: 'number' },
    { key: 'reistijd',        label: t('preferences.maxTravelTime'), group: t('preferences.groupTravel'), inputType: 'number' },
    { key: 'eigen_vervoer',   label: t('preferences.ownTransport'),  group: t('preferences.groupTravel'), type: 'checkbox' },
    { key: 'rijbewijs',       label: t('preferences.license'),       group: t('preferences.groupTravel'), type: 'chips', chipOptions: licenseOptions },
    { key: 'loonheffing',      label: t('preferences.wageTax'),       group: t('preferences.groupPayroll'), type: 'checkbox' },
    { key: 'loonheffing_vanaf', label: t('preferences.wageTaxFrom'),  group: t('preferences.groupPayroll'), type: 'date' },
    { key: 'desiredRateMin', label: t('preferences.desiredRateMin'), group: t('preferences.groupDesiredRate'), inputType: 'number', step: '0.01', mono: true },
    { key: 'desiredRateMax', label: t('preferences.desiredRateMax'), group: t('preferences.groupDesiredRate'), inputType: 'number', step: '0.01', mono: true },
    { key: 'remarks',     label: t('preferences.remarks'),       group: t('preferences.groupOther'), type: 'richtext' },
  ]
  // PREF-PENCIL-SPLIT-1 (05-08): one payload builder PER SECTION, each emitting
  // only the API keys its own card can edit — a Reizen save must never carry
  // Beschikbaarheid's keys along for the ride, even though `form` (the table's
  // internal draft) still holds the complete value object underneath. Contractvorm
  // stays routed separately to candidateTypes (never part of the preferences blob).
  const toApiAvailability = (v: Record<string, unknown>) => ({
    available_from: v.beschikbaar_per,
    hours_per_week: v.hoursPerWeek === '' ? null : Number(v.hoursPerWeek),
    preferred_days: v.dagen,
    function_pref:  v.function,
    sector_pref:    v.branche,
  })
  const toApiTravel = (v: Record<string, unknown>) => ({
    max_travel_km:      v.reisafstand === '' ? null : Number(v.reisafstand),
    max_travel_min:     v.reistijd === '' ? null : Number(v.reistijd),
    own_transport:      v.eigen_vervoer,
    license_categories: v.rijbewijs,
  })
  const toApiPayroll = (v: Record<string, unknown>) => ({
    wage_tax:      v.loonheffing,
    wage_tax_from: v.loonheffing_vanaf,
  })
  // RATE-WISH-1: root candidate fields, not part of the preferences blob — the
  // drawer's onSave wrapper splits desired_rate_min/max out into their own PATCH
  // keys (see CandidateDrawer), so sending just these two here is still one request.
  const toApiDesiredRate = (v: Record<string, unknown>) => ({
    desired_rate_min: v.desiredRateMin === '' ? null : Number(v.desiredRateMin),
    desired_rate_max: v.desiredRateMax === '' ? null : Number(v.desiredRateMax),
  })
  const toApiOther = (v: Record<string, unknown>) => ({ remarks: v.remarks })

  // One save handler per section, mirroring the payload builders above. Only
  // Beschikbaarheid also routes contractvorm to candidateTypes (its own field).
  const handleSaveAvailability = (v: Record<string, unknown>) => { onTypesChange?.((v.contractvorm as string[]) ?? []); onSave?.(toApiAvailability(v)) }
  const handleSaveTravel       = (v: Record<string, unknown>) => onSave?.(toApiTravel(v))
  const handleSavePayroll      = (v: Record<string, unknown>) => onSave?.(toApiPayroll(v))
  const handleSaveDesiredRate  = (v: Record<string, unknown>) => onSave?.(toApiDesiredRate(v))
  const handleSaveOther        = (v: Record<string, unknown>) => onSave?.(toApiOther(v))

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
  // un-headed card — same branch as ZzpTab's Facturatie below).
  //
  // Financieel is the one sub-tab that genuinely holds TWO distinct sections —
  // Loonheffing and Gewenst tarief — so it renders TWO stacked EditableFieldTables
  // (mirrors ZzpTab's Bedrijf/Adres/Facturatie blocks), each with its OWN title,
  // pencil and editing state. Before PREF-PENCIL-SPLIT-1 both groups lived inside
  // ONE EditableFieldTable, which drew two group headings under a single shared
  // pencil — editing Loonheffing silently flipped Gewenst tarief into edit mode too.
  const SUB_TABS = [
    { id: 'availability', label: t('preferences.groupAvailability') },
    { id: 'travel',       label: t('preferences.groupTravel') },
    { id: 'financial',    label: t('preferences.groupFinancial') },
    { id: 'other',        label: t('preferences.groupOther') },
  ]
  const [subTab, setSubTab] = useState('availability')
  const availabilityFields = fields.filter(f => f.group === t('preferences.groupAvailability')).map(f => ({ ...f, group: undefined }))
  const travelFields       = fields.filter(f => f.group === t('preferences.groupTravel')).map(f => ({ ...f, group: undefined }))
  const payrollFields      = fields.filter(f => f.group === t('preferences.groupPayroll')).map(f => ({ ...f, group: undefined }))
  const desiredRateFields  = fields.filter(f => f.group === t('preferences.groupDesiredRate')).map(f => ({ ...f, group: undefined }))
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
          <span style={{ flex: 1 }}>{statusWindow}</span>
          {/* Edit pencil (Danny 2026-07-20): reopen the status modal PREFILLED to fix
              a sick-note reason or change the return date — the status itself is untouched. */}
          {onEditStatus && (
            <button onClick={onEditStatus} title={t('drawer.editStatusReason')} aria-label={t('drawer.editStatusReason')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', color: 'inherit', opacity: 0.85, flexShrink: 0 }}>
              <Edit2 size={13} />
            </button>
          )}
        </div>
      )}
      <SubTabBar tabs={SUB_TABS} active={subTab} onChange={setSubTab} />
      {/* Each section is its OWN EditableFieldTable instance — its own pencil, its own
          editing state, its own narrow onSave (see the toApiXxx / handleSaveXxx
          builders above). On Save, Contractvorm goes to candidateTypes, the rest
          to preferences. Keys are SECTION-unique: the sub-tabs share one React slot,
          so a bare c.id key let the editing state survive a tab switch — pencil on
          Beschikbaarheid made Reizen arrive in edit mode (Danny 05-08). */}
      {subTab === 'availability' && <EditableFieldTable key={`${c.id}-availability`} fields={availabilityFields} value={value} labelWidth={WIDE_LABEL_WIDTH} onSave={handleSaveAvailability} />}
      {subTab === 'travel'       && <EditableFieldTable key={`${c.id}-travel`} fields={travelFields}       value={value} labelWidth={WIDE_LABEL_WIDTH} onSave={handleSaveTravel} />}
      {subTab === 'financial' && (
        // Two genuinely distinct sections sharing one sub-tab (see the comment above
        // SUB_TABS) — stacked with the canon gap-10, exactly like ZzpTab's blocks.
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <EditableFieldTable key={`${c.id}-payroll`} title={t('preferences.groupPayroll')}     fields={payrollFields}     value={value} labelWidth={WIDE_LABEL_WIDTH} onSave={handleSavePayroll} />
          <EditableFieldTable key={`${c.id}-rate`}    title={t('preferences.groupDesiredRate')} fields={desiredRateFields} value={value} labelWidth={WIDE_LABEL_WIDTH} onSave={handleSaveDesiredRate} />
        </div>
      )}
      {subTab === 'other'        && <EditableFieldTable key={`${c.id}-other`} fields={otherFields}        value={value} labelWidth={WIDE_LABEL_WIDTH} onSave={handleSaveOther} />}
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

  // ONE tab, three blocks — Bedrijf · Adres · Facturatie — each with its own pencil
  // and its own title ABOVE the card (Danny 28-07: "ZZP zonder sub tabjes, 3 potlootjes
  // per blokje en de txt erbuiten"). Same shape the Profiel tab now uses, and the same
  // reason: the sub-tab strip changed the layout when only the "one pencil flips
  // everything" behaviour had to go — and it discarded a draft on every switch.
  //
  // Each block gets the FULL `value` and the same `handleSave`, exactly as before: the
  // table hands back its whole form, so `toApi` still produces the identical request.
  // Editing Adres therefore never blanks Facturatie. The per-field `group` is cleared
  // because the block's own title above the card already names it — a second in-card
  // heading would just repeat it.
  const blockFields = (group: string) => fields.filter(f => f.group === group).map(f => ({ ...f, group: undefined }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <EditableFieldTable title={t('zzp.groupCompany')}   fields={blockFields(t('zzp.groupCompany'))}   value={value} labelWidth={WIDE_LABEL_WIDTH} onSave={handleSave} />
      <EditableFieldTable title={t('zzp.groupAddress')}   fields={blockFields(t('zzp.groupAddress'))}   value={value} labelWidth={WIDE_LABEL_WIDTH} onSave={handleSave} />
      <EditableFieldTable title={t('zzp.groupInvoicing')} fields={blockFields(t('zzp.groupInvoicing'))} value={value} labelWidth={WIDE_LABEL_WIDTH} onSave={handleSave} />
    </div>
  )
}
