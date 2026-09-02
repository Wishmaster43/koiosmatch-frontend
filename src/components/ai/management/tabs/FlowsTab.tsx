/**
 * FlowsTab — interview flow CRUD (AI-AGENTS-3, live BE contract 2026-08-28).
 * Unchanged from the pre-split AIManagementTabs.tsx.
 */
import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import api, { unwrap, unwrapList } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { useConfirm } from '@/hooks/useConfirm'
import { useAuth } from '@/context/AuthContext'
import Spinner from '@/components/ui/Spinner'
import { SideList, ListRow } from '@/components/ai/management/shared'
import { InterviewFlowsPanel } from '@/components/ai/management/InterviewFlowsPanel'
import type { InterviewFlow } from '@/types/ai'

export function FlowsTab() {
  const { t } = useTranslation('workflows')
  const auth = useAuth()
  // Mutations gate on settings.update (§7) — the backend re-checks regardless.
  const canEdit = Boolean(auth?.hasPermission?.('settings.update'))
  const [flows,    setFlows]    = useState<InterviewFlow[]>([])
  const [selected, setSelected] = useState<InterviewFlow | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  // A failed flows load must render its own state, never the "nothing yet" empty state (R8).
  const [loadError, setLoadError] = useState(false)
  // The vacancy/application pickers cache this list under the shared
  // react-query key — every mutation here invalidates it (§11 adoption).
  const queryClient = useQueryClient()
  const invalidatePickers = () => queryClient.invalidateQueries({ queryKey: ['ai-interview-flows'] })
  const { confirm, dialog } = useConfirm()

  // B1 (verify r2): the LIST payload is lean ({id,name,channel,active}) — the
  // full editable flow lives behind show. Selecting fetches it; editing a lean
  // row would render empty fields and PUT those empties over the stored flow.
  const [detailLoading, setDetailLoading] = useState(false)
  const pickFlow = (f: InterviewFlow | null) => {
    setSelected(f)
    if (!f?.id) return
    setDetailLoading(true)
    api.get(`/ai/interview-flows/${f.id}`)
      .then(r => setSelected(unwrap<InterviewFlow>(r)))
      .catch(() => notifyError(t('common:actionFailed')))
      .finally(() => setDetailLoading(false))
  }

  // Load the flow list on mount and preselect the first entry.
  useEffect(() => {
    setLoadError(false)
    api.get('/ai/interview-flows').then(r => {
      const list = unwrapList<InterviewFlow>(r).rows
      setFlows(list)
      if (list.length) pickFlow(list[0])
    }).catch(() => setLoadError(true)).finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])


  // Create or update depending on whether a flow is already selected; the panel
  // hands back the already-shaped wire payload (statuses/output_fields collapsed).
  const save = async (payload: Record<string, unknown>) => {
    setSaving(true)
    try {
      const res = selected?.id
        ? await api.put(`/ai/interview-flows/${selected.id}`, payload)
        : await api.post('/ai/interview-flows', payload)
      const updated = unwrap<InterviewFlow>(res)
      setFlows(prev => (selected?.id ? prev.map(f => (f.id === updated.id ? updated : f)) : [updated, ...prev]))
      setSelected(updated)
      invalidatePickers()
    } catch {
      notifyError(t('common:actionFailed'))
    }
    setSaving(false)
  }

  // Deleting a flow asks first; a 409 means it is still bound to a vacancy/application
  // (in-use protection) — surface that instead of the generic failure message.
  const del = (flow: InterviewFlow) => {
    confirm(t('ai.flows.confirmDelete', { name: flow.name }), async () => {
      try {
        await api.delete(`/ai/interview-flows/${flow.id}`)
      } catch (err: unknown) {
        // In-use protection answers 422 (measured, InterviewFlowController:96) —
        // the server ships a human reason; surface it, fall back to our copy.
        const resp = (err as { response?: { status?: number; data?: { message?: string } } })?.response
        notifyError(resp?.status === 422 ? (resp.data?.message ?? t('ai.flows.inUse')) : t('common:actionFailed'))
        return
      }
      setFlows(prev => {
        const rest = prev.filter(f => f.id !== flow.id)
        setSelected(sel => (sel?.id === flow.id ? rest[0] ?? null : sel))
        return rest
      })
      invalidatePickers()
    }, { danger: true })
  }

  return (
    <>
      <SideList
        title={t('ai.tabs.flows')} items={flows} selected={selected}
        onSelect={pickFlow} onNew={() => setSelected({ _new: true } as InterviewFlow)} loading={loading} error={loadError}
        renderItem={(f, active) => (
          <ListRow key={f.id} item={f} active={active} onSelect={pickFlow} label={f.name}
            sublabel={f.active ? t('ai.agent.interviewFlow.active') : t('ai.agent.interviewFlow.inactive')}
            onDelete={canEdit ? del : undefined} />
        )}>
        {!canEdit ? (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>{t('ai.flows.noPermission')}</p>
        ) : detailLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 180 }}><Spinner size={16} /></div>
        ) : selected ? (
          // key: fresh mount per selection — without it the form kept flow A's
          // values while saving to flow B's id (B3, cross-record corruption).
          <InterviewFlowsPanel key={selected.id ?? 'new'} flow={(selected as InterviewFlow & { _new?: boolean })._new ? null : selected} onSaved={save} onDelete={del} saving={saving} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 180, fontSize: 12, color: 'var(--text-muted)' }}>
            {t('ai.flows.selectOrNew')}
          </div>
        )}
      </SideList>
      {dialog}
    </>
  )
}
