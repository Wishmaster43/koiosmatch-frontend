import { useState } from 'react'
import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { Save, Check } from 'lucide-react'
import SliderJs from '../../../components/ui/Slider'
import type { VacancyDetail } from '../../../types/vacancy'
import type { Id } from '../../../types/common'

type AnyProps = Record<string, unknown>
const Slider = SliderJs as unknown as ComponentType<AnyProps>

// The six scoring dimensions (= the backend match_weights keys), each int 1..5.
const DIMENSIONS = ['qualifications', 'technical_fit', 'soft_skills', 'cultural_alignment', 'career_aspirations', 'location']

/**
 * MatchingTab — per-vacancy AI matching weights: one slider per dimension (1..5)
 * saying how important it is for THIS vacancy. The AI weighs candidates with these
 * (feeds match_criteria[].weight). Saves to PATCH /vacancies/{id} { match_weights }.
 */
export default function MatchingTab({ vacancy: v, onUpdate }: { vacancy: VacancyDetail; onUpdate?: (id: Id | undefined, patch: Record<string, unknown>) => void }) {
  const { t } = useTranslation('vacancies')
  // Local weights, defaulting any missing dimension to 3 (balanced).
  const [weights, setWeights] = useState<Record<string, number>>(() => {
    const w = (v.matchWeights ?? {}) as Record<string, unknown>
    return Object.fromEntries(DIMENSIONS.map(d => [d, Number(w[d]) || 3]))
  })
  const [saved, setSaved] = useState(false)

  const setW = (d: string, val: number) => setWeights(p => ({ ...p, [d]: val }))
  const save = () => { onUpdate?.(v.id, { matchWeights: weights }); setSaved(true); setTimeout(() => setSaved(false), 1500) }

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
