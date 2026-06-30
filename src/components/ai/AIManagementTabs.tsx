/**
 * AIManagementTabs — management panels rendered inside the ConfigPanel
 * when an ai_agent workflow module is selected.
 *
 * Exports: AgentsTab, PromptsTab, FAQTab, KnowledgeTab, ToolsTab
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import api from '../../lib/api'
import { interactive } from '@/lib/a11y'
import { notifyError } from '@/lib/notify'
import { MODELS, inputStyle, Field, TextEditor, SideList, ListRow } from './management/shared'
import type { Version } from './management/shared'
import { AgentForm } from './management/AgentForm'
import type { AiAgent, AiItem } from '../../types/ai'

// ── Agents tab ────────────────────────────────────────────────────────────────

export function AgentsTab() {
  const { t } = useTranslation('workflows')
  const [agents,   setAgents]   = useState<AiAgent[]>([])
  const [selected, setSelected] = useState<AiAgent | null>(null)
  const [prompts,  setPrompts]  = useState<AiItem[]>([])
  const [faqs,     setFaqs]     = useState<AiItem[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/ai/agents'),
      api.get('/ai/prompts').catch(() => ({ data: [] })),
      api.get('/ai/faqs').catch(() => ({ data: [] })),
    ]).then(([ar, pr, fr]) => {
      const list = ar.data?.data ?? ar.data ?? []
      setAgents(list)
      setPrompts(pr.data?.data ?? pr.data ?? [])
      setFaqs(fr.data?.data ?? fr.data ?? [])
      if (list.length) setSelected(list[0])
    }).catch(() => { /* noop */ }).finally(() => setLoading(false))
  }, [])

  const onSaved = (agent: AiAgent) => {
    setAgents(prev => {
      const exists = prev.find(a => a.id === agent.id)
      return exists ? prev.map(a => a.id === agent.id ? agent : a) : [agent, ...prev]
    })
    setSelected(agent)
  }

  const onDelete = async (agent: AiAgent) => {
    if (!confirm(t('ai.agent.confirmDelete', { name: agent.name }))) return
    await api.delete(`/ai/agents/${agent.id}`).catch(() => notifyError(t('common:actionFailed')))
    setAgents(prev => prev.filter(a => a.id !== agent.id))
    setSelected(agents.find(a => a.id !== agent.id) ?? null)
  }

  return (
    <SideList
      title={t('ai.tabs.agents')} items={agents} selected={selected}
      onSelect={setSelected} onNew={() => setSelected({ _new: true })} loading={loading}
      renderItem={(a, active) => {
        const m = MODELS.find(x => x.value === a.model)
        return (
          <ListRow key={a.id} item={a} active={active} onSelect={setSelected}
            label={a.name} sublabel={m ? `${m.provider} — ${m.label}` : undefined}
            onDelete={onDelete} />
        )
      }}>
      {selected
        ? <AgentForm agent={selected._new ? null : selected} prompts={prompts} faqs={faqs} onSaved={onSaved} onDelete={onDelete} />
        : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 180, fontSize: 12, color: 'var(--text-muted)' }}>
            {t('ai.agent.selectOrNew')}
          </div>
      }
    </SideList>
  )
}

// ── Prompts tab ───────────────────────────────────────────────────────────────

export function PromptsTab() {
  const { t } = useTranslation('workflows')
  const [prompts,  setPrompts]  = useState<AiItem[]>([])
  const [selected, setSelected] = useState<AiItem | null>(null)
  const [name,     setName]     = useState('')
  const [body,     setBody]     = useState('')
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [versions, setVersions] = useState<Version[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    api.get('/ai/prompts').then(r => {
      const list = r.data?.data ?? r.data ?? []
      setPrompts(list)
      if (list.length) select(list[0])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const select = (p: AiItem) => {
    setSelected(p); setName(p.name ?? ''); setBody(p.body ?? p.content ?? '')
    api.get(`/ai/prompts/${p.id}/versions`).then(r => setVersions(r.data?.data ?? r.data ?? [])).catch(() => setVersions([]))
  }

  const save = async () => {
    setSaving(true); setSaved(false)
    try {
      const res = selected?.id
        ? await api.put(`/ai/prompts/${selected.id}`, { name, body })
        : await api.post('/ai/prompts', { name, body })
      const updated = res.data?.data ?? res.data
      setPrompts(prev => selected?.id ? prev.map(p => p.id === updated.id ? updated : p) : [updated, ...prev])
      setSelected(updated); setSaved(true); setTimeout(() => setSaved(false), 2500)
      api.get(`/ai/prompts/${updated.id}/versions`).then(r => setVersions(r.data?.data ?? r.data ?? [])).catch(() => {})
    } catch {}
    setSaving(false)
  }

  const del = async (p: AiItem) => {
    if (!confirm(t('ai.prompts.confirmDelete', { name: p.name }))) return
    await api.delete(`/ai/prompts/${p.id}`).catch(() => notifyError(t('common:actionFailed')))
    setPrompts(prev => prev.filter(x => x.id !== p.id))
    if (selected?.id === p.id) { setSelected(null); setName(''); setBody(''); setVersions([]) }
  }

  return (
    <SideList
      title={t('ai.tabs.prompts')} items={prompts} selected={selected}
      onSelect={select} onNew={() => { setSelected(null); setName(''); setBody(''); setVersions([]) }} loading={loading}
      renderItem={(p, active) => <ListRow key={p.id} item={p} active={active} onSelect={select} label={p.name} onDelete={del} />}>
      <Field label={t('ai.field.name')}>
        <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder={t('ai.prompts.namePlaceholder')} />
      </Field>
      <Field label={t('ai.field.content')}>
        <TextEditor value={body} onChange={setBody} onSave={save} saving={saving} saved={saved}
          versions={versions} onRestore={v => setBody(v.body ?? v.content ?? '')}
          placeholder={t('ai.prompts.bodyPlaceholder')} />
      </Field>
    </SideList>
  )
}

// ── FAQ tab ───────────────────────────────────────────────────────────────────

export function FAQTab() {
  const { t } = useTranslation('workflows')
  const [faqs,     setFaqs]     = useState<AiItem[]>([])
  const [selected, setSelected] = useState<AiItem | null>(null)
  const [name,     setName]     = useState('')
  const [body,     setBody]     = useState('')
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [versions, setVersions] = useState<Version[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    api.get('/ai/faqs').then(r => {
      const list = r.data?.data ?? r.data ?? []
      setFaqs(list)
      if (list.length) select(list[0])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const select = (f: AiItem) => {
    setSelected(f); setName(f.name ?? ''); setBody(f.body ?? f.content ?? '')
    api.get(`/ai/faqs/${f.id}/versions`).then(r => setVersions(r.data?.data ?? r.data ?? [])).catch(() => setVersions([]))
  }

  const save = async () => {
    setSaving(true); setSaved(false)
    try {
      const res = selected?.id
        ? await api.put(`/ai/faqs/${selected.id}`, { name, body })
        : await api.post('/ai/faqs', { name, body })
      const updated = res.data?.data ?? res.data
      setFaqs(prev => selected?.id ? prev.map(f => f.id === updated.id ? updated : f) : [updated, ...prev])
      setSelected(updated); setSaved(true); setTimeout(() => setSaved(false), 2500)
    } catch {}
    setSaving(false)
  }

  const del = async (f: AiItem) => {
    if (!confirm(t('ai.faqs.confirmDelete', { name: f.name }))) return
    await api.delete(`/ai/faqs/${f.id}`).catch(() => notifyError(t('common:actionFailed')))
    setFaqs(prev => prev.filter(x => x.id !== f.id))
    if (selected?.id === f.id) { setSelected(null); setName(''); setBody('') }
  }

  return (
    <SideList
      title={t('ai.tabs.faqs')} items={faqs} selected={selected}
      onSelect={select} onNew={() => { setSelected(null); setName(''); setBody(''); setVersions([]) }} loading={loading}
      renderItem={(f, active) => <ListRow key={f.id} item={f} active={active} onSelect={select} label={f.name} onDelete={del} />}>
      <Field label={t('ai.field.name')}>
        <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder={t('ai.faqs.namePlaceholder')} />
      </Field>
      <Field label={t('ai.faqs.contentLabel')}>
        <TextEditor value={body} onChange={setBody} onSave={save} saving={saving} saved={saved}
          versions={versions} onRestore={v => setBody(v.body ?? v.content ?? '')}
          placeholder={t('ai.faqs.bodyPlaceholder')} />
      </Field>
    </SideList>
  )
}

// ── Knowledge tab ─────────────────────────────────────────────────────────────

export function KnowledgeTab() {
  const { t } = useTranslation('workflows')
  const [items,    setItems]    = useState<AiItem[]>([])
  const [selected, setSelected] = useState<AiItem | null>(null)
  const [name,     setName]     = useState('')
  const [body,     setBody]     = useState('')
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    api.get('/ai/knowledge').then(r => {
      const list = r.data?.data ?? r.data ?? []
      setItems(list)
      if (list.length) { setSelected(list[0]); setName(list[0].name ?? ''); setBody(list[0].body ?? list[0].content ?? '') }
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true); setSaved(false)
    try {
      const res = selected?.id
        ? await api.put(`/ai/knowledge/${selected.id}`, { name, body })
        : await api.post('/ai/knowledge', { name, body })
      const u = res.data?.data ?? res.data
      setItems(prev => selected?.id ? prev.map(x => x.id === u.id ? u : x) : [u, ...prev])
      setSelected(u); setSaved(true); setTimeout(() => setSaved(false), 2500)
    } catch {}
    setSaving(false)
  }

  return (
    <SideList
      title={t('ai.tabs.knowledge')} items={items} selected={selected}
      onSelect={item => { setSelected(item); setName(item.name ?? ''); setBody(item.body ?? item.content ?? '') }}
      onNew={() => { setSelected(null); setName(''); setBody('') }} loading={loading}
      renderItem={(item, active) => (
        <ListRow key={item.id} item={item} active={active}
          onSelect={i => { setSelected(i); setName(i.name ?? ''); setBody(i.body ?? i.content ?? '') }}
          label={item.name} />
      )}>
      <Field label={t('ai.field.name')}>
        <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder={t('ai.knowledge.namePlaceholder')} />
      </Field>
      <Field label={t('ai.field.content')}>
        <TextEditor value={body} onChange={setBody} onSave={save} saving={saving} saved={saved}
          versions={[]} onRestore={() => {}}
          placeholder={t('ai.knowledge.bodyPlaceholder')} />
      </Field>
    </SideList>
  )
}

// ── Tools tab ─────────────────────────────────────────────────────────────────

// Built-in tool ids; label/description come from t('ai.tools.items.<id>.*').
const BUILTIN_TOOLS = ['shift_lookup', 'candidate_status', 'send_whatsapp', 'update_candidate', 'knowledge_search', 'calendar_check']

export function ToolsTab() {
  const { t } = useTranslation('workflows')
  const [enabled, setEnabled] = useState<Set<string>>(() => new Set(['shift_lookup', 'knowledge_search']))

  const toggle = (id: string) => setEnabled(prev => {
    const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{t('ai.tools.hint')}</p>
      {BUILTIN_TOOLS.map(toolId => {
        const on = enabled.has(toolId)
        return (
          <div key={toolId} {...interactive(() => toggle(toolId))}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, cursor: 'pointer',
              background: on ? 'var(--color-primary-bg)' : 'var(--bg)',
              border: `1px solid ${on ? 'var(--color-primary)' : 'var(--border)'}`, transition: 'all 0.12s' }}>
            <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${on ? 'var(--color-primary)' : 'var(--border)'}`, background: on ? 'var(--color-primary)' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {on && <Check size={9} color="white" />}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: on ? 'var(--color-primary)' : 'var(--text)' }}>{t(`ai.tools.items.${toolId}.label`)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{t(`ai.tools.items.${toolId}.description`)}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
