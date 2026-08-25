/**
 * MatchProfileCard — point 18: an optional match-weight TEMPLATE picker
 * (StoreVacancyRequest/VacancyWriter snapshot it into `match_weights` server-side
 * on create) plus an optional "aanpassen" ("adjust") expansion with the same
 * per-dimension
 * sliders as the drawer's MatchingTab (shared MATCH_DIMENSIONS/buildMatchWeights,
 * never a second copy). Picking a template alone sends only
 * `match_weight_template_id`; touching a slider marks the weights an explicit
 * override — `match_weights` then rides alongside it, and explicit weights
 * always win server-side (never silently dropped by the template snapshot).
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Slider from '@/components/ui/Slider'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { cardBox } from '@/components/ui/modalCards'
// HUISSTIJL-1: the weight readout (JetBrains Mono) is the shared Mono atom.
import { Mono } from '@/components/ui/typography'
import { useMatchWeightTemplates } from '../hooks/useMatchWeightTemplates'
import { MATCH_DIMENSIONS, buildMatchWeights } from '../data/matchWeights'

interface Props {
  templateId: string
  onTemplateChange: (id: string) => void
  onWeightsChange: (weights: Record<string, number> | null) => void
}

export default function MatchProfileCard({ templateId, onTemplateChange, onWeightsChange }: Props) {
  const { t } = useTranslation(['vacancies', 'common'])
  const { templates, loading, error } = useMatchWeightTemplates()
  const [adjusting, setAdjusting] = useState(false)
  const [edited, setEdited] = useState(false)

  const templateWeights = templateId ? templates.find(x => String(x.id) === templateId)?.weights : undefined
  const [weights, setWeights] = useState<Record<string, number>>(() => buildMatchWeights(templateWeights))
  // Resync the displayed sliders to the newly picked template's snapshot — but
  // only until the recruiter actually edits a slider (an edit is a deliberate
  // override). Deliberately depends on templateId ONLY: `edited`/`templateWeights`
  // are read fresh via closure — including `templates` (or anything derived from
  // it) here would re-fire this effect whenever that list's reference churns (a
  // real risk — measured hang from an object-returning hook/mock that doesn't
  // memoize `data`) and setState in a tight loop.
  useEffect(() => {
    if (!edited) setWeights(buildMatchWeights(templateWeights))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId])

  // Picking a (different) template previews its snapshot and clears any prior override.
  const pickTemplate = (id: string) => { setEdited(false); onTemplateChange(id); onWeightsChange(null) }
  const setWeight = (d: string, val: number) => {
    const next = { ...weights, [d]: val }
    setWeights(next)
    setEdited(true)
    onWeightsChange(next)
  }

  // A+D layout (Danny 03-08): the heading now lives in the caller's CollapsedCard
  // title prop — this card renders only its own boxed body, no wrapper div.
  return (
    <div style={cardBox}>
      {/* Template picker — four explicit states, mirrors the drawer's MatchingTab. */}
      {loading ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('common:loading')}</div>
      ) : error ? (
        <div style={{ fontSize: 12, color: 'var(--color-danger-text)' }}>{t('matching.templatesError')}</div>
      ) : (
        <CreatableSelect value={templateId} onChange={pickTemplate} allowCreate={false}
          placeholder={t('matching.custom')}
          options={[{ value: '', label: t('matching.custom') }, ...templates.map(tpl => ({ value: String(tpl.id), label: tpl.name }))]} />
      )}
      {!loading && !error && templates.length === 0 && (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>{t('matching.noTemplates')}</p>
      )}

      <button type="button" onClick={() => setAdjusting(a => !a)}
        style={{ alignSelf: 'flex-start', fontSize: 11, fontWeight: 500, color: 'var(--color-primary-text)',
          background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        {adjusting ? t('matching.hideAdjust') : t('matching.adjust')}
      </button>

      {adjusting && MATCH_DIMENSIONS.map(d => (
        <div key={d}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text)' }}>{t(`matching.dim.${d}`)}</span>
            <Mono style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>
              {weights[d] ?? 3}/5
            </Mono>
          </div>
          {/* Slider is 0-based (0..4); stored weight is 1..5 (mirrors MatchingTab). */}
          <Slider value={(weights[d] ?? 3) - 1} max={4} step={1} onChange={(i: number) => setWeight(d, i + 1)}
            labels={[t('matching.less'), t('matching.balanced'), t('matching.very')]} ariaLabel={t(`matching.dim.${d}`)} />
        </div>
      ))}
    </div>
  )
}
