import { useTranslation } from 'react-i18next'
import CreatableSelect from '@/components/ui/CreatableSelect'
import EntityLink from '@/components/ui/EntityLink'
import { row, card, controls, dash, dateRange, makeFieldHelpers } from './detailsFieldKit'
import type { GeneralSection } from '../hooks/useVacancyDetailsForm'
import type { VacancyDetail } from '@/types/vacancy'
import SoftChip from '@/components/ui/SoftChip'
import { tintBg, tintBorder } from '@/lib/tint'

interface Props {
  vacancy: VacancyDetail
  general: GeneralSection
  candidateTypes: Array<{ value: string; label: string; color?: string }>
  typeMeta: (v: string) => { label: string; color: string }
  industries: string[]
  fnOptions: Array<{ value: string; label: string }>
  formatDate: (d: string) => string
}

/**
 * DetailsGeneralTab — Algemeen sub-tab (VAC-DETAILS-SPLIT-1): contractvorm, id
 * (read-only), start/einddatum, klant → locatie → afdeling → contactpersoon
 * cascade, functie, voorkeursbranche. Its OWN pencil/save/cancel (`general.*`
 * from the hook) — flipping it never touches Locatie/Eisen/Voorwaarden's drafts.
 */
export default function DetailsGeneralTab({ vacancy: v, general, candidateTypes, typeMeta, industries, fnOptions, formatDate }: Props) {
  const { t } = useTranslation('vacancies')
  const { editing, setEditing, form, setF, save, cancel, types, toggleType,
    clientId, handleClientChange, customerOptions, cascade, locationPicker, departmentPicker, contactPicker } = general
  const { creatable, twoDates } = makeFieldHelpers(form, setF, t)

  return card(t('details.groups.general'), <>
    {/* V13: Contractvorm — multi-value soft chips in read mode, toggle buttons in edit mode. */}
    {row(t('details.contractType'),
      types.length === 0 ? dash : (
        // SoftChip — the ONE chip component (§4, HUISSTIJL-1).
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {types.map(val => { const m = typeMeta(val); return <SoftChip key={val} label={m.label} color={m.color} round /> })}
        </div>
      ),
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {candidateTypes.map(ct => {
          const on = types.includes(ct.value)
          const col = ct.color ?? 'var(--color-primary)'
          return (
            // Interactive toggle chip — stays a real <button> (SoftChip has no onClick),
            // but the tint now uses the house tintBg/tintBorder formula (§4, HUISSTIJL-1).
            <button key={ct.value} type="button" onClick={() => toggleType(ct.value)}
              style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12, cursor: 'pointer', fontWeight: on ? 600 : 400,
                background: on ? tintBg(col, true) : 'var(--surface)',
                color: on ? col : 'var(--text-muted)',
                border: on ? tintBorder(col, true) : '1px solid var(--border)' }}>{ct.label}</button>
          )
        })}
      </div>, editing)}
    {/* V7 (Danny vacatures-ronde): the Vacature-ID row (`v.code`) is removed —
        it duplicated the reference number, which already renders in the drawer
        title row (VacancyDrawer.tsx's ReferenceNumberChip) and stays there. */}
    {/* VAC-DATES-1: the vacancy's own runtime window — start_date AND end_date
        (validated after_or_equal:start_date server-side), paired half-row. */}
    {row(`${t('details.startDate')} / ${t('details.endDate')}`, dateRange(formatDate, v.startDate, v.endDate) || dash, twoDates('startDate', 'endDate'), editing)}
    {/* V3: client — searchable (was a plain <select>). Picking a different client
        resets the dependent locatie/afdeling/contactpersoon picks below. */}
    {row(t('drawer.client'),
      <EntityLink page="customers" id={v.clientId}>{v.clientName || '—'}</EntityLink>,
      <CreatableSelect value={clientId || null} onChange={handleClientChange} allowCreate={false}
        placeholder={t('drawer.selectClient')} options={customerOptions.map(c => ({ value: String(c.value), label: c.label }))} />, editing)}
    {/* V4-V6: locatie → afdeling → contactpersoon — optional, searchable cascade.
        VAC-CASCADE-1: the backend persists customer_location_id/customer_department_id/
        contact_id, so read-mode shows the saved name (or a dash) and the edit
        survives a reload instead of silently evaporating.
        Relatie-links cluster: each name links via EntityLink to the OWNING customer
        (page="customers", id=v.clientId) — same click-name/click-icon pattern as V3.
        Locations/departments/contacts have no top-level page/route of their own (they
        only live nested inside the customer drawer), so — same as the customers
        drawer's own ContactNameLink for this exact situation — the link cannot deep-jump
        to the specific sub-tab/record; it opens the correct customer record that holds
        it. Landing on the exact Locaties/Contactpersonen sub-tab needs NavigationContext/
        useDrawerUrl to carry a sub-tab + sub-id intent, which is out of this cluster's
        scope (tracked as a follow-up, not a backend gap — see build notes). */}
    {row(t('details.customerLocation'),
      cascade.locationName ? <EntityLink page="customers" id={v.clientId}>{cascade.locationName}</EntityLink> : dash,
      locationPicker, editing)}
    {row(t('details.customerDepartment'),
      cascade.departmentName ? <EntityLink page="customers" id={v.clientId}>{cascade.departmentName}</EntityLink> : dash,
      departmentPicker, editing)}
    {row(t('details.contactPerson'),
      cascade.contactName ? <EntityLink page="customers" id={v.clientId}>{cascade.contactName}</EntityLink> : dash,
      contactPicker, editing)}
    {/* G35: function/industry now use the SAME searchable CreatableSelect as
        AddVacancyModal's GeneralCard (was a native <select> here, a different
        control for the same lookup data). */}
    {/* CLEAR-SWEEP (Danny 13-08): both fields are `sometimes|nullable` server-side
        (StoreVacancyRequest) — the clear cross is real, not decorative. */}
    {row(t('details.function'), v.category || dash, creatable('category', fnOptions, t('details.function')), editing)}
    {row(t('details.preferredIndustry'), v.industry || dash, creatable('industry', industries, t('details.preferredIndustry')), editing)}
  </>, controls(t, editing, save, cancel, () => setEditing(true)))
}
