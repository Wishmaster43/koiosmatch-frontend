import type { ComponentType, CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit2, Save, X, Trash2, Plus } from 'lucide-react'
import CreatableSelect from '@/components/ui/CreatableSelect'
import RichTextEditorJs from '@/components/ui/RichTextEditor'
import SafeHtmlJs from '@/components/ui/SafeHtml'
import EntityLink from '@/components/ui/EntityLink'
import KoiosAdviceBlock from '@/components/ai/KoiosAdviceBlock'
import { buildVacancyAdviceInsights } from './vacancyAiInsights'
import { useVacancyDetailsForm, composeAddress } from '../hooks/useVacancyDetailsForm'
import type { TextKey } from '../hooks/useVacancyDetailsForm'
import type { VacancyDetail } from '@/types/vacancy'
import type { Id } from '@/types/common'

type AnyProps = Record<string, unknown>
const RichTextEditor = RichTextEditorJs as unknown as ComponentType<AnyProps>
const SafeHtml = SafeHtmlJs as unknown as ComponentType<AnyProps>

type UpdateFn = (id: Id | undefined, patch: Record<string, unknown>) => void

const inputStyle: CSSProperties = { width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', boxSizing: 'border-box', outline: 'none' }
const iconBtn: CSSProperties = { width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer' }
const blockStyle: CSSProperties = { borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)' }
const groupTitle: CSSProperties = { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 3 }

/**
 * DetailsTab — vacancy field grid, card layout only (audit R1 item 6: the form/
 * cascade/types/skills/save/cancel logic now lives in useVacancyDetailsForm —
 * this mirrors how VacanciesPage got useVacancyInsights; behaviour identical).
 * Mirrors the candidate ProfileTab. Contract type reuses the candidate
 * contract-forms lookup (multi-chips); function/industry come from the tenant
 * lookups; the address is structured (composed read, separate edit); experience
 * is a from–to range; the description uses the same rich editor as the profile
 * text. Skills stay a vertical list (edit/remove per row).
 */
export default function DetailsTab({ vacancy: v, onUpdate }: { vacancy: VacancyDetail; onUpdate?: UpdateFn }) {
  const { t } = useTranslation('vacancies')
  const {
    candidateTypes, typeMeta, seniorityLevels, educationLevels, industries, formatDate, fnOptions,
    editing, setEditing, form, setF, save, cancel,
    clientId, handleClientChange, customerOptions, cascade, locationPicker, departmentPicker, contactPicker,
    types, toggleType,
    skills, newSkill, setNewSkill, addSkill, removeSkill,
    descEditing, setDescEditing, descExpanded, setDescExpanded, description, setDescription, saveDesc, cancelDesc,
  } = useVacancyDetailsForm(v, onUpdate)

  // Edit-toggle control block (pencil ↔ save/cancel), reused for the field grid
  // and the description block (each with its own independent editing state).
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
  const card = (title: string, children: ReactNode) => (
    <div><div style={groupTitle}>{title}</div><div style={{ ...blockStyle, padding: '2px 12px' }}>{children}</div></div>
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
      {/* One edit toggle for the field grid — no duplicate "Details" heading (the tab
          bar already says it; Danny 2026-07-06). */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
        {controls(editing, save, cancel, () => setEditing(true))}
      </div>

      {/* Algemeen — V1: this card's heading ("Algemeen") is now the FIRST heading in
          the tab content (the tab itself keeps its "Details" id/label, §3A(d)-style
          separation of tab-chrome vs content). V13: Contractvorm moved in here — it
          used to float loose above this card. */}
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
      </>)}

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

      {/* Description — same rich editor as the candidate profile text (its own toggle). */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={groupTitle}>{t('details.description')}</span>
          {controls(descEditing, saveDesc, cancelDesc, () => setDescEditing(true),
            descEditing ? <button onClick={() => setDescription('')} title={t('common:remove')} style={{ ...iconBtn, background: 'none', color: 'var(--color-danger)', border: '1px solid var(--border)' }}><Trash2 size={13} /></button> : null)}
        </div>
        {descEditing
          ? <RichTextEditor value={description} onChange={setDescription} expanded={descExpanded} onToggleExpand={() => setDescExpanded(x => !x)} />
          : (v.description
              ? <div style={{ ...blockStyle, padding: '10px 12px', maxHeight: 220, overflow: 'auto' }}><SafeHtml html={v.description} style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }} /></div>
              : <div style={{ ...blockStyle, padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>—</div>)}
      </div>

      {/* Koios AI advisory — field completeness + open/applications flow (§3A blueprint). */}
      <KoiosAdviceBlock namespace="vacancies" insights={buildVacancyAdviceInsights(v, t)} />
    </div>
  )
}
