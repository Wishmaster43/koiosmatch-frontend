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
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import type { ChangeEvent } from 'react'
import api, { unwrap, unwrapList } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import Slider from '@/components/ui/Slider'
import CreatableSelect from '@/components/ui/CreatableSelect'
import SearchSelect from '@/components/ui/SearchSelect'
import { useConfirm } from '@/hooks/useConfirm'
import { useContractTypes } from '@/lib/useContractTypes'
import { useFunctions } from '@/lib/useFunctions'
import { cardStyle, labelStyle, inputStyle, useSettingsListUiState } from './settingsListCardStyles'
import { Mono } from '@/components/ui/typography'
import EditorRowFooter from '@/components/ui/EditorRowFooter'
import AddFormFooter from '@/components/ui/AddFormFooter'
import AddCardTrigger from '@/components/ui/AddCardTrigger'
import ExpandableCardListItem from '../components/ExpandableCardListItem'

// The six scoring dimensions (mirrors the backend App\Enums\MatchDimension, single
// source of truth there, and the vacancy Matching tab's picker). Duplicated here on
// purpose: MatchingTab.jsx lives under pages/vacancies, a different page's internals,
// and §2 forbids importing across page/feature boundaries — a shared lib/matching
// module is the natural follow-up if this ever drifts between the two screens.
const DIMENSIONS = ['qualifications', 'technical_fit', 'soft_skills', 'cultural_alignment', 'career_aspirations', 'location'] as const
type Dimension = typeof DIMENSIONS[number]
type Weights = Record<Dimension, number>

// hand-written: the spec carries no 2xx schema for /settings/match-weight-templates —
// one named preset of the six dimension weights, plus its optional default-assignment
// keys and how many vacancies currently have it snapshotted.
interface MatchTemplate {
  id: string
  name: string
  weights: Partial<Weights>
  contract_types: string[]
  function_title: string | null
  linked_vacancies_count?: number
}

// One template's create/edit draft — same shape, contract_types/function_title never null while editing.
interface TemplateForm {
  name: string
  weights: Weights
  contract_types: string[]
  function_title: string
}

// Merge a stored weight set over the neutral default (3 = balanced) for a complete set.
const buildWeights = (w?: Partial<Weights> | null): Weights =>
  Object.fromEntries(DIMENSIONS.map(d => [d, Number((w ?? {})[d]) || 3])) as Weights

// Add/remove a value in a multi-select array (Soort dienstverband).
const toggleInArray = (arr: string[] | undefined, value: string): string[] =>
  (arr ?? []).includes(value) ? (arr ?? []).filter(x => x !== value) : [...(arr ?? []), value]

// Compact read-only preview of a template's six weights (row summary) — five ticks
// per dimension, filled up to the stored value, so the list is scannable at a glance.
function MiniWeightBars({ weights }: { weights: Weights }) {
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

// Match-weight template CRUD, rendering each dimension's weight as the small dot-bar built above.
export default function MatchTemplatesSettings() {
  const { t } = useTranslation(['settings', 'vacancies'])
  const dimLabel = (d: Dimension) => t(`vacancies:matching.dim.${d}`)
  // Danny 22-07: "Soort dienstverband" now feeds from the tenant contract-type lookup
  // (searchable, multi-select) instead of the single-value /vacancy-employment-types
  // picker; "Functie" feeds from the candidate function lookup (searchable, single).
  // Neither is ever a hardcoded option list (§3B).
  const { options: contractTypeOptions } = useContractTypes()
  const { functions: functionOptions, allowFreeEntry } = useFunctions()

  const [templates, setTemplates] = useState<MatchTemplate[]>([])
  // Four explicit UI states, no blank screen on failure.
  const [phase, setPhase] = useState<'loading' | 'error' | 'ready'>('loading')
  const { expanded, setExpanded, adding, setAdding, saving, setSaving, editForms, setEditForms } = useSettingsListUiState()
  const [newForm, setNewForm] = useState<TemplateForm>({ name: '', weights: buildWeights(), contract_types: [], function_title: '' })
  const { confirm, dialog } = useConfirm()

  // Load templates (the default-assignment picker's lookups now come from the shared
  // useContractTypes/useFunctions hooks above, not a bespoke fetch here).
  useEffect(() => {
    api.get('/settings/match-weight-templates')
      .then(res => { setTemplates(unwrapList<MatchTemplate>(res).rows); setPhase('ready') })
      .catch(() => setPhase('error'))
  }, [])

  const setEF = (id: string, k: keyof TemplateForm, v: TemplateForm[keyof TemplateForm]) =>
    setEditForms(p => ({ ...p, [id]: { ...((p[id] as TemplateForm | undefined) ?? {}), [k]: v } }))

  // Open a template's edit card, seeded from its current stored values.
  const openEdit = (tpl: MatchTemplate) => {
    setEditForms(p => ({ ...p, [tpl.id]: {
      name: tpl.name, weights: buildWeights(tpl.weights),
      contract_types: tpl.contract_types ?? [], function_title: tpl.function_title ?? '',
    } as TemplateForm }))
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
      setTemplates(p => [...p, unwrap<MatchTemplate>(res)])
      setNewForm({ name: '', weights: buildWeights(), contract_types: [], function_title: '' })
      setAdding(false)
    } catch {
      notifyError(t('matchTemplatesSettings.saveFailed'))
    } finally { setSaving(null) }
  }

  // Save an edit, then — only when the template is still linked to ≥1 vacancy — offer
  // the explicit re-apply follow-up (Danny's requirement). A plain save never touches a
  // vacancy by itself (snapshot semantics, backend decision A); only a confirmed apply does.
  const handleSave = async (tpl: MatchTemplate) => {
    const form = editForms[tpl.id] as TemplateForm | undefined
    if (!form?.name?.trim()) return
    setSaving(tpl.id)
    try {
      const payload = { name: form.name.trim(), weights: form.weights, contract_types: form.contract_types ?? [], function_title: (form.function_title ?? '').trim() || null }
      const res = await api.patch(`/settings/match-weight-templates/${tpl.id}`, payload)
      const updated = unwrap<MatchTemplate>(res)
      setTemplates(p => p.map(x => x.id === tpl.id ? updated : x))
      setExpanded(null)
      const linked = updated.linked_vacancies_count ?? 0
      if (linked > 0) {
        confirm(t('matchTemplatesSettings.applyPrompt', { count: linked }), async () => {
          const applyRes = await api.post(`/settings/match-weight-templates/${tpl.id}/apply`, { all_linked: true })
          const { applied = [], skipped = [] } = (applyRes.data ?? {}) as { applied?: unknown[]; skipped?: unknown[] }
          notifySuccess(t('matchTemplatesSettings.applyResult', { applied: applied.length, skipped: skipped.length }))
        })
      }
    } catch {
      notifyError(t('matchTemplatesSettings.saveFailed'))
    } finally { setSaving(null) }
  }

  // Delete — blocked while linked (409); the row is flagged so the disabled state sticks.
  const handleDelete = (tpl: MatchTemplate) => {
    if ((tpl.linked_vacancies_count ?? 0) > 0) return
    confirm(t('matchTemplatesSettings.confirmDelete', { name: tpl.name }), async () => {
      setSaving(tpl.id)
      try {
        await api.delete(`/settings/match-weight-templates/${tpl.id}`)
        setTemplates(p => p.filter(x => x.id !== tpl.id))
        if (expanded === tpl.id) setExpanded(null)
      } catch (e) {
        if ((e as { response?: { status?: number } })?.response?.status === 409) {
          setTemplates(p => p.map(x => x.id === tpl.id ? { ...x, linked_vacancies_count: Math.max(1, x.linked_vacancies_count ?? 1) } : x))
          notifyError(t('matchTemplatesSettings.deleteBlocked'))
        } else {
          notifyError(t('matchTemplatesSettings.saveFailed'))
        }
      } finally { setSaving(null) }
    }, { danger: true })
  }

  // One slider editor, shared by the create card and every edit card.
  const renderWeightSliders = (weights: Weights | undefined, onChangeDim: (d: Dimension, val: number) => void) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {DIMENSIONS.map(d => (
        <div key={d}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--text)' }}>{dimLabel(d)}</span>
            {/* Danny 22-07: concrete 1..5 weight, next to the word labels (no %-of-total —
                mirrors the vacancy Matching tab: it can't be both equal and sum to 100). */}
            <Mono style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>
              {weights?.[d] ?? 3}/5
            </Mono>
          </div>
          <Slider value={(weights?.[d] ?? 3) - 1} max={4} step={1}
            onChange={i => onChangeDim(d, i + 1)}
            labels={[t('vacancies:matching.less'), t('vacancies:matching.balanced'), t('vacancies:matching.very')]}
            ariaLabel={dimLabel(d)} />
        </div>
      ))}
    </div>
  )

  // Soort dienstverband — searchable MULTI-select (Danny 22-07), fed from the tenant
  // contract-type lookup; optional, several values may be checked. Shared by the
  // create card and every edit card (selected/onToggle come from the caller's form).
  const renderContractTypesField = (selected: string[] | undefined, onToggle: (v: string) => void) => (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <label style={labelStyle}>{t('matchTemplatesSettings.employmentTypeLabel')}</label>
        <SearchSelect triggerLabel={t('matchTemplatesSettings.employmentTypeAdd')}
          options={contractTypeOptions} selected={selected ?? []} onToggle={onToggle} width={240} />
      </div>
      {(selected ?? []).length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {(selected ?? []).map(v => {
            const label = contractTypeOptions.find(o => o.value === v)?.label ?? v
            return (
              <span key={v} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '3px 8px',
                borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}>
                {label}
                {/* eslint-disable huisstijlLegacy/no-restricted-syntax -- chip-remove icon, no fill/border/height of its own */}
                <button type="button" onClick={() => onToggle(v)} aria-label={t('common.remove')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, lineHeight: 1, fontSize: 14 }}>×</button>
                {/* eslint-enable huisstijlLegacy/no-restricted-syntax */}
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
  const renderFunctionField = (value: string | undefined, onChange: (v: string) => void) => (
    <div>
      <label style={labelStyle}>{t('matchTemplatesSettings.functionTitleLabel')}</label>
      <CreatableSelect value={value || null} onChange={onChange} options={functionOptions}
        allowCreate={allowFreeEntry} placeholder={t('matchTemplatesSettings.functionTitlePlaceholder')} />
    </div>
  )

  if (phase === 'loading') return <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>{t('common.loading')}</div>
  if (phase === 'error') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 24, color: 'var(--color-danger-text)', fontSize: 13 }}>
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
        const form = (editForms[tpl.id] as TemplateForm | undefined) ?? ({} as Partial<TemplateForm>)
        const linked = tpl.linked_vacancies_count ?? 0
        return (
          <ExpandableCardListItem
            key={tpl.id}
            item={tpl}
            isOpen={isOpen}
            onToggleOpen={() => (isOpen ? setExpanded(null) : openEdit(tpl))}
            headerContent={
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text)' }}>{tpl.name}</div>
                <div style={{ marginTop: 4 }}><MiniWeightBars weights={buildWeights(tpl.weights)} /></div>
                <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap',
                  background: linked > 0 ? 'var(--color-primary-bg)' : 'var(--hover-bg)',
                  // Text-colour accent uses the AA-contrast text token, not the raw brand primary.
                  color: linked > 0 ? 'var(--color-primary-text)' : 'var(--text-muted)' }}>
                  {t('matchTemplatesSettings.linkedCount', { count: linked })}
                </span>
              </div>
            }
            ariaLabel={`${isOpen ? t('common.close') : t('common.edit')}: ${tpl.name}`}
            footer={
              <EditorRowFooter
                onDelete={() => handleDelete(tpl)}
                deleteLabel={t('matchTemplatesSettings.delete')}
                deleteDisabled={linked > 0}
                deleteTitle={linked > 0 ? t('matchTemplatesSettings.deleteBlocked') : undefined}
                onCancel={() => setExpanded(null)}
                cancelLabel={t('common.cancel')}
                onSave={() => handleSave(tpl)}
                saveLabel={t('common.save')}
                savingLabel={t('common.saving')}
                saving={saving === tpl.id}
                saveDisabled={!form.name?.trim()}
              />
            }
          >
            <div>
              <label style={labelStyle}>{t('matchTemplatesSettings.nameLabel')}</label>
              <input value={form.name ?? ''} onChange={(e: ChangeEvent<HTMLInputElement>) => setEF(tpl.id, 'name', e.target.value)} style={inputStyle} />
            </div>

            {renderWeightSliders(form.weights, (d, val) => setEF(tpl.id, 'weights', { ...(form.weights ?? buildWeights()), [d]: val }))}

            {/* Optional default-assignment keys — auto-default a NEW vacancy of this
                type/function onto this template when exactly one template matches. */}
            {renderContractTypesField(form.contract_types, v => setEF(tpl.id, 'contract_types', toggleInArray(form.contract_types, v)))}
            {renderFunctionField(form.function_title, v => setEF(tpl.id, 'function_title', v))}
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('matchTemplatesSettings.defaultAssignmentHint')}</p>
          </ExpandableCardListItem>
        )
      })}

      {/* Add new template. */}
      {adding ? (
        <div style={cardStyle}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>{t('matchTemplatesSettings.nameLabel')} *</label>
              <input value={newForm.name} onChange={(e: ChangeEvent<HTMLInputElement>) => setNewForm(p => ({ ...p, name: e.target.value }))}
                placeholder={t('matchTemplatesSettings.namePlaceholder')} style={inputStyle} autoFocus />
            </div>

            {renderWeightSliders(newForm.weights, (d, val) => setNewForm(p => ({ ...p, weights: { ...p.weights, [d]: val } })))}

            {renderContractTypesField(newForm.contract_types, v => setNewForm(p => ({ ...p, contract_types: toggleInArray(p.contract_types, v) })))}
            {renderFunctionField(newForm.function_title, v => setNewForm(p => ({ ...p, function_title: v })))}
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('matchTemplatesSettings.defaultAssignmentHint')}</p>

            {/* DRY: this AddFormFooter/AddCardTrigger swap matches VacancyContentBlocksSettings/
                VacancyGenerationProfilesList — all three already reuse the shared atoms
                (AddFormFooter/AddCardTrigger); the remaining resemblance is consistent
                usage of those atoms with each screen's own fields between, not a body to extract. */}
            <AddFormFooter
              onCancel={() => setAdding(false)}
              cancelLabel={t('common.cancel')}
              onSubmit={handleCreate}
              submitLabel={t('matchTemplatesSettings.add')}
              savingLabel={t('common.saving')}
              saving={saving === 'new'}
              disabled={!newForm.name.trim()}
            />
          </div>
        </div>
      ) : (
        <AddCardTrigger onClick={() => setAdding(true)} label={t('matchTemplatesSettings.add')} />
      )}
      {dialog}
    </div>
  )
}
