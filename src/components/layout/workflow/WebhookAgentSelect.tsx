/**
 * WebhookAgentSelect — the AI-agent picker of the webhook trigger (AI-AGENTS-3):
 * one agent, one own inbound webhook. Handles its own loading/empty/success
 * states over `GET /ai/agents`.
 *
 * Its own file because the fetch belongs to this control alone — it is mounted
 * exactly when the webhook trigger is selected, which is precisely when the old
 * `if (type !== 'webhook') return` effect in ScheduleModal used to fire. The
 * chosen agent NAME stays in the modal's form state, so it survives switching
 * the trigger type back and forth.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { unwrapList } from '@/lib/api'
import type { AiAgent } from '@/types/ai'
import { selectStyle } from './scheduleModalStyles'

export function WebhookAgentSelect({ value, onChange, label }: {
  value: string; onChange: (name: string) => void; label: string
}) {
  const { t } = useTranslation('workflows')
  const [agents,        setAgents]        = useState<AiAgent[]>([])
  const [agentsLoading, setAgentsLoading] = useState(true)

  // Load the tenant's AI agents — each agent has its own inbound webhook
  // (AI-AGENTS-3); no reusable agents hook/context exists yet (checked
  // src/hooks, src/context, 2026-07-20), so this mirrors the same lazy-import
  // fetch idiom as WebhookSelectField/FaqSelectField in fieldControls.tsx.
  useEffect(() => {
    let alive = true
    setAgentsLoading(true)
    import('@/lib/api').then(m => m.default.get('/ai/agents'))
      .then(r => { if (alive) setAgents(unwrapList<AiAgent>(r).rows) })
      .catch(() => { if (alive) setAgents([]) })
      .finally(() => { if (alive) setAgentsLoading(false) })
    return () => { alive = false }
  }, [])

  if (agentsLoading) return <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('scheduleModal.agentLoading')}</p>
  // Empty state: the tenant has no agents yet, so there is nothing to couple to.
  if (agents.length === 0) return (
    <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 8 }}>
      {t('scheduleModal.agentEmpty')}
    </p>
  )
  return (
    <select value={value} onChange={e => onChange(e.target.value)} aria-label={label} style={selectStyle}>
      <option value="">{t('scheduleModal.agentSelect')}</option>
      {agents.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
    </select>
  )
}
