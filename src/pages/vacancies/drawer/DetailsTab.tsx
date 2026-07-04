import { useState } from 'react'
import type { ComponentType, CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit2, Save, X, Trash2, Plus } from 'lucide-react'
import { useLookups } from '@/context/LookupsContext'
import { useVacancyLookups } from '@/context/VacancyLookupsContext'
import { useIndustries } from '@/lib/useIndustries'
import { useFunctions } from '@/lib/useFunctions'
import { useCustomerOptions } from '../hooks/useCustomerOptions'
import RichTextEditorJs from '@/components/ui/RichTextEditor'
import SafeHtmlJs from '@/components/ui/SafeHtml'
import EntityLink from '@/components/ui/EntityLink'
import type { VacancyDetail } from '@/types/vacancy'
import type { Id } from '@/types/common'

type AnyProps = Record<string, unknown>
const RichTextEditor = RichTextEditorJs as unknown as ComponentType<AnyProps>
const SafeHtml = SafeHtmlJs as unknown as ComponentType<AnyProps>

type UpdateFn = (id: Id | undefined, patch: Record<string, unknown>) => void
type TextKey = 'category' | 'industry' | 'street' | 'houseNumber' | 'houseNumberSuffix' | 'postalCode' | 'city'
  | 'province' | 'experienceMin' | 'experienceMax' | 'seniority' | 'education' | 'salaryMin' | 'salaryMax' | 'hoursMin' | 'hoursMax'
type Form = Record<TextKey, string>

const inputStyle: CSSProperties = { width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', boxSizing: 'border-box', outline: 'none' }
const iconBtn: CSSProperties = { width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer' }
const blockStyle: CSSProperties = { borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)' }
const groupTitle: CSSProperties = { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 3 }

/**
 * DetailsTab — vacancy field grid, editable in place (one pencil toggles all
 * fields), mirroring the candidate ProfileTab. Contract type reuses the candidate
 * contract-forms lookup (multi-chips); function/industry come from the tenant
 * lookups; the address is structured (composed read, separate edit); experience is
 * a from–to range; the description uses the same rich editor as the profile text.
 * Skills stay read-only (their own list UX is a follow-up).
 */
export default function DetailsTab({ vacancy: v, onUpdate }: { vacancy: VacancyDetail; onUpdate?: UpdateFn }) {
  const { t } = useTranslation('vacancies')
  const { candidateTypes, typeMeta } = useLookups() as unknown as {
    candidateTypes: Array<{ value: string; label: string; color?: string }>
    typeMeta: (v: string) => { label: string; color: string }
  }
  const { seniorityLevels, educationLevels } = useVacancyLookups()
  const { industries } = useIndustries()
  const { functions } = useFunctions() as { functions: Array<string | { value: string; label?: string }> }

  const seedForm = (): Form => ({
    category: v.category, industry: v.industry,
    street: v.street, houseNumber: v.houseNumber, houseNumberSuffix: v.houseNumberSuffix, postalCode: v.postalCode, city: v.city, province: v.province,
    experienceMin: v.experienceMin, experienceMax: v.experienceMax, seniority: v.seniorityValue, education: v.educationValue,
    salaryMin: v.salaryMin, salaryMax: v.salaryMax, hoursMin: v.hoursMin, hoursMax: v.hoursMax,
  })
  const skillStr = (s: unknown): string => (typeof s === 'string' ? s : ((s as { name?: string; label?: string })?.name ?? (s as { label?: string })?.label ?? ''))
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Form>(seedForm)
  // Client moved here from the drawer header (P3: calm header, max status+owner pickers).
  const [clientId, setClientId] = useState<string>(String(v.clientId ?? ''))
  const [types, setTypes] = useState<string[]>(v.contractTypes ?? [])
  const [skills, setSkills] = useState<string[]>(() => (v.skills ?? []).map(skillStr).filter(Boolean))
  const [newSkill, setNewSkill] = useState('')
  const setF = (k: TextKey, val: string) => setForm(p => ({ ...p, [k]: val }))
  const toggleType = (val: string) => setTypes(p => p.includes(val) ? p.filter(x => x !== val) : [...p, val])
  const addSkill = () => { const s = newSkill.trim(); if (s && !skills.includes(s)) setSkills(p => [...p, s]); setNewSkill('') }
  const removeSkill = (s: string) => setSkills(p => p.filter(x => x !== s))

  // Description edits in its own block (rich text), like the candidate profile text.
  const [descEditing, setDescEditing] = useState(false)
  const [descExpanded, setDescExpanded] = useState(false)
  const [description, setDescription] = useState(v.description ?? '')

  // Customer options load only while editing (capped page, React Query).
  const customerOptions = useCustomerOptions(editing)

  const save = () => {
    const sen = seniorityLevels.find(s => s.value === form.seniority)
    const edu = educationLevels.find(e => e.value === form.education)
    const salary = [form.salaryMin, form.salaryMax].filter(Boolean).join(' – ')
    const hours  = [form.hoursMin, form.hoursMax].filter(Boolean).join(' – ')
    const location = composeAddress(form.street, form.houseNumber, form.houseNumberSuffix, form.postalCode, form.city)
    onUpdate?.(v.id, {
      // Client lives in Details now (header stays calm) — send the name too for optimistic UI.
      clientId, clientName: customerOptions.find(c => String(c.value) === clientId)?.label ?? v.clientName,
      contractTypes: types, category: form.category, industry: form.industry,
      street: form.street, houseNumber: form.houseNumber, houseNumberSuffix: form.houseNumberSuffix,
      postalCode: form.postalCode, city: form.city, province: form.province, location,
      experienceMin: form.experienceMin, experienceMax: form.experienceMax,
      seniorityValue: form.seniority, seniority: sen?.label ?? '', educationValue: form.education, education: edu?.label ?? '',
      salaryMin: form.salaryMin, salaryMax: form.salaryMax, hoursMin: form.hoursMin, hoursMax: form.hoursMax, salary, hours,
      skills,
    })
    setEditing(false)
  }
  const cancel = () => { setForm(seedForm()); setClientId(String(v.clientId ?? '')); setTypes(v.contractTypes ?? []); setSkills((v.skills ?? []).map(skillStr).filter(Boolean)); setNewSkill(''); setEditing(false) }
  const saveDesc = () => { onUpdate?.(v.id, { description }); setDescEditing(false) }
  const cancelDesc = () => { setDescription(v.description ?? ''); setDescEditing(false) }

  const fnOptions = functions.map(f => (typeof f === 'string' ? { value: f, label: f } : { value: f.value, label: f.label ?? f.value }))

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* One edit toggle for the field grid */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={groupTitle}>{t('drawer.tabs.details')}</span>
        {controls(editing, save, cancel, () => setEditing(true))}
      </div>

      {/* Contract type — multi-chips (same lookup as the candidate). */}
      <div>
        <div style={groupTitle}>{t('details.contractType')}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {editing ? candidateTypes.map(ct => {
            const on = types.includes(ct.value)
            return (
              <button key={ct.value} type="button" onClick={() => toggleType(ct.value)}
                style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12, cursor: 'pointer', fontWeight: on ? 600 : 400,
                  background: on ? (ct.color ?? 'var(--color-primary)') + '1A' : 'var(--surface)',
                  color: on ? (ct.color ?? 'var(--color-primary)') : 'var(--text-muted)',
                  border: `1px solid ${on ? (ct.color ?? 'var(--color-primary)') + '55' : 'var(--border)'}` }}>{ct.label}</button>
            )
          }) : (types.length === 0 ? dash : types.map(val => { const m = typeMeta(val); return (
            <span key={val} style={{ fontSize: 11, fontWeight: 500, padding: '2px 9px', borderRadius: 999,
              background: m.color + '1A', color: m.color, border: `1px solid ${m.color}55` }}>{m.label}</span>
          )}))}
        </div>
      </div>

      {card(t('details.groups.general'), <>
        {row(t('details.id'), <span style={{ color: 'var(--text-muted)' }}>{v.code || '—'}</span>, <span style={{ color: 'var(--text-muted)' }}>{v.code || '—'}</span>)}
        {row(t('drawer.client'),
          <EntityLink page="customers" id={v.clientId}>{v.clientName || '—'}</EntityLink>,
          <select value={clientId} onChange={e => setClientId(e.target.value)} style={inputStyle}>
            <option value="">{t('common:select')}</option>
            {customerOptions.map(c => <option key={String(c.value)} value={String(c.value)}>{c.label}</option>)}
          </select>)}
        {row(t('details.function'), v.category || dash, select('category', fnOptions))}
        {row(t('details.preferredIndustry'), v.industry || dash, select('industry', industries.map(i => ({ value: i, label: i }))))}
      </>)}

      {card(t('details.groups.location'), <>
        {row(t('details.address'), composeAddress(v.street, v.houseNumber, v.houseNumberSuffix, v.postalCode, v.city) || v.location || dash,
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 6 }}>{text('street', t('details.street'))}{text('houseNumber', t('details.houseNumber'))}{text('houseNumberSuffix', t('details.houseNumberSuffix'))}</div>
            <div style={{ display: 'flex', gap: 6 }}>{text('postalCode', t('details.postalCode'))}{text('city', t('details.city'))}</div>
          </div>)}
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

      {/* Required skills — vertical list, add/remove per row while editing. */}
      <div>
        <div style={groupTitle}>{t('details.skills')}</div>
        {skills.length === 0 && !editing ? (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('details.noSkills')}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {skills.map(s => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text)', padding: '6px 10px', ...blockStyle }}>
                <span style={{ flex: 1, minWidth: 0 }}>{s}</span>
                {editing && <button onClick={() => removeSkill(s)} title={t('common:remove')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }}><X size={13} /></button>}
              </div>
            ))}
          </div>
        )}
        {editing && (
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <input value={newSkill} onChange={e => setNewSkill(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addSkill() }}
              placeholder={t('details.addSkill')} style={{ ...inputStyle, flex: 1 }} />
            <button onClick={addSkill} title={t('details.addSkill')} style={{ ...iconBtn, background: 'var(--color-primary)', color: '#fff', border: 'none' }}><Plus size={14} /></button>
          </div>
        )}
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
    </div>
  )
}

// Compose a one-line address from the structured fields (street nr-suffix, postcode city).
function composeAddress(street: string, houseNumber: string, suffix: string, postalCode: string, city: string): string {
  return [
    [street, [houseNumber, suffix].filter(Boolean).join('-')].filter(Boolean).join(' '),
    [postalCode, city].filter(Boolean).join(' '),
  ].filter(s => s && s.trim()).join(', ')
}
