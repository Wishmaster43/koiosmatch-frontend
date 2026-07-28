import { useTranslation } from 'react-i18next'
import CreatableSelect from '@/components/ui/CreatableSelect'
import EntityLink from '@/components/ui/EntityLink'
import { row, card, controls, dash, dateRange, makeFieldHelpers } from './detailsFieldKit'
import type { GeneralSection } from '../hooks/useVacancyDetailsForm'
import type { VacancyDetail } from '@/types/vacancy'

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
  const { select, twoDates } = makeFieldHelpers(form, setF, t)

  return card(t('details.groups.general'), <>
    {/* V13: Contractvorm — multi-value soft chips in read mode, toggle buttons in edit mode. */}
    {row(t('details.contractType'),
      types.length === 0 ? dash : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {types.map(val => { const m = typeMeta(val); return (
            <span key={val} style={{ fontSize: 11, fontWeight: 500, padding: '2px 9px', borderRadius: 999,
              background: m.color + '1A', color: m.color, border: `1px solid ${m.color}55` }}>{m.label}</span>
          ) })}
        </div>
      ),
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {candidateTypes.map(ct => {
          const on = types.includes(ct.value)
          return (
            <button key={ct.value} type="button" onClick={() => toggleType(ct.value)}
              style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12, cursor: 'pointer', fontWeight: on ? 600 : 400,
                background: on ? (ct.color ?? 'var(--color-primary)') + '1A' : 'var(--surface)',
                color: on ? (ct.color ?? 'var(--color-primary)') : 'var(--text-muted)',
                border: `1px solid ${on ? (ct.color ?? 'var(--color-primary)') + '55' : 'var(--border)'}` }}>{ct.label}</button>
          )
        })}
      </div>, editing)}
    {row(t('details.id'), <span style={{ color: 'var(--text-muted)' }}>{v.code || '—'}</span>, <span style={{ color: 'var(--text-muted)' }}>{v.code || '—'}</span>, editing)}
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
        survives a reload instead of silently evaporating. */}
    {row(t('details.customerLocation'), cascade.locationName || dash, locationPicker, editing)}
    {row(t('details.customerDepartment'), cascade.departmentName || dash, departmentPicker, editing)}
    {row(t('details.contactPerson'), cascade.contactName || dash, contactPicker, editing)}
    {row(t('details.function'), v.category || dash, select('category', fnOptions), editing)}
    {row(t('details.preferredIndustry'), v.industry || dash, select('industry', industries.map(i => ({ value: i, label: i }))), editing)}
  </>, controls(t, editing, save, cancel, () => setEditing(true)))
}
