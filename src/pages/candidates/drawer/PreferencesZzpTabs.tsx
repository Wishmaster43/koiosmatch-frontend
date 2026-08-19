/**
 * PreferencesTab — schema-driven EditableFieldTables for the candidate's work
 * preferences sub-tabs.
 *
 * Each field is still declared once with its `group`, and each sub-tab/section
 * below FILTERS that one field list by group — one source of truth, no
 * duplicated field definitions. Every EditableFieldTable instance is still
 * seeded from the SAME complete `value` object (so a draft never loses sight of
 * fields it doesn't render), but each section owns its OWN editing state (a
 * separate component instance) and its OWN narrow `onSave` that emits ONLY that
 * section's API keys (PREF-PENCIL-SPLIT-1, Danny 05-08 — the Financieel sub-tab
 * used to share one pencil/save across Loonheffing AND Gewenst tarief, the same
 * class of bug as VAC-DETAILS-SPLIT-1).
 *
 * ZzpTab moved to its own file (§3 ~400-line split trigger, Danny 05-08 points
 * 1.1.1-1.1.5 pushed this file over it) — re-exported below so CandidateDrawer's
 * existing `import { PreferencesTab, ZzpTab } from './drawer/PreferencesZzpTabs'`
 * keeps working unchanged. See ZzpTab.tsx for its own file header; its three
 * blocks now save SEPARATELY (Bedrijf/Adres/Facturatie each narrower than before),
 * not as one shared full-payload save.
 */
import { useState } from 'react'
import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit2 } from 'lucide-react'
import EditableFieldTableJs from '@/components/forms/EditableFieldTable'
import SubTabBar from '@/components/drawer/SubTabBar'
import { useLookups } from '@/context/LookupsContext'
import { useDateFormat } from '@/lib/datetime'
import { useIndustries } from '@/lib/useIndustries'
import { useDriverLicenses } from '@/lib/useDriverLicenses'
import type { DriverLicenseItem } from '@/lib/useDriverLicenses'
import LookupIcon from '@/components/ui/LookupIcon'
import SoftChip from '@/components/ui/SoftChip'
import EmergencyContactCard from './EmergencyContactCard'
import type { EmergencyContactValues } from './EmergencyContactCard'
import BankAccountCard from './BankAccountCard'
import type { BankAccountValues } from './BankAccountCard'
import NoticePeriodHint from './NoticePeriodHint'
import type { Candidate } from '@/types/candidate'

// Documented exception to the fieldRowCanon 120px label width (Danny 05-08 unify pass):
// this tab's labels include "Max. reisafstand (km)" / "Zakelijk e-mailadres" (~20+
// chars), which visibly wrap at 120px — kept wider, and unified to ONE value here
// (was inconsistently 160 on availability/travel/financial/other, 180 on the ZZP
// company/address/invoicing blocks in the same file — that internal drift is fixed
// even though the canon width itself is not adopted for this one tab).
// Exported: ZzpTab.tsx (its own file now) shares this exact width.
export const WIDE_LABEL_WIDTH = 150

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
  const { industries } = useIndustries() as { industries: string[] }
  // LOOKUP-ICON-1: useDriverLicenses now returns full {value,label,icon} objects
  // (was string[]) — keep the icon around so licenseOptions/renderValue below can
  // pass it to LookupIcon, mirroring last-contact's icon passthrough.
  const { licenses } = useDriverLicenses() as { licenses: DriverLicenseItem[] }
  // Contract forms (colour + icon per value) for the first chip row.
  const { candidateTypes, statusMeta } = useLookups() as unknown as { candidateTypes: Array<{ value: string; label: string; color?: string; icon?: string | null }>; statusMeta: (v?: string | null) => { label: string; color: string } }
  const pref = c.preferences

  // Chip/dropdown option lists from the tenant lookups (never hardcoded vocab).
  // Capitalised, locale-aware weekday labels (2024-01-01 is a Monday).
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  const dayOptions = DAY_SLUGS.map((value, i) => ({ value, label: cap(new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(new Date(2024, 0, 1 + i))) }))
  const industryOptions = industries.map(name => ({ value: name, label: name }))
  const licenseOptions = licenses.map(l => ({ value: l.value, label: l.label }))
  // Read-mode-only icon lookup by value (the shared ChipMultiSelect/EditableFieldTable
  // chip shape has no icon slot — LOOKUP-ICON-1 renders it via a custom renderValue
  // instead of touching that shared component).
  const licenseIconOf = (value: string) => licenses.find(l => l.value === value)?.icon

  // One shared field schema, sliced per section below (each with its own Save).
  // Multi-value chips sit as rows within their group: Contractvorm/Dagen/Branche
  // under Beschikbaarheid, Rijbewijs under Reizen. Chips render as coloured soft
  // chips — Contractvorm keeps its per-value colours.
  const candidateTypeOptions = candidateTypes.map(ct => ({ value: ct.value, label: ct.label, color: ct.color }))
  // LOOKUP-ICON-1: read-mode-only icon lookup by value (mirrors licenseIconOf
  // above) — the shared ChipMultiSelect/EditableFieldTable chip shape has no
  // icon slot, so the read view overrides via `renderValue` instead.
  const candidateTypeIconOf = (value: string) => candidateTypes.find(ct => ct.value === value)?.icon
  const value = {
    contractvorm:    c.candidateTypes ?? [],
    beschikbaar_per: pref.available_from ?? '',
    hoursPerWeek:   pref.hours_per_week ?? '',
    dagen:           toArray(pref.preferred_days),
    branche:         toArray(pref.sector_pref),
    reisafstand:     pref.max_travel_km  ?? '',
    reistijd:        pref.max_travel_min ?? '',
    eigen_vervoer:   pref.own_transport  ?? false,
    rijbewijs:       toArray(pref.license_categories),
    loonheffing:       pref.wage_tax       ?? false,
    loonheffing_vanaf: pref.wage_tax_from  ?? '',
    // KAND-OPZEGTERMIJN-1: notice period towards the current employer, in weeks —
    // part of Beschikbaarheid since Danny punt 9 (see the field schema below).
    noticePeriodWeeks: pref.notice_period_weeks ?? '',
    remarks:     pref.remarks        ?? '',
    // RATE-WISH-1: root fields on the candidate, not the preferences blob.
    desiredRateMin: (c as { desiredRateMin?: string }).desiredRateMin ?? '',
    desiredRateMax: (c as { desiredRateMax?: string }).desiredRateMax ?? '',
  }
  // KAND-NOODCONTACT-1 / NOODCONTACT-SPLIT-1 (2026-08-08): third-party PII — its
  // OWN small value object, read straight off the preferences blob rather than
  // folded into the shared `value` above, because EmergencyContactCard owns its
  // own local draft/error state (see its file header) instead of going through
  // the schema-driven EditableFieldTable like every other field on this tab.
  // Split name/phone/mobile + relation-by-id, verified live against the backend
  // contract (see EmergencyContactCard.tsx's own header) — the OLD single
  // `emergency_contact_name` / free-text `emergency_contact_relation` fields no
  // longer exist server-side.
  const emergencyContactValue: EmergencyContactValues = {
    firstName:  (pref.emergency_contact_first_name  as string) ?? '',
    middleName: (pref.emergency_contact_middle_name as string) ?? '',
    lastName:   (pref.emergency_contact_last_name   as string) ?? '',
    phone:      (pref.emergency_contact_phone       as string) ?? '',
    mobile:     (pref.emergency_contact_mobile      as string) ?? '',
    relationId: (pref.emergency_contact_relation_id as string) ?? '',
    // Nested {id,label} (KAND-NIVEAU-1 pattern) — read mode's fallback label.
    relationLabel: (pref.emergency_contact_relation as { label?: string } | null | undefined)?.label ?? '',
  }
  // BANK-1 (Danny 2026-08-09, "Financieel — bankrekeningnummer en naam van
  // rekeningnummer"): the PRIVATE salary account — ROOT candidate fields, not
  // part of the preferences blob (same split as desiredRate* above). Its own
  // small value object because BankAccountCard owns its own draft/edit state
  // (mirrors EmergencyContactCard) instead of going through EditableFieldTable.
  const bankAccountValue: BankAccountValues = {
    iban:              (c as { iban?: string }).iban ?? '',
    accountHolderName: (c as { accountHolderName?: string }).accountHolderName ?? '',
  }
  const fields = [
    // LOOKUP-ICON-1: renderValue overrides ONLY the read-mode chip row (edit mode
    // keeps the generic ChipMultiSelect) — each contract-form chip gets its
    // tenant-set icon in front of the label, mirroring the rijbewijs pattern below.
    { key: 'contractvorm',    label: t('drawer.candidateType'),      group: t('preferences.groupAvailability'), type: 'chips', chipOptions: candidateTypeOptions,
      renderValue: (v: unknown) => {
        const arr = (Array.isArray(v) ? v : []).map(String)
        if (arr.length === 0) return <span style={{ color: 'var(--text-muted)' }}>-</span>
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {arr.map(x => {
              const opt = candidateTypeOptions.find(o => o.value === x)
              const col = opt?.color
              const icon = candidateTypeIconOf(x)
              // SoftChip — the ONE chip component (§4, HUISSTIJL-1). Per-value colour
              // when set (e.g. contract forms), else the primary accent — mirrors
              // EditableFieldTable's own default chip-read style.
              return (
                <SoftChip key={x} color={col ?? 'var(--color-primary)'} round label={
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {icon && <LookupIcon icon={icon} size={11} color={col} />}
                    {opt?.label ?? x}
                  </span>
                } />
              )
            })}
          </div>
        )
      } },
    { key: 'beschikbaar_per', label: t('preferences.availableFrom'), group: t('preferences.groupAvailability'), type: 'date' },
    // KAND-OPZEGTERMIJN-2 (Danny 2026-08-08, punt 9): the notice period sits DIRECTLY
    // under "Inzetbaar vanaf" instead of in its own Overig card — they are one thing
    // (X weeks' notice = deployable in X weeks), and NoticePeriodHint below makes that
    // relation explicit. Same card, same pencil, same save as the rest of Beschikbaarheid.
    { key: 'noticePeriodWeeks', label: t('preferences.noticePeriodWeeks'), group: t('preferences.groupAvailability'), inputType: 'number' },
    { key: 'hoursPerWeek',   label: t('preferences.hoursPerWeek'),  group: t('preferences.groupAvailability'), inputType: 'number' },
    { key: 'dagen',           label: t('preferences.days'),          group: t('preferences.groupAvailability'), type: 'chips', chipOptions: dayOptions },
    { key: 'branche',         label: t('preferences.sector'),        group: t('preferences.groupAvailability'), type: 'chips', chipOptions: industryOptions },
    { key: 'reisafstand',     label: t('preferences.maxDistance'),   group: t('preferences.groupTravel'), inputType: 'number' },
    { key: 'reistijd',        label: t('preferences.maxTravelTime'), group: t('preferences.groupTravel'), inputType: 'number' },
    { key: 'eigen_vervoer',   label: t('preferences.ownTransport'),  group: t('preferences.groupTravel'), type: 'checkbox' },
    // LOOKUP-ICON-1: renderValue overrides ONLY the read-mode chip row (edit mode
    // keeps the generic ChipMultiSelect) — each chip gets its tenant-set icon
    // (lucide slug or emoji) in front of the label, same pattern as the candidate
    // table's last-contact icon.
    { key: 'rijbewijs',       label: t('preferences.license'),       group: t('preferences.groupTravel'), type: 'chips', chipOptions: licenseOptions,
      renderValue: (v: unknown) => {
        const arr = (Array.isArray(v) ? v : []).map(String)
        if (arr.length === 0) return <span style={{ color: 'var(--text-muted)' }}>-</span>
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {arr.map(x => {
              const icon = licenseIconOf(x)
              return (
                <span key={x} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 500,
                  background: 'var(--color-primary-bg)', color: 'var(--color-primary-text)', border: '1px solid var(--color-primary)' }}>
                  {icon && <LookupIcon icon={icon} size={11} />}
                  {x}
                </span>
              )
            })}
          </div>
        )
      } },
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
    // KAND-OPZEGTERMIJN-2: moved in from its own section — both keys are accepted by
    // PATCH /candidates/{id} inside the preferences blob (verified live 2026-08-08).
    notice_period_weeks: v.noticePeriodWeeks === '' ? null : Number(v.noticePeriodWeeks),
    hours_per_week: v.hoursPerWeek === '' ? null : Number(v.hoursPerWeek),
    preferred_days: v.dagen,
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
  // Beschikbaarheid is CONTROLLED (see availEditing below), so its save also has to
  // leave edit mode — the table only does that for itself when uncontrolled.
  const handleSaveAvailability   = (v: Record<string, unknown>) => { setAvailEditing(false); onTypesChange?.((v.contractvorm as string[]) ?? []); onSave?.(toApiAvailability(v)) }
  const handleSaveTravel         = (v: Record<string, unknown>) => onSave?.(toApiTravel(v))
  const handleSavePayroll        = (v: Record<string, unknown>) => onSave?.(toApiPayroll(v))
  const handleSaveDesiredRate    = (v: Record<string, unknown>) => onSave?.(toApiDesiredRate(v))
  const handleSaveOther          = (v: Record<string, unknown>) => onSave?.(toApiOther(v))
  // KAND-OPZEGTERMIJN-2: taking over the suggested date persists exactly ONE key —
  // it is a proposal accepted by the recruiter, never a silent recalculation (§3).
  const handleApplyDerivedDate   = (isoDate: string) => onSave?.({ available_from: isoDate })
  // BANK-1: BankAccountCard already emits the exact API keys (iban /
  // account_holder_name) — a thin pass-through, like the emergency-contact one
  // below. The drawer's own onSave wrapper lifts both out of the preferences
  // blob into root PATCH keys (see CandidateDrawer).
  const handleSaveBankAccount = (v: Record<string, unknown>) => onSave?.(v)
  // EmergencyContactCard already builds the exact API shape itself (own local
  // draft/validation, see its file header) — this handler is a thin pass-through,
  // kept as its own named function only for symmetry with the other sections.
  const handleSaveEmergencyContact = (v: Record<string, unknown>) => onSave?.(v)

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
  // Financieel is the one sub-tab that genuinely holds SEVERAL distinct sections —
  // Loonheffing, Bankrekening (BANK-1) and Gewenst tarief — so it renders stacked
  // cards (mirrors ZzpTab's Bedrijf/Adres/Facturatie blocks), each with its OWN
  // title, pencil and editing state. Before PREF-PENCIL-SPLIT-1 both groups lived
  // inside ONE EditableFieldTable, which drew two group headings under a single
  // shared pencil — editing Loonheffing silently flipped Gewenst tarief into edit
  // mode too.
  const SUB_TABS = [
    { id: 'availability', label: t('preferences.groupAvailability') },
    { id: 'travel',       label: t('preferences.groupTravel') },
    { id: 'financial',    label: t('preferences.groupFinancial') },
    { id: 'other',        label: t('preferences.groupOther') },
  ]
  const [subTab, setSubTab] = useState('availability')
  // KAND-OPZEGTERMIJN-2: Beschikbaarheid's edit cycle is CONTROLLED here (the other
  // sections stay internally controlled). NoticePeriodHint sits outside the table but
  // writes the same field, so the hint must know whether a draft is open — a PATCH
  // landing behind an open draft would be wiped by that draft's own save.
  const [availEditing, setAvailEditing] = useState(false)
  // Switching sub-tab closes the availability draft, mirroring the remount-reset the
  // section-unique keys give the uncontrolled tables (EDIT-STATE-LEAK, Danny 05-08).
  const changeSubTab = (id: string) => { setSubTab(id); setAvailEditing(false) }
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
      <SubTabBar tabs={SUB_TABS} active={subTab} onChange={changeSubTab} />
      {/* Each section is its OWN EditableFieldTable instance — its own pencil, its own
          editing state, its own narrow onSave (see the toApiXxx / handleSaveXxx
          builders above). On Save, Contractvorm goes to candidateTypes, the rest
          to preferences. Keys are SECTION-unique: the sub-tabs share one React slot,
          so a bare c.id key let the editing state survive a tab switch — pencil on
          Beschikbaarheid made Reizen arrive in edit mode (Danny 05-08). */}
      {subTab === 'availability' && (
        // Beschikbaarheid = one card (Contractvorm · Inzetbaar vanaf · Opzegtermijn ·
        // Uren · Dagen · Branche) plus the derived-date hint underneath it. The hint
        // only offers its take-over button in READ mode — see availEditing above.
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <EditableFieldTable key={`${c.id}-availability`} fields={availabilityFields} value={value} labelWidth={WIDE_LABEL_WIDTH}
            editing={availEditing} onStartEdit={() => setAvailEditing(true)} onCancel={() => setAvailEditing(false)}
            onSave={handleSaveAvailability} />
          <NoticePeriodHint weeks={value.noticePeriodWeeks} availableFrom={value.beschikbaar_per}
            canApply={!availEditing} onApply={handleApplyDerivedDate} />
        </div>
      )}
      {subTab === 'travel'       && <EditableFieldTable key={`${c.id}-travel`} fields={travelFields}       value={value} labelWidth={WIDE_LABEL_WIDTH} onSave={handleSaveTravel} />}
      {subTab === 'financial' && (
        // Three genuinely distinct sections sharing one sub-tab (see the comment above
        // SUB_TABS) — stacked with the canon gap-10, exactly like ZzpTab's blocks.
        // BANK-1 puts Bankrekening directly under Loonheffing: both answer "how is
        // this person paid", while Gewenst tarief is a wish, not a payment fact.
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <EditableFieldTable key={`${c.id}-payroll`} title={t('preferences.groupPayroll')}     fields={payrollFields}     value={value} labelWidth={WIDE_LABEL_WIDTH} onSave={handleSavePayroll} />
          {/* DOC-BANK-1: bankDocumentId stays `undefined` (renders no slot) unless
              the server's financial.view gate actually returned the field. */}
          <BankAccountCard    key={`${c.id}-bank`}    value={bankAccountValue} onSave={handleSaveBankAccount}
            bankDocumentId={c.bankDocumentId} documents={c.documents ?? []} />
          <EditableFieldTable key={`${c.id}-rate`}    title={t('preferences.groupDesiredRate')} fields={desiredRateFields} value={value} labelWidth={WIDE_LABEL_WIDTH} onSave={handleSaveDesiredRate} />
        </div>
      )}
      {subTab === 'other' && (
        // Overig stacks TWO independently-editable cards — Noodcontact · Opmerkingen
        // (Opzegtermijn moved to Beschikbaarheid, Danny punt 9) — same
        // PREF-PENCIL-SPLIT-1 stacking as Financieel above: each owns its own
        // pencil/draft/save, so editing one never flips another into edit mode.
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <EmergencyContactCard key={`${c.id}-emergency`} value={emergencyContactValue} onSave={handleSaveEmergencyContact} />
          <EditableFieldTable key={`${c.id}-other`} fields={otherFields} value={value} labelWidth={WIDE_LABEL_WIDTH} onSave={handleSaveOther} />
        </div>
      )}
    </>
  )
}

// ZzpTab lives in its own file now (see the file header above) — re-exported so
// every existing `import { PreferencesTab, ZzpTab } from './drawer/PreferencesZzpTabs'`
// (CandidateDrawer.tsx) keeps resolving without a second, hand-edited import path.
export { ZzpTab } from './ZzpTab'
