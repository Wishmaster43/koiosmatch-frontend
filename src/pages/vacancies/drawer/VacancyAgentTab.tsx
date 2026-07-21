import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { InterviewFlowSection } from '@/components/ai/management/InterviewFlowSection'
import { useAiAgents } from '../hooks/useAiAgents'
import type { VacancyDetail } from '@/types/vacancy'
import type { Id } from '@/types/common'

type UpdateFn = (id: Id | undefined, patch: Record<string, unknown>) => void

const groupTitle: CSSProperties = { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 6 }
const blockStyle: CSSProperties = { borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)' }

/**
 * VacancyAgentTab — its OWN tab (Danny 21-07, moved out of DetailsTab): the AI-agent
 * picker for this vacancy, and — once an agent is linked — the READ-ONLY interview
 * flow that agent carries (name/intro/statuses/dossier fields, via the shared
 * InterviewFlowSection). Linking an agent IS the interview on/off switch for this
 * vacancy (Option A: the agent carries its own flow, no separate flow field here).
 * Per-CANDIDATE interview progress/status lives on the APPLICATION, never here —
 * this tab only ever shows the interview's design/setup, never a status.
 */
export default function VacancyAgentTab({ vacancy: v, onUpdate }: { vacancy: VacancyDetail; onUpdate?: UpdateFn }) {
  const { t } = useTranslation('vacancies')
  // Own small fetch, always on (no shared edit/save chrome — a single field persists
  // immediately on change, mirroring MatchingTab's template picker).
  const { agents, options, loading, error } = useAiAgents(true)

  const currentId = v.aiAgentId != null ? String(v.aiAgentId) : ''
  const linkedAgent = currentId ? agents.find(a => String(a.id) === currentId) : undefined

  // Picking (or clearing to '') persists immediately — null unlinks (VAC-AGENT-1:
  // no separate flow field, the agent carries its own).
  const pickAgent = (id: string) => {
    const picked = agents.find(a => String(a.id) === id)
    onUpdate?.(v.id, { aiAgentId: id || null, aiAgentName: id ? (picked?.name ?? v.aiAgentName) : '' })
  }

  // Seed the currently linked agent's already-resolved name (from the vacancy detail
  // itself) as a fallback option, so the picker never flashes the raw id while the
  // separate /ai/agents list is still loading or the tenant list is out of sync.
  const selectOptions = [
    { value: '', label: t('aiagent.none') },
    ...(currentId && v.aiAgentName && !options.some(o => String(o.value) === currentId)
      ? [{ value: currentId, label: v.aiAgentName }] : []),
    ...options.map(o => ({ value: String(o.value), label: o.label })),
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Picker card — error state falls back to plain read-only text + notice, so the
          currently-linked agent stays visible even when the fresh list fails to load. */}
      <div>
        <div style={groupTitle}>{t('aiagent.pickerLabel')}</div>
        <div style={{ ...blockStyle, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {error ? (
            <>
              <span style={{ fontSize: 12, color: v.aiAgentName ? 'var(--text)' : 'var(--text-muted)' }}>{v.aiAgentName || t('aiagent.none')}</span>
              <span style={{ fontSize: 11, color: 'var(--color-danger)' }}>{t('aiagent.loadError')}</span>
            </>
          ) : (
            <>
              <CreatableSelect
                value={currentId || null}
                onChange={pickAgent}
                allowCreate={false}
                placeholder={loading ? t('common:loading') : t('aiagent.placeholder')}
                options={selectOptions}
              />
              {!loading && options.length === 0 && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('aiagent.empty')}</span>
              )}
            </>
          )}
          {/* Calm, honest note — per-candidate interview PROGRESS lives on the
              application, this tab only ever shows the interview's setup (§3). */}
          <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>{t('aiagent.explanation')}</p>
        </div>
      </div>

      {/* Interview flow the linked agent carries — read-only, shared component. */}
      <div>
        <div style={groupTitle}>{t('aiagent.flowTitle')}</div>
        {currentId ? (
          loading ? (
            <div style={{ ...blockStyle, padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>{t('common:loading')}</div>
          ) : (
            <InterviewFlowSection flow={linkedAgent?.interview_flow ?? null} />
          )
        ) : (
          <div style={{ ...blockStyle, padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>
            {t('aiagent.flowHint')}
          </div>
        )}
      </div>
    </div>
  )
}
