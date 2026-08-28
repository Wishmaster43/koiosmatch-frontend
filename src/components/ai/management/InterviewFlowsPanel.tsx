/**
 * InterviewFlowsPanel — create/edit form for one tenant interview flow
 * (AI-AGENTS-3 CRUD, live BE contract 2026-08-28: /ai/interview-flows). Used
 * by FlowsTab (AIManagementTabs.tsx), mirrors AgentForm's shape: header +
 * fields + SaveBar. Statuses are a reorderable string-chip list (DragList,
 * mirrors KpiOrderList's keyboard-reorder idiom); output_fields render as an
 * honest editable key list (the API's only documented value type is a bare
 * string per key, per the contract).
 */
import { useState, useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Brain, Plus, X, Trash2 } from 'lucide-react'
import Toggle from '@/components/ui/Toggle'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { DragList } from '@/pages/settings/shared'
import { SectionTitle, GroupLabel, groupLabelStyle, monoStyle } from '@/components/ui/typography'
import Button from '@/components/ui/Button'
import { fieldTextareaStyle } from '@/components/forms/fieldMetrics'
import { useAiAgents } from '@/hooks/useAiAgents'
import { inputStyle, Field, SaveBar } from './shared'
import type { InterviewFlow } from '@/types/ai'

// One editable status chip row — id keeps DragList's key stable across reorders (index alone would rebind on every move).
interface StatusRow { id: string; value: string }

// The panel's local form state, mirroring InterviewFlow's writable fields (channel is fixed — API-STATUS-1, see render below).
interface FlowFormState {
  name: string
  ai_agent_id: string | number | null
  system_prompt: string
  statuses: StatusRow[]
  outputFields: Array<{ key: string; type: string }>
  intro_template: string
  active: boolean
}

// Builds the form's initial state from a saved flow (or empty defaults for a new one).
const toFormState = (flow: InterviewFlow | null): FlowFormState => ({
  name: flow?.name ?? '',
  ai_agent_id: (flow as InterviewFlow & { ai_agent_id?: string | number | null })?.ai_agent_id ?? null,
  system_prompt: flow?.system_prompt ?? '',
  statuses: (flow?.statuses ?? []).map((s, i) => ({ id: `${i}-${s}`, value: s })),
  outputFields: Object.entries(flow?.output_fields ?? {}).map(([key, type]) => ({ key, type: typeof type === 'string' ? type : String(type) })),
  intro_template: flow?.intro_template ?? '',
  active: flow?.active ?? true,
})

export function InterviewFlowsPanel({ flow, onSaved, onDelete, saving }: {
  flow: InterviewFlow | null
  onSaved: (payload: Record<string, unknown>) => void
  onDelete?: (flow: InterviewFlow) => void
  saving?: boolean
}) {
  const { t } = useTranslation('workflows')
  const isNew = !flow?.id
  const [form, setForm] = useState<FlowFormState>(() => toFormState(flow))
  const [saved, setSaved] = useState(false)
  const { options: agentOptions } = useAiAgents()
  const agentLabelId = useId()

  const set = <K extends keyof FlowFormState>(k: K, v: FlowFormState[K]) => setForm(f => ({ ...f, [k]: v }))

  // Adds a blank status row at the end — the recruiter names it, then reorders via DragList.
  const addStatus = () => set('statuses', [...form.statuses, { id: `new-${Date.now()}`, value: '' }])
  const updateStatus = (id: string, value: string) => set('statuses', form.statuses.map(s => (s.id === id ? { ...s, value } : s)))
  const removeStatus = (id: string) => set('statuses', form.statuses.filter(s => s.id !== id))

  const addOutputField = () => set('outputFields', [...form.outputFields, { key: '', type: 'string' }])
  const updateOutputField = (i: number, patch: Partial<{ key: string; type: string }>) =>
    set('outputFields', form.outputFields.map((f, idx) => (idx === i ? { ...f, ...patch } : f)))
  const removeOutputField = (i: number) => set('outputFields', form.outputFields.filter((_, idx) => idx !== i))

  // The server's own create-rules (name + system_prompt + >=1 status) gate the
  // save CLIENT-side too — a button that can only 422 is a fake affordance (§3).
  const cleanStatuses = form.statuses.map(s => s.value.trim()).filter(Boolean)
  const canSave = Boolean(form.name.trim()) && Boolean(form.system_prompt.trim()) && cleanStatuses.length > 0

  // Builds the API payload (statuses/output_fields collapse back to the wire shapes) and hands it to the caller, which does the actual POST/PUT.
  const save = () => {
    if (!canSave) return
    onSaved({
      name: form.name,
      ai_agent_id: form.ai_agent_id || null,
      channel: 'whatsapp',
      system_prompt: form.system_prompt,
      statuses: cleanStatuses,
      output_fields: Object.fromEntries(form.outputFields.filter(f => f.key.trim()).map(f => [f.key.trim(), f.type || 'string'])),
      intro_template: form.intro_template || null,
      active: form.active,
    })
    setSaved(true); setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Header row — mirrors AgentForm's icon + title + SaveBar layout */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--color-violet-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Brain size={15} color="var(--color-violet)" />
          </div>
          <SectionTitle as="div">{isNew ? t('ai.flows.newFlow') : form.name || t('ai.flows.fallback')}</SectionTitle>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {!isNew && flow && onDelete && (
            <Button variant="ghost" iconOnly onClick={() => onDelete(flow)}
              aria-label={t('common:delete')} title={t('common:delete')} style={{ color: 'var(--color-danger-text)' }}>
              <Trash2 size={12} />
            </Button>
          )}
          <SaveBar saving={saving} saved={saved} onSave={save} disabled={!canSave} />
        </div>
      </div>

      <Field label={t('ai.field.name')}>
        <input value={form.name} onChange={e => set('name', e.target.value)} style={inputStyle} placeholder={t('ai.flows.namePlaceholder')} />
      </Field>

      <div style={{ marginBottom: 13 }}>
        <label id={agentLabelId} style={{ ...groupLabelStyle, display: 'block', marginBottom: 5 }}>
          {t('ai.flows.agentLabel')}
        </label>
        <CreatableSelect value={form.ai_agent_id ? String(form.ai_agent_id) : null} allowCreate={false} clearable
          aria-labelledby={agentLabelId} onChange={v => set('ai_agent_id', v)}
          placeholder={t('ai.flows.noAgent')} options={agentOptions.map(o => ({ value: String(o.value), label: o.label }))}
          style={inputStyle} />
      </div>

      {/* API-STATUS-1: channel is fixed 'whatsapp' by contract — no fake choice, rendered read-only with its value. */}
      <Field label={t('ai.flows.channelLabel')}>
        <p style={{ fontSize: 12, color: 'var(--text)', margin: 0 }}>{t('ai.flows.channelWhatsapp')}</p>
      </Field>

      <Field label={t('ai.flows.systemPromptLabel')}>
        <textarea value={form.system_prompt} onChange={e => set('system_prompt', e.target.value)}
          placeholder={t('ai.flows.systemPromptPlaceholder')}
          style={{ ...fieldTextareaStyle, ...monoStyle, height: 160, fontSize: 12, lineHeight: 1.6 }} />
      </Field>

      {/* Statuses — a reorderable string-chip list (mirrors KpiOrderList's DragList idiom). */}
      <div style={{ marginBottom: 13 }}>
        <GroupLabel style={{ marginBottom: 8 }}>{t('ai.agent.interviewFlow.statusesLabel')}</GroupLabel>
        {form.statuses.length > 0 && (
          <DragList
            items={form.statuses}
            onReorder={(next: StatusRow[]) => set('statuses', next)}
            renderItem={(row: StatusRow) => (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                <input value={row.value} maxLength={64} onChange={e => updateStatus(row.id, e.target.value)}
                  aria-label={t('ai.agent.interviewFlow.statusesLabel')}
                  placeholder={t('ai.flows.statusPlaceholder')} style={{ ...inputStyle, flex: 1 }} />
                <Button variant="ghost" iconOnly onClick={() => removeStatus(row.id)}
                  aria-label={t('common:delete')} title={t('common:delete')}>
                  <X size={12} />
                </Button>
              </div>
            )} />
        )}
        <Button variant="ghost" onClick={addStatus} style={{ marginTop: 6 }}>
          <Plus size={12} /> {t('ai.flows.addStatus')}
        </Button>
      </div>

      {/* Dossier/output fields — honest minimal editor: a key + its declared type
          (currently always a bare string per the live contract). */}
      <div style={{ marginBottom: 13 }}>
        <GroupLabel style={{ marginBottom: 8 }}>{t('ai.agent.interviewFlow.outputFieldsLabel')}</GroupLabel>
        {form.outputFields.map((f, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <input value={f.key} onChange={e => updateOutputField(i, { key: e.target.value })}
              aria-label={t('ai.flows.outputFieldKeyPlaceholder')}
              placeholder={t('ai.flows.outputFieldKeyPlaceholder')} style={{ ...inputStyle, ...monoStyle, flex: 1 }} />
            <input value={f.type} onChange={e => updateOutputField(i, { type: e.target.value })}
              aria-label={t('ai.flows.outputFieldTypePlaceholder')}
              placeholder={t('ai.flows.outputFieldTypePlaceholder')} style={{ ...inputStyle, width: 100 }} />
            <Button variant="ghost" iconOnly onClick={() => removeOutputField(i)}
              aria-label={t('common:delete')} title={t('common:delete')}>
              <X size={12} />
            </Button>
          </div>
        ))}
        <Button variant="ghost" onClick={addOutputField}>
          <Plus size={12} /> {t('ai.flows.addOutputField')}
        </Button>
      </div>

      <Field label={t('ai.flows.introTemplateLabel')}>
        <textarea value={form.intro_template} onChange={e => set('intro_template', e.target.value)}
          placeholder={t('ai.flows.introTemplatePlaceholder')}
          style={{ ...fieldTextareaStyle, height: 90, fontSize: 12, lineHeight: 1.6 }} />
      </Field>

      <div style={{ marginBottom: 13 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <Toggle checked={form.active} onChange={v => set('active', v)} ariaLabel={t('ai.agent.interviewFlow.active')} />
          <span style={{ fontSize: 12, color: 'var(--text)' }}>{t('ai.agent.interviewFlow.active')}</span>
        </label>
      </div>
    </div>
  )
}
