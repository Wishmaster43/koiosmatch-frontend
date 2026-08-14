import { useTranslation } from 'react-i18next'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { cardBox } from '@/components/ui/modalCards'
import KoiosSuggestionBadge from '@/components/ui/KoiosSuggestionBadge'
import { useAiAgents } from '../hooks/useAiAgents'

interface Props {
  agentId: string
  onAgentChange: (id: string) => void
  // Punt 20: true while `agentId` still holds the owner-derived proposal
  // (never after a manual pick/clear) — shows the shared Koios mark (§0).
  showSuggestion?: boolean
}

/**
 * AiAgentCard — punt 19: links the AI-interview agent this vacancy will use
 * (`ai_agent_id`, accepted + whitelisted at create). The ASSEMBLER only renders
 * this card when the tenant has the `aiagents` module AND `settings.view`
 * (measured: GET /ai/agents is gated on both) — never as a disabled tease, so
 * this component itself assumes it may call the endpoint. "Start interviews"
 * and the read-only interview-flow preview stay post-create (VacancyAgentTab);
 * this card is only the link, mirroring its picker.
 */
export default function AiAgentCard({ agentId, onAgentChange, showSuggestion = false }: Props) {
  const { t } = useTranslation(['vacancies', 'common'])
  const { options, loading, error } = useAiAgents(true)

  const selectOptions = [{ value: '', label: t('aiagent.none') }, ...options.map(o => ({ value: String(o.value), label: o.label }))]

  // A+D layout (Danny 03-08): the heading now lives in the caller's CollapsedCard
  // title prop — this card renders only its own boxed body, no wrapper div.
  return (
    <div style={cardBox}>
      {error ? (
        <div style={{ fontSize: 12, color: 'var(--color-danger)' }}>{t('aiagent.loadError')}</div>
      ) : (
        <>
          {/* VAC-CLEAR-1: `ai_agent_id` is `sometimes|nullable` server-side (StoreVacancyRequest, VAC-AGENT-1's "null unlinks") — optional, so the picker carries the clear cross. */}
          <CreatableSelect value={agentId || null} onChange={onAgentChange} allowCreate={false}
            clearable clearLabel={t('aiagent.placeholder')}
            placeholder={loading ? t('common:loading') : t('aiagent.placeholder')} options={selectOptions} />
          {/* KOIOS-VOORSTEL-1: the field seeded itself from the vacancy owner's own agent — mark it a proposal, not a fact, until picked/cleared by hand. */}
          {showSuggestion && agentId && <KoiosSuggestionBadge labelKey="koiosSuggestedOwnerAgent" />}
          {!loading && options.length === 0 && (
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>{t('aiagent.empty')}</p>
          )}
        </>
      )}
      <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>{t('aiagent.explanation')}</p>
    </div>
  )
}
