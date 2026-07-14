import { useState, useEffect } from 'react'
import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { Save, Check, Info } from 'lucide-react'
import SliderJs from '@/components/ui/Slider'
import { useMatchWeightTemplates } from '../hooks/useMatchWeightTemplates'
import type { VacancyDetail } from '@/types/vacancy'
import type { Id } from '@/types/common'

type AnyProps = Record<string, unknown>
const Slider = SliderJs as unknown as ComponentType<AnyProps>

// The six scoring dimensions (= the backend match_weights keys), each int 1..5.
const DIMENSIONS = ['qualifications', 'technical_fit', 'soft_skills', 'cultural_alignment', 'career_aspirations', 'location']

// Merge a stored weight set over the neutral default (3 = balanced) for a complete set.
const buildWeights = (w: Record<string, unknown> | undefined): Record<string, number> =>
  Object.fromEntries(DIMENSIONS.map(d => [d, Number((w ?? {})[d]) || 3]))

const selectStyle = { width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)',
  background: 'var(--input-bg)', color: 'var(--text)', boxSizing: 'border-box', outline: 'none' } as const

/**
 * MatchingTab — the vacancy's per-dimension importance for the AI matcher: an
 * optional TEMPLATE picker (MATCH-TEMPLATE-1) above one slider per dimension (1..5).
 * Picking a template SNAPSHOTS its weights onto this vacancy (a copy, never a live
 * link — later template edits do not update this vacancy); a manual slider edit
 * afterwards is a normal weight override, same UX as before templates existed.
 * Templates themselves are managed in Settings (out of scope here; read-only list).
 * The GLOBAL matcher strictness lives in Settings → Vacancies → Matching
 * (/settings/matching); this is only the per-vacancy weight set. Saves to
 * PATCH /vacancies/{id} { match_weights } or { match_weight_template_id } — either
 * way the response's resolved weights + provenance are the source of truth
 * (see useVacancyRecord.updateVacancy).
 */
export default function MatchingTab({ vacancy: v, onUpdate }: { vacancy: VacancyDetail; onUpdate?: (id: Id | undefined, patch: Record<string, unknown>) => void }) {
  const { t } = useTranslation('vacancies')
  const { templates, loading: templatesLoading, error: templatesError } = useMatchWeightTemplates()

  // Local weights, resynced whenever the server's stored set changes (switching to
  // a different vacancy, or a fresh template-snapshot response) — the parent only
  // hands down a new object reference when the value actually changed.
  const [weights, setWeights] = useState<Record<string, number>>(() => buildWeights(v.matchWeights as Record<string, unknown>))
  useEffect(() => { setWeights(buildWeights(v.matchWeights as Record<string, unknown>)) }, [v.id, v.matchWeights])

  const [saved, setSaved] = useState(false)
  const setW = (d: string, val: number) => setWeights(p => ({ ...p, [d]: val }))
  const save = () => { onUpdate?.(v.id, { matchWeights: weights }); setSaved(true); setTimeout(() => setSaved(false), 1500) }

  // Assigning a template previews its weights immediately (optimistic); the PATCH
  // response reconciles both the weights and the provenance via the effect above.
  const pickTemplate = (templateId: string) => {
    if (!templateId) return
    const tpl = templates.find(x => String(x.id) === templateId)
    if (tpl) setWeights(buildWeights(tpl.weights))
    onUpdate?.(v.id, { matchWeightTemplateId: templateId })
  }

  // Provenance label — only shown while the linked template still exists.
  const basedOnName = v.matchWeightTemplateId
    ? templates.find(x => String(x.id) === String(v.matchWeightTemplateId))?.name
    : undefined

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{t('matching.title')}</div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('matching.subtitle')}</p>
        </div>
        <button onClick={save}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 14px', fontSize: 13, fontWeight: 500,
            borderRadius: 8, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
            background: saved ? 'var(--color-success)' : 'var(--color-primary)', color: 'white' }}>
          {saved ? <><Check size={13} /> {t('matching.saved')}</> : <><Save size={13} /> {t('matching.save')}</>}
        </button>
      </div>

      {/* Template picker (MATCH-TEMPLATE-1) — four explicit UI states: loading,
          error, empty (no templates configured yet) and the ready select. */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 6 }}>
          {t('matching.profile')}
        </div>
        {templatesLoading ? (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('common:loading')}</div>
        ) : templatesError ? (
          <div style={{ fontSize: 12, color: 'var(--color-danger)' }}>{t('matching.templatesError')}</div>
        ) : (
          <select value={v.matchWeightTemplateId ?? ''} onChange={e => pickTemplate(e.target.value)}
            aria-label={t('matching.profile')} style={selectStyle}>
            <option value="">{t('matching.custom')}</option>
            {templates.map(tpl => <option key={String(tpl.id)} value={String(tpl.id)}>{tpl.name}</option>)}
          </select>
        )}
        {!templatesLoading && !templatesError && templates.length === 0 && (
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{t('matching.noTemplates')}</p>
        )}
        {/* Snapshot semantics — say once that this is a copy, never a live link. */}
        <p style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
          <Info size={12} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{basedOnName ? `${t('matching.basedOn', { name: basedOnName })} ` : ''}{t('matching.snapshotHint')}</span>
        </p>
      </div>

      {DIMENSIONS.map(d => (
        <div key={d}>
          <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 6 }}>{t(`matching.dim.${d}`)}</div>
          {/* Slider is 0-based (0..4); stored weight is 1..5. */}
          <Slider value={(weights[d] ?? 3) - 1} max={4} step={1} onChange={(i: number) => setW(d, i + 1)}
            labels={[t('matching.less'), t('matching.balanced'), t('matching.very')]} ariaLabel={t(`matching.dim.${d}`)} />
        </div>
      ))}
    </div>
  )
}
