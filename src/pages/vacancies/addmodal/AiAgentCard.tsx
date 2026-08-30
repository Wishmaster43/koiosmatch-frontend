/**
 * AiAgentCard — punt 19: links the AI-interview agent this vacancy will use
 * (`ai_agent_id`, accepted + whitelisted at create). The ASSEMBLER only renders
 * this card when the tenant has the `aiagents` module AND `settings.view`
 * (measured: GET /ai/agents is gated on both) — never as a disabled tease, so
 * this component itself assumes it may call the endpoint. "Start interviews"
 * and the read-only interview-flow preview stay post-create (VacancyAgentTab);
 * this card is only the link, mirroring its picker.
 */
import { useTranslation } from 'react-i18next'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { cardBox } from '@/components/ui/modalCards'
import KoiosSuggestionBadge from '@/components/ui/KoiosSuggestionBadge'
import InterviewWorkflowPicker from '@/components/drawer/InterviewWorkflowPicker'
import { useAiAgents } from '../hooks/useAiAgents'
import { useInterviewWorkflows } from '@/hooks/useInterviewWorkflows'

interface Props {
  agentId: string
  onAgentChange: (id: string) => void
  // Punt 20: true while `agentId` still holds the owner-derived proposal
  // (never after a manual pick/clear) — shows the shared Koios mark (§0).
  showSuggestion?: boolean
  // INTERVIEW-WORKFLOW-1 (Appendix D/E), MEDIUM fix (verdict finding 7): the
  // create route does not yet accept `interview_workflow_id` (CMBE's P2 has not
  // shipped — `POST /vacancies` silently drops it today), so a live picker here
  // is a §3 fake affordance: the user picks, the server discards, no notice.
  // The field renders disabled with an honest reason until P2 ships; the
  // props/state stay so the caller only needs to drop these two lines and pass
  // `disabled={false}` once the route is live.
  interviewWorkflowId?: string
  onInterviewWorkflowChange?: (id: string) => void
}

// Links the vacancy's AI-interview agent; only rendered by the caller when the
// tenant module + permission actually allow it (never a disabled tease).
export default function AiAgentCard({ agentId, onAgentChange, showSuggestion = false, interviewWorkflowId = '', onInterviewWorkflowChange }: Props) {
  const { t } = useTranslation(['vacancies', 'common'])
  const { options, loading, error } = useAiAgents(true)
  // Not fetched while the picker is gated off — no point loading the tenant's
  // workflow list for a field the create route cannot persist yet.
  const { options: workflowOptions, loading: workflowsLoading, error: workflowsError } = useInterviewWorkflows(false)

  const selectOptions = [{ value: '', label: t('aiagent.none') }, ...options.map(o => ({ value: String(o.value), label: o.label }))]

  // A+D layout (Danny 03-08): the heading now lives in the caller's CollapsedCard
  // title prop — this card renders only its own boxed body, no wrapper div.
  return (
    <div style={cardBox}>
      {error ? (
        <div style={{ fontSize: 12, color: 'var(--color-danger-text)' }}>{t('aiagent.loadError')}</div>
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
      {/* INTERVIEW-WORKFLOW-1: optional companion pick, never gated on create (no
          existing resource to presence-check yet) — sent alongside the agent when chosen. */}
      {onInterviewWorkflowChange && (
        <InterviewWorkflowPicker
          value={interviewWorkflowId || null}
          onChange={onInterviewWorkflowChange}
          options={workflowOptions}
          loading={workflowsLoading}
          error={workflowsError}
          disabled
          notice={t('aiagent.workflow.createUnavailable')}
        />
      )}
    </div>
  )
}
