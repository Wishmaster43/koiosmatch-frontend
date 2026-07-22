import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import api, { unwrap, unwrapList } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import Slider from '@/components/ui/Slider'
import CreatableSelect from '@/components/ui/CreatableSelect'
import SearchSelect from '@/components/ui/SearchSelect'
import { useConfirm } from '@/hooks/useConfirm'
import { useContractTypes } from '@/lib/useContractTypes'
import { useFunctions } from '@/lib/useFunctions'
import { largestRemainderPct } from '@/lib/pct'

// The six scoring dimensions (mirrors the backend App\Enums\MatchDimension, single
// source of truth there, and the vacancy Matching tab's picker). Duplicated here on
// purpose: MatchingTab.jsx lives under pages/vacancies, a different page's internals,
// and §2 forbids importing across page/feature boundaries — a shared lib/matching
// module is the natural follow-up if this ever drifts between the two screens.
const DIMENSIONS = ['qualifications', 'technical_fit', 'soft_skills', 'cultural_alignment', 'career_aspirations', 'location']

// Merge a stored weight set over the neutral default (3 = balanced) for a complete set.
const buildWeights = (w) => Object.fromEntries(DIMENSIONS.map(d => [d, Number((w ?? {})[d]) || 3]))

// Add/remove a value in a multi-select array (Soort dienstverband).
const toggleInArray = (arr, value) => (arr ?? []).includes(value) ? arr.filter(x => x !== value) : [...(arr ?? []), value]

const cardStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 8 }
const labelStyle = { fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }
const inputStyle = { padding: '6px 10px', fontSize: 13, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', outline: 'none', width: '100%', boxSizing: 'border-box' }

// Compact read-only preview of a template's six weights (row summary) — five ticks
// per dimension, filled up to the stored value, so the list is scannable at a glance.
function MiniWeightBars({ weights }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {DIMENSIONS.map(d => (
        <div key={d} title={d} style={{ display: 'flex', gap: 1 }}>
          {[1, 2, 3, 4, 5].map(n => (
            <span key={n} style={{ width: 4, height: 10, borderRadius: 1,
              background: n <= (weights[d] ?? 3) ? 'var(--color-primary)' : 'var(--border)' }} />
          ))}
        </div>
      ))}
    </div>
  )
}

/**
 * MatchTemplatesSettings — Settings → Matchprofielen (MATCH-TEMPLATE-1): CRUD for
 * reusable named match-weight presets consumed by the vacancy Matching tab's picker
 * (read-only there — see useMatchWeightTemplates). Assigning a template SNAPSHOTS its
 * weights onto a vacancy; editing a template here never touches an already-snapshotted
 * vacancy on its own (backend decision A) — after a save, when the template is still
 * linked to ≥1 vacancy, an explicit follow-up prompt offers to re-apply the new weights
 * onto every linked vacancy (POST …/apply {all_linked:true}), reporting {applied,
 * skipped}. Delete is blocked (409) while the template is still linked. Mirrors
 * CustomFieldsSettings' expand-card CRUD shape.
 */
export default function MatchTemplatesSettings() {
  const { t, i18n } = useTranslation(['settings', 'vacancies'])
  const dimLabel = (d) => t(`vacancies:matching.dim.${d}`)
  // Danny 22-07: "Soort dienstverband" now feeds from the tenant contract-type lookup
  // (searchable, multi-select) instead of the single-value /vacancy-employment-types
  // picker; "Functie" feeds from the candidate function lookup (searchable, single).
  // Neither is ever a hardcoded option list (§3B).
  const { options: contractTypeOptions } = useContractTypes()
  const { functions: functionOptions, allowFreeEntry } = useFunctions()

  const [templates, setTemplates] = useState([])
  // Four explicit UI states, no blank screen on failure.
  const [phase, setPhase] = useState('loading') // loading | error | ready
  const [expanded, setExpanded] = useState(null)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(null) // 'new' | template id | null
  const [editForms, setEditForms] = useState({})
  const [newForm, setNewForm] = useState({ name: '', weights: buildWeights(), contract_types: [], function_title: '' })
  const { confirm, dialog } = useConfirm()

  // Load templates (the default-assignment picker's lookups now come from the shared
  // useContractTypes/useFunctions hooks above, not a bespoke fetch here).
  useEffect(() => {
    api.get('/settings/match-weight-templates')
      .then(res => { setTemplates(unwrapList(res).rows); setPhase('ready') })
      .catch(() => setPhase('error'))
  }, [])

  const setEF = (id, k, v) => setEditForms(p => ({ ...p, [id]: { ...(p[id] ?? {}), [k]: v } }))

  // Open a template's edit card, seeded from its current stored values.
  const openEdit = (tpl) => {
    setEditForms(p => ({ ...p, [tpl.id]: {
      name: tpl.name, weights: buildWeights(tpl.weights),
      contract_types: tpl.contract_types ?? [], function_title: tpl.function_title ?? '',
    } }))
    setExpanded(tpl.id)
  }

  // Create a new template.
  const handleCreate = async () => {
    const name = newForm.name.trim()
    if (!name) return
    setSaving('new')
    try {
      const payload = { name, weights: newForm.weights, contract_types: newForm.contract_types, function_title: newForm.function_title.trim() || null }
      const res = await api.post('/settings/match-weight-templates', payload)
      setTemplates(p => [...p, unwrap(res)])
      setNewForm({ name: '', weights: buildWeights(), contract_types: [], function_title: '' })
      setAdding(false)
    } catch {
      notifyError(t('matchTemplatesSettings.saveFailed'))
    } finally { setSaving(null) }
  }

  // Save an edit, then — only when the template is still linked to ≥1 vacancy — offer
  // the explicit re-apply follow-up (Danny's requirement). A plain save never touches a
  // vacancy by itself (snapshot semantics, backend decision A); only a confirmed apply does.
  const handleSave = async (tpl) => {
    const form = editForms[tpl.id]
    if (!form?.name?.trim()) return
    setSaving(tpl.id)
    try {
      const payload = { name: form.name.trim(), weights: form.weights, contract_types: form.contract_types ?? [], function_title: (form.function_title ?? '').trim() || null }
      const res = await api.patch(`/settings/match-weight-templates/${tpl.id}`, payload)
      const updated = unwrap(res)
      setTemplates(p => p.map(x => x.id === tpl.id ? updated : x))
      setExpanded(null)
      const linked = updated.linked_vacancies_count ?? 0
      if (linked > 0) {
        confirm(t('matchTemplatesSettings.applyPrompt', { count: linked }), async () => {
          const applyRes = await api.post(`/settings/match-weight-templates/${tpl.id}/apply`, { all_linked: true })
          const { applied = [], skipped = [] } = applyRes.data ?? {}
          notifySuccess(t('matchTemplatesSettings.applyResult', { applied: applied.length, skipped: skipped.length }))
        })
      }
    } catch {
      notifyError(t('matchTemplatesSettings.saveFailed'))
    } finally { setSaving(null) }
  }

  // Delete — blocked while linked (409); the row is flagged so the disabled state sticks.
  const handleDelete = (tpl) => {
    if ((tpl.linked_vacancies_count ?? 0) > 0) return
    confirm(t('matchTemplatesSettings.confirmDelete', { name: tpl.name }), async () => {
      setSaving(tpl.id)
      try {
        await api.delete(`/settings/match-weight-templates/${tpl.id}`)
        setTemplates(p => p.filter(x => x.id !== tpl.id))
        if (expanded === tpl.id) setExpanded(null)
      } catch (e) {
        if (e?.response?.status === 409) {
          setTemplates(p => p.map(x => x.id === tpl.id ? { ...x, linked_vacancies_count: Math.max(1, x.linked_vacancies_count ?? 1) } : x))
          notifyError(t('matchTemplatesSettings.deleteBlocked'))
        } else {
          notifyError(t('matchTemplatesSettings.saveFailed'))
        }
      } finally { setSaving(null) }
    }, { danger: true })
  }

  // One slider editor, shared by the create card and every edit card.
  const renderWeightSliders = (weights, onChangeDim) => {
    // Danny 22-07: % shares that total exactly 100 across the six sliders, one decimal
    // so equal weights read equal (16,7 vs 16,6, not 17/16) — 100÷6 = 16,666…
    const pcts = largestRemainderPct(DIMENSIONS.map(d => weights?.[d] ?? 3), 1)
    const pctByDim = Object.fromEntries(DIMENSIONS.map((d, i) => [d, pcts[i]]))
    const fmtPct = (n) => n.toLocaleString(i18n.language, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {DIMENSIONS.map(d => (
        <div key={d}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--text)' }}>{dimLabel(d)}</span>
            {/* Danny 22-07: concrete 1..5 weight + its % share, next to the word labels. */}
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>
              {weights?.[d] ?? 3}/5 · {fmtPct(pctByDim[d])}%
            </span>
          </div>
          <Slider value={(weights?.[d] ?? 3) - 1} max={4} step={1}
            onChange={i => onChangeDim(d, i + 1)}
            labels={[t('vacancies:matching.less'), t('vacancies:matching.balanced'), t('vacancies:matching.very')]}
            ariaLabel={dimLabel(d)} />
        </div>
      ))}
    </div>
    )
  }

  // Soort dienstverband — searchable MULTI-select (Danny 22-07), fed from the tenant
  // contract-type lookup; optional, several values may be checked. Shared by the
  // create card and every edit card (selected/onToggle come from the caller's form).
  const renderContractTypesField = (selected, onToggle) => (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <label style={labelStyle}>{t('matchTemplatesSettings.employmentTypeLabel')}</label>
        <SearchSelect triggerLabel={t('matchTemplatesSettings.employmentTypeAdd')}
          options={contractTypeOptions} selected={selected ?? []} onToggle={onToggle} width={240} />
      </div>
      {(selected ?? []).length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {selected.map(v => {
            const label = contractTypeOptions.find(o => o.value === v)?.label ?? v
            return (
              <span key={v} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '3px 8px',
                borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}>
                {label}
                <button type="button" onClick={() => onToggle(v)} aria-label={t('common.remove')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, lineHeight: 1, fontSize: 14 }}>×</button>
              </span>
            )
          })}
        </div>
      ) : (
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('matchTemplatesSettings.employmentTypeNone')}</span>
      )}
    </div>
  )

  // Functie — searchable single-select (Danny 22-07), fed from the candidate function
  // lookup; the tenant free-entry toggle decides whether a new value can be typed in.
  const renderFunctionField = (value, onChange) => (
    <div>
      <label style={labelStyle}>{t('matchTemplatesSettings.functionTitleLabel')}</label>
      <CreatableSelect value={value || null} onChange={onChange} options={functionOptions}
        allowCreate={allowFreeEntry} placeholder={t('matchTemplatesSettings.functionTitlePlaceholder')} />
    </div>
  )

  if (phase === 'loading') return <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>{t('common.loading')}</div>
  if (phase === 'error') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 24, color: 'var(--color-danger)', fontSize: 13 }}>
        <AlertTriangle size={14} /> {t('matchTemplatesSettings.loadError')}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 680 }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{t('matchTemplatesSettings.title')}</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{t('matchTemplatesSettings.subtitle')}</p>
      </div>

      {/* Empty state — no templates yet and the create card isn't open. */}
      {templates.length === 0 && !adding && (
        <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          {t('matchTemplatesSettings.empty')}
        </div>
      )}

      {/* Template list — one expand card per template. */}
      {templates.map(tpl => {
        const isOpen = expanded === tpl.id
        const form = editForms[tpl.id] ?? {}
        const linked = tpl.linked_vacancies_count ?? 0
        return (
          <div key={tpl.id} style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text)' }}>{tpl.name}</div>
                <div style={{ marginTop: 4 }}><MiniWeightBars weights={buildWeights(tpl.weights)} /></div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap',
                background: linked > 0 ? 'var(--color-primary-bg)' : 'var(--hover-bg)',
                color: linked > 0 ? 'var(--color-primary)' : 'var(--text-muted)' }}>
                {t('matchTemplatesSettings.linkedCount', { count: linked })}
              </span>
              <button onClick={() => (isOpen ? setExpanded(null) : openEdit(tpl))}
                aria-label={`${isOpen ? t('common.close') : t('common.edit')}: ${tpl.name}`}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>

            {isOpen && (
              <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={labelStyle}>{t('matchTemplatesSettings.nameLabel')}</label>
                  <input value={form.name ?? ''} onChange={e => setEF(tpl.id, 'name', e.target.value)} style={inputStyle} />
                </div>

                {renderWeightSliders(form.weights, (d, val) => setEF(tpl.id, 'weights', { ...(form.weights ?? buildWeights()), [d]: val }))}

                {/* Optional default-assignment keys — auto-default a NEW vacancy of this
                    type/function onto this template when exactly one template matches. */}
                {renderContractTypesField(form.contract_types, v => setEF(tpl.id, 'contract_types', toggleInArray(form.contract_types, v)))}
                {renderFunctionField(form.function_title, v => setEF(tpl.id, 'function_title', v))}
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('matchTemplatesSettings.defaultAssignmentHint')}</p>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
                  <button onClick={() => handleDelete(tpl)} disabled={linked > 0 || saving === tpl.id}
                    title={linked > 0 ? t('matchTemplatesSettings.deleteBlocked') : undefined}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 12, borderRadius: 6,
                      border: '1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)',
                      background: linked > 0 ? 'var(--hover-bg)' : 'var(--color-danger-bg)',
                      color: linked > 0 ? 'var(--text-muted)' : 'var(--color-danger)', cursor: linked > 0 ? 'not-allowed' : 'pointer' }}>
                    <Trash2 size={12} /> {t('matchTemplatesSettings.delete')}
                  </button>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setExpanded(null)}
                      style={{ padding: '6px 14px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer' }}>
                      {t('common.cancel')}
                    </button>
                    <button onClick={() => handleSave(tpl)} disabled={saving === tpl.id || !form.name?.trim()}
                      style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: 'none', background: 'var(--color-primary)', color: 'white', cursor: 'pointer' }}>
                      {saving === tpl.id ? t('common.saving') : t('common.save')}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Add new template. */}
      {adding ? (
        <div style={cardStyle}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>{t('matchTemplatesSettings.nameLabel')} *</label>
              <input value={newForm.name} onChange={e => setNewForm(p => ({ ...p, name: e.target.value }))}
                placeholder={t('matchTemplatesSettings.namePlaceholder')} style={inputStyle} autoFocus />
            </div>

            {renderWeightSliders(newForm.weights, (d, val) => setNewForm(p => ({ ...p, weights: { ...p.weights, [d]: val } })))}

            {renderContractTypesField(newForm.contract_types, v => setNewForm(p => ({ ...p, contract_types: toggleInArray(p.contract_types, v) })))}
            {renderFunctionField(newForm.function_title, v => setNewForm(p => ({ ...p, function_title: v })))}
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('matchTemplatesSettings.defaultAssignmentHint')}</p>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setAdding(false)}
                style={{ padding: '6px 14px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer' }}>
                {t('common.cancel')}
              </button>
              <button onClick={handleCreate} disabled={!newForm.name.trim() || saving === 'new'}
                style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: 'none', background: 'var(--color-primary)', color: 'white', cursor: 'pointer' }}>
                {saving === 'new' ? t('common.saving') : t('matchTemplatesSettings.add')}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, borderRadius: 8,
                   border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
          <Plus size={14} /> {t('matchTemplatesSettings.add')}
        </button>
      )}
      {dialog}
    </div>
  )
}
