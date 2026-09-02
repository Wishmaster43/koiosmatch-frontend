/**
 * useAgentsData — data/mutations for AgentsTab, split out of AIManagementTabs
 * so the tab component stays presentational (§3: logic lives in hooks).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { useConfirm } from '@/hooks/useConfirm'
import { useAiListResource } from './useAiListResource'
import type { AiAgent, AiItem } from '@/types/ai'

export function useAgentsData() {
  const { t } = useTranslation('workflows')
  const [agents,   setAgents]   = useState<AiAgent[]>([])
  const [selected, setSelected] = useState<AiAgent | null>(null)
  const [prompts,  setPrompts]  = useState<AiItem[]>([])
  const [faqs,     setFaqs]     = useState<AiItem[]>([])
  // House confirmation dialog (§0 leftover debt) — replaces the native window.confirm() below.
  const { confirm, dialog } = useConfirm()

  // Load the agents and their prompt/faq option lists as three parallel requests,
  // preselecting the first agent when there is one.
  const { loading, loadError, reload } = useAiListResource<AiAgent>({
    endpoint: '/ai/agents',
    onLoaded: list => { setAgents(list); if (list.length) setSelected(list[0]) },
    secondary: [
      { endpoint: '/ai/prompts', onLoaded: rows => setPrompts(rows as AiItem[]) },
      { endpoint: '/ai/faqs', onLoaded: rows => setFaqs(rows as AiItem[]) },
    ],
  })

  // AgentForm reports back after a successful save; upsert into the local list so the
  // new/edited agent shows up immediately without a refetch.
  const onSaved = (agent: AiAgent) => {
    setAgents(prev => {
      const exists = prev.find(a => a.id === agent.id)
      return exists ? prev.map(a => a.id === agent.id ? agent : a) : [agent, ...prev]
    })
    setSelected(agent)
  }

  // Deleting an agent asks first, then waits for the server before the list changes.
  const onDelete = (agent: AiAgent) => {
    confirm(t('ai.agent.confirmDelete', { name: agent.name }), async () => {
      try {
        // The list/selection must only change once the backend confirms the delete —
        // a failed request used to fall through to the same state update regardless,
        // making the agent vanish from the UI while it was still live server-side
        // (mutation lying about success, audit 2026-07-28).
        await api.delete(`/ai/agents/${agent.id}`)
      } catch (err: unknown) {
        // AIAGENT-DESTROY-GUARD-1: an in-use agent answers 409 with a structured
        // in_use payload ({vacancies, interview_flows} counts) — compose the
        // reason FE-side through i18n (§10: own error mapping, never rely on
        // server prose, which is NL-only); server message stays the middle
        // fallback for older payloads, generic copy for everything else.
        const resp = (err as { response?: { status?: number; data?: { message?: string; in_use?: { vacancies?: number; interview_flows?: number } } } })?.response
        if (resp?.status === 409) {
          const iu = resp.data?.in_use
          notifyError(iu
            ? t('ai.agent.inUseCounts', { vacancies: iu.vacancies ?? 0, flows: iu.interview_flows ?? 0 })
            : (resp.data?.message ?? t('ai.agent.inUse')))
        } else notifyError(t('common:actionFailed'))
        return
      }
      setAgents(prev => prev.filter(a => a.id !== agent.id))
      setSelected(agents.find(a => a.id !== agent.id) ?? null)
    }, { danger: true })
  }

  return { agents, selected, setSelected, prompts, faqs, loading, loadError, reload, onSaved, onDelete, dialog }
}
