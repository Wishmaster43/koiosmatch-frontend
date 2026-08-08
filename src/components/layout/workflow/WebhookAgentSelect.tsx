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
 *
 * FAILURE-STATE FIX: a network/permission error used to be swallowed into the
 * SAME empty list as "this tenant genuinely has zero agents" — `.catch(() =>
 * setAgents([]))` — so a recruiter saw the exact same "no agents yet, create one"
 * message for a real backend failure. `loadError` is now tracked separately from
 * `agents.length === 0`, rendering the shared generic failure copy
 * (`common:actionFailed`, already used the same way in WorkflowEditorHeader's own
 * run-error span) instead of the misleading empty-state copy.
 */
import { useState, useEffect, useId } from 'react'
import { useTranslation } from 'react-i18next'
import { unwrapList } from '@/lib/api'
import type { AiAgent } from '@/types/ai'
import { selectStyle } from './scheduleModalStyles'
// Danny 08-08 (§4): the house searchable combobox replaces the bare native
// <select>. This modal is wrapped in useFocusTrap (via FloatingPanel) —
// EventCombobox's own doc comment (this same directory) proved SelectMenu's
// document-level Escape listener shares the plain <select>'s latent flaw in a
// trapped dialog, so CreatableSelect (portalled popover) is the safe pick.
import CreatableSelect from '@/components/ui/CreatableSelect'

export function WebhookAgentSelect({ value, onChange, label }: {
  value: string; onChange: (name: string) => void; label: string
}) {
  const { t } = useTranslation('workflows')
  const [agents,        setAgents]        = useState<AiAgent[]>([])
  const [agentsLoading, setAgentsLoading] = useState(true)
  const [loadError,     setLoadError]     = useState(false)
  // CreatableSelect's trigger is a <button>, which a plain aria-label cannot
  // name — a sr-only span + aria-labelledby names it instead (§4).
  const labelId = useId()

  // Load the tenant's AI agents — each agent has its own inbound webhook
  // (AI-AGENTS-3); no reusable agents hook/context exists yet (checked
  // src/hooks, src/context, 2026-07-20), so this mirrors the same lazy-import
  // fetch idiom as WebhookSelectField/FaqSelectField in fieldControls.tsx.
  useEffect(() => {
    let alive = true
    setAgentsLoading(true)
    setLoadError(false)
    import('@/lib/api').then(m => m.default.get('/ai/agents'))
      .then(r => { if (alive) setAgents(unwrapList<AiAgent>(r).rows) })
      .catch(() => { if (alive) setLoadError(true) })
      .finally(() => { if (alive) setAgentsLoading(false) })
    return () => { alive = false }
  }, [])

  if (agentsLoading) return <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('scheduleModal.agentLoading')}</p>
  // Failure state: distinct from "no agents yet" — a fetch error means we don't
  // actually know whether the tenant has agents, so never claim it is empty.
  if (loadError) return (
    <p role="alert" style={{ fontSize: 12, color: 'var(--color-danger)', padding: '6px 10px', border: '1px solid var(--color-danger)', borderRadius: 8 }}>
      {t('common:actionFailed')}
    </p>
  )
  // Empty state: the tenant has no agents yet, so there is nothing to couple to.
  if (agents.length === 0) return (
    <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 8 }}>
      {t('scheduleModal.agentEmpty')}
    </p>
  )
  return (
    <>
      <span id={labelId} className="sr-only">{label}</span>
      <CreatableSelect value={value} onChange={onChange} aria-labelledby={labelId} allowCreate={false}
        placeholder={t('scheduleModal.agentSelect')}
        options={[{ value: '', label: t('scheduleModal.agentSelect') }, ...agents.map(a => ({ value: a.name ?? '', label: a.name ?? '' }))]}
        style={selectStyle} />
    </>
  )
}
