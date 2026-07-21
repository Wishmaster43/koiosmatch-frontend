import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit2, Save, X, Plus } from 'lucide-react'
import CreatableSelect from '@/components/ui/CreatableSelect'
import EntityLink from '@/components/ui/EntityLink'
import KoiosAdviceBlock from '@/components/ai/KoiosAdviceBlock'
import { buildVacancyAdviceInsights } from './vacancyAiInsights'
import { useVacancyDetailsForm, composeAddress } from '../hooks/useVacancyDetailsForm'
import type { TextKey } from '../hooks/useVacancyDetailsForm'
import type { VacancyDetail } from '@/types/vacancy'
import type { Id } from '@/types/common'

type UpdateFn = (id: Id | undefined, patch: Record<string, unknown>) => void

const inputStyle: CSSProperties = { width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', boxSizing: 'border-box', outline: 'none' }
const iconBtn: CSSProperties = { width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer' }
const blockStyle: CSSProperties = { borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)' }
const groupTitleText: CSSProperties = { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }
const groupTitle: CSSProperties = { ...groupTitleText, marginBottom: 3 }

/**
 * DetailsTab — vacancy field grid, card layout only (audit R1 item 6: the form/
 * cascade/types/skills/save/cancel logic lives in useVacancyDetailsForm — this
 * mirrors how VacanciesPage got useVacancyInsights; behaviour identical).
 * Danny 21-07: the sub-tab strip (Algemeen/Profiel/Koios-advies) is gone — "lelijk
 * en te druk" with a second tab bar under the drawer's own tabs. Every section now
 * stacks top-to-bottom in one flat scroll: Algemeen(+Locatie) → Profiel (functie-
 * eisen/voorwaarden/vaardigheden) → Koios-advies. Description moved OUT to its own
 * drawer main-tab (DescriptionTab). Mirrors the candidate ProfileTab otherwise:
 * contract type reuses the candidate contract-forms lookup (multi-chips);
 * function/industry come from the tenant lookups; the address is structured
 * (composed read, separate edit); experience is a from–to range. Skills stay a
 * vertical list (edit/remove per row).
 */
export default function DetailsTab({ vacancy: v, onUpdate }: { vacancy: VacancyDetail; onUpdate?: UpdateFn }) {
  const { t } = useTranslation('vacancies')
  const {
    candidateTypes, typeMeta, seniorityLevels, educationLevels, industries, formatDate, fnOptions,
    editing, setEditing, form, setF, save, cancel,
    clientId, handleClientChange, customerOptions, cascade, locationPicker, departmentPicker, contactPicker,
    types, toggleType,
    skills, newSkill, setNewSkill, addSkill, removeSkill,
  } = useVacancyDetailsForm(v, onUpdate)

  // Edit-toggle control block (pencil ↔ save/cancel) — governs the field grid
  // spread across the Algemeen + Profiel cards below (one shared `editing`/`form`
  // state from the hook). Danny 21-07: no separate potlood-row anymore — this sits
  // INSIDE the Algemeen card's title row instead (mirrors the description block's
  // own title-row control placement).
  const controls = (isEditing: boolean, onSave: () => void, onCancel: () => void, onStart: () => void, extra?: ReactNode) => isEditing ? (
    <div style={{ display: 'flex', gap: 4 }}>
      {extra}
      <button onClick={onSave} title={t('common:save')} style={{ ...iconBtn, background: 'var(--color-primary)', color: '#fff', border: 'none' }}><Save size={13} /></button>
      <button onClick={onCancel} title={t('common:cancel')} style={{ ...iconBtn, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}><X size={13} /></button>
    </div>
  ) : (
    <button onClick={onStart} title={t('common:edit')} style={{ ...iconBtn, background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)' }}><Edit2 size={13} /></button>
  )

  const select = (k: TextKey, options: { value: string; label: string }[]) => (
    <select value={form[k]} onChange={e => setF(k, e.target.value)} style={inputStyle}>
      <option value="">{t('common:select')}</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
  const text = (k: TextKey, placeholder?: string) => (
    <input value={form[k]} onChange={e => setF(k, e.target.value)} placeholder={placeholder} style={inputStyle} />
  )
  const row = (label: ReactNode, read: ReactNode, edit: ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 26, padding: '5px 0' }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 130, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--text)' }}>{editing ? edit : read}</div>
    </div>
  )
  const dash = <span style={{ color: 'var(--text-muted)' }}>-</span>
  // Card wrapper — `actions` (only passed for Algemeen) renders right-aligned in
  // the title row itself, so the edit pencil never needs its own empty band.
  const card = (title: string, children: ReactNode, actions?: ReactNode) => (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={groupTitleText}>{title}</span>
        {actions}
      </div>
      <div style={{ ...blockStyle, padding: '2px 12px' }}>{children}</div>
    </div>
  )
  const pair = (min: string, max: string, suffix?: string) => { const s = [min, max].filter(Boolean).join(' – '); return s ? `${s}${suffix ? ` ${suffix}` : ''}` : '' }
  const twoInputs = (a: TextKey, b: TextKey, pa: string, pb: string) => <div style={{ display: 'flex', gap: 6 }}>{text(a, pa)}{text(b, pb)}</div>
  // VAC-DATES-1: native date inputs (form values are already YYYY-MM-DD) paired
  // half-row, mirroring the houseNumber/houseNumberSuffix convention above.
  const dateInput = (k: TextKey) => <input type="date" value={form[k]} onChange={e => setF(k, e.target.value)} style={inputStyle} />
  const twoDates = (a: TextKey, b: TextKey) => <div style={{ display: 'flex', gap: 6 }}>{dateInput(a)}{dateInput(b)}</div>
  const dateRange = (a: string, b: string) => { const s = [a, b].filter(Boolean).map(d => formatDate(d)); return s.join(' – ') }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Algemeen — V1: this card's heading ("Algemeen") is the FIRST heading in the
          tab content. The shared edit pencil lives in ITS title row (Danny 21-07:
          "rode vlak kleiner" — no more standalone potlood-row above the cards); it
          still governs the Profiel fields below via the same `editing`/`form` state.
          V13: Contractvorm moved in here — it used to float loose above this card. */}
      {card(t('details.groups.general'), <>
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
          </div>)}
        {row(t('details.id'), <span style={{ color: 'var(--text-muted)' }}>{v.code || '—'}</span>, <span style={{ color: 'var(--text-muted)' }}>{v.code || '—'}</span>)}
        {/* VAC-DATES-1: the vacancy's own runtime window — start_date AND end_date
            (validated after_or_equal:start_date server-side), paired half-row like
            houseNumber/houseNumberSuffix below. */}
        {row(`${t('details.startDate')} / ${t('details.endDate')}`, dateRange(v.startDate, v.endDate) || dash, twoDates('startDate', 'endDate'))}
        {/* V3: client — searchable (was a plain <select>). Picking a different client
            resets the dependent locatie/afdeling/contactpersoon picks below. */}
        {row(t('drawer.client'),
          <EntityLink page="customers" id={v.clientId}>{v.clientName || '—'}</EntityLink>,
          <CreatableSelect value={clientId || null} onChange={handleClientChange} allowCreate={false}
            placeholder={t('drawer.selectClient')} options={customerOptions.map(c => ({ value: String(c.value), label: c.label }))} />)}
        {/* V4-V6: locatie → afdeling → contactpersoon — optional, searchable cascade.
            VAC-CASCADE-1: the backend persists customer_location_id/customer_department_id/
            contact_id, so read-mode shows the saved name (or a dash) and the edit
            survives a reload instead of silently evaporating. */}
        {row(t('details.customerLocation'), cascade.locationName || dash, locationPicker)}
        {row(t('details.customerDepartment'), cascade.departmentName || dash, departmentPicker)}
        {row(t('details.contactPerson'), cascade.contactName || dash, contactPicker)}
        {row(t('details.function'), v.category || dash, select('category', fnOptions))}
        {row(t('details.preferredIndustry'), v.industry || dash, select('industry', industries.map(i => ({ value: i, label: i }))))}
      </>, controls(editing, save, cancel, () => setEditing(true)))}

      {card(t('details.groups.location'), <>
        {/* V9: address — each field its own labelled row when editing (mirrors the
            candidate ProfileTab's address convention), instead of three inputs
            crammed onto one "Adres" row; read mode still shows one composed line. */}
        {editing ? (
          <>
            {row(t('details.street'), null, text('street'))}
            {row(`${t('details.houseNumber')} / ${t('details.houseNumberSuffix')}`, null, twoInputs('houseNumber', 'houseNumberSuffix', t('details.houseNumber'), t('details.houseNumberSuffix')))}
            {row(t('details.postalCode'), null, text('postalCode'))}
            {row(t('details.city'), null, text('city'))}
          </>
        ) : (
          row(t('details.address'), composeAddress(v.street, v.houseNumber, v.houseNumberSuffix, v.postalCode, v.city) || v.location || dash, null)
        )}
        {row(t('details.province'), v.province || dash, text('province'))}
      </>)}

      {card(t('details.groups.requirements'), <>
        {row(t('details.experience'), pair(v.experienceMin, v.experienceMax, t('details.years')) || dash, twoInputs('experienceMin', 'experienceMax', t('details.experienceFrom'), t('details.experienceTo')))}
        {row(t('details.seniority'), v.seniority || dash, select('seniority', seniorityLevels.map(s => ({ value: s.value, label: s.label }))))}
        {row(t('details.education'), v.education || dash, select('education', educationLevels.map(e => ({ value: e.value, label: e.label }))))}
      </>)}

      {/* Voorwaarden (salary/hours) — not explicitly named in the redesign brief;
          grouped here rather than under Algemeen/Koios-advies since it describes the
          job's terms alongside the other function requirements. */}
      {card(t('details.groups.conditions'), <>
        {row(t('details.salary'), pair(v.salaryMin, v.salaryMax) || v.salary || dash, twoInputs('salaryMin', 'salaryMax', 'min', 'max'))}
        {row(t('details.hours'), pair(v.hoursMin, v.hoursMax) || v.hours || dash, twoInputs('hoursMin', 'hoursMax', 'min', 'max'))}
      </>)}

      {/* Required skills — vertical list; quick-add/remove ALWAYS available (saves
          immediately outside edit-mode, rides the big Save inside it). */}
      <div>
        <div style={groupTitle}>{t('details.skills')}</div>
        {skills.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {skills.map(s => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text)', padding: '6px 10px', ...blockStyle }}>
                <span style={{ flex: 1, minWidth: 0 }}>{s}</span>
                <button onClick={() => removeSkill(s)} title={t('common:remove')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }}><X size={13} /></button>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <input value={newSkill} onChange={e => setNewSkill(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addSkill() }}
            placeholder={t('details.addSkill')} style={{ ...inputStyle, flex: 1 }} />
          <button onClick={addSkill} title={t('details.addSkill')} style={{ ...iconBtn, background: 'var(--color-primary)', color: '#fff', border: 'none' }}><Plus size={14} /></button>
        </div>
      </div>

      {/* Koios AI advisory — field completeness + open/applications flow (§3A blueprint). */}
      <KoiosAdviceBlock namespace="vacancies" insights={buildVacancyAdviceInsights(v, t)} />
    </div>
  )
}
