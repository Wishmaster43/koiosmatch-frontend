/**
 * useAgentSessionControl — recruiter takeover of a thread's live AI interview
 * (CMFE-MEET-1 M-3, BE 0f459730): POST /conversations/{id}/agent-session/pause
 * hands the thread to the recruiter, …/resume gives it back to the agent. Both
 * return the full conversation shape; the caller re-fetches its list so the
 * agent chip flips. A 409 (no open session / not paused) carries the server's
 * own message, which extractApiError surfaces as-is; nothing is retried.
 */
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'

export type AgentSessionAction = 'pause' | 'resume'

// One in-flight action at a time; `onChanged` is the caller's refetch (list + chip).
export function useAgentSessionControl(onChanged: () => void) {
  const { t } = useTranslation('whatsapp')
  const [busy, setBusy] = useState<AgentSessionAction | null>(null)

  // POST the action; resolves true only on a landed write (honest signal for the dialog).
  const run = useCallback(async (conversationId: string, action: AgentSessionAction): Promise<boolean> => {
    setBusy(action)
    try {
      await api.post(`/conversations/${conversationId}/agent-session/${action}`)
      onChanged()
      return true
    } catch (err) {
      notifyError(extractApiError(err, t('conversations.agentControlFailed')))
      return false
    } finally {
      setBusy(null)
    }
  }, [onChanged, t])

  return { busy, run }
}
