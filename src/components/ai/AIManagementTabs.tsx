/**
 * AIManagementTabs — management panels rendered inside the ConfigPanel
 * when an ai_agent workflow module is selected.
 *
 * Exports: AgentsTab, PromptsTab, FAQTab, KnowledgeTab, ToolsTab
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import api, { unwrap, unwrapList } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { useConfirm } from '@/hooks/useConfirm'
import Avatar from '@/components/ui/Avatar'
import { initialsOf } from '@/lib/initials'
import { inputStyle, Field, TextEditor, SideList, ListRow } from './management/shared'
import type { Version } from './management/shared'
import { AgentForm } from './management/AgentForm'
import type { AiAgent, AiItem } from '@/types/ai'

// ── Agents tab ────────────────────────────────────────────────────────────────

export function AgentsTab() {
  const { t } = useTranslation('workflows')
  const [agents,   setAgents]   = useState<AiAgent[]>([])
  const [selected, setSelected] = useState<AiAgent | null>(null)
  const [prompts,  setPrompts]  = useState<AiItem[]>([])
  const [faqs,     setFaqs]     = useState<AiItem[]>([])
  const [loading,  setLoading]  = useState(true)
  // A failed agents load must render its own state, never the "nothing yet" empty state (R8).
  const [loadError, setLoadError] = useState(false)
  // House confirmation dialog (§0 leftover debt) — replaces the native window.confirm() below.
  const { confirm, dialog } = useConfirm()

  // Load the agents and their prompt/faq option lists as three parallel requests,
  // awaited together, then preselect the first agent when there is one.
  useEffect(() => {
    setLoadError(false)
    Promise.all([
      api.get('/ai/agents'),
      api.get('/ai/prompts').catch(() => ({ data: [] })),
      api.get('/ai/faqs').catch(() => ({ data: [] })),
    ]).then(([ar, pr, fr]) => {
      const list = unwrapList<AiAgent>(ar).rows
      setAgents(list)
      setPrompts(unwrapList<AiItem>(pr).rows)
      setFaqs(unwrapList<AiItem>(fr).rows)
      if (list.length) setSelected(list[0])
    }).catch(() => setLoadError(true)).finally(() => setLoading(false))
  }, [])

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
      } catch {
        notifyError(t('common:actionFailed'))
        return
      }
      setAgents(prev => prev.filter(a => a.id !== agent.id))
      setSelected(agents.find(a => a.id !== agent.id) ?? null)
    }, { danger: true })
  }

  return (
    <>
      <SideList
        title={t('ai.tabs.agents')} items={agents} selected={selected}
        onSelect={setSelected} onNew={() => setSelected({ _new: true })} loading={loading} error={loadError}
        renderItem={(a, active) => (
          // AI-AGENTS-2: show the linked recruiter/manager user, not a model (removed — MODEL-1).
          <ListRow key={a.id} item={a} active={active} onSelect={setSelected}
            label={a.name} sublabel={a.user?.name}
            leading={a.user ? <Avatar initials={initialsOf(a.user.name)} size={22} soft /> : undefined}
            onDelete={onDelete} />
        )}>
        {selected
          ? <AgentForm agent={selected._new ? null : selected} prompts={prompts} faqs={faqs} onSaved={onSaved} onDelete={onDelete} />
          : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 180, fontSize: 12, color: 'var(--text-muted)' }}>
              {t('ai.agent.selectOrNew')}
            </div>
        }
      </SideList>
      {dialog}
    </>
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
  // A failed prompts load must render its own state, never the "nothing yet" empty state (R8).
  const [loadError, setLoadError] = useState(false)
  // House confirmation dialog (§0 leftover debt) — replaces the native window.confirm() below.
  const { confirm, dialog } = useConfirm()

  // Load the prompt list on mount and preselect the first entry, which also seeds its version history.
  useEffect(() => {
    setLoadError(false)
    api.get('/ai/prompts').then(r => {
      const list = unwrapList<AiItem>(r).rows
      setPrompts(list)
      if (list.length) select(list[0])
    }).catch(() => setLoadError(true)).finally(() => setLoading(false))
  }, [])

  // Selecting a prompt loads the form fields plus its version history for the restore control.
  const select = (p: AiItem) => {
    setSelected(p); setName(p.name ?? ''); setBody(p.body ?? p.content ?? '')
    api.get(`/ai/prompts/${p.id}/versions`).then(r => setVersions(unwrapList<Version>(r).rows)).catch(() => setVersions([]))
  }

  // Create or update depending on whether a prompt is already selected, then refresh its version list.
  const save = async () => {
    setSaving(true); setSaved(false)
    try {
      const res = selected?.id
        ? await api.put(`/ai/prompts/${selected.id}`, { name, body })
        : await api.post('/ai/prompts', { name, body })
      const updated = unwrap<AiItem>(res)
      setPrompts(prev => selected?.id ? prev.map(p => p.id === updated.id ? updated : p) : [updated, ...prev])
      setSelected(updated); setSaved(true); setTimeout(() => setSaved(false), 2500)
      api.get(`/ai/prompts/${updated.id}/versions`).then(r => setVersions(unwrapList<Version>(r).rows)).catch(() => {})
    } catch {
      // A failed save used to leave no signal at all (silent catch) — say so like every other mutation here.
      notifyError(t('common:actionFailed'))
    }
    setSaving(false)
  }

  const del = (p: AiItem) => {
    confirm(t('ai.prompts.confirmDelete', { name: p.name }), async () => {
      try {
        // Only drop the row once the backend confirms — a failed delete used to remove
        // it from the list regardless, making it look deleted while still live server-side.
        await api.delete(`/ai/prompts/${p.id}`)
      } catch {
        notifyError(t('common:actionFailed'))
        return
      }
      setPrompts(prev => prev.filter(x => x.id !== p.id))
      if (selected?.id === p.id) { setSelected(null); setName(''); setBody(''); setVersions([]) }
    }, { danger: true })
  }

  return (
    <>
      <SideList
        title={t('ai.tabs.prompts')} items={prompts} selected={selected}
        onSelect={select} onNew={() => { setSelected(null); setName(''); setBody(''); setVersions([]) }} loading={loading} error={loadError}
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
      {dialog}
    </>
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
  // A failed FAQ load must render its own state, never the "nothing yet" empty state (R8).
  const [loadError, setLoadError] = useState(false)
  // House confirmation dialog (§0 leftover debt) — replaces the native window.confirm() below.
  const { confirm, dialog } = useConfirm()

  // Load the FAQ list on mount and preselect the first entry, which also seeds its version history.
  useEffect(() => {
    setLoadError(false)
    api.get('/ai/faqs').then(r => {
      const list = unwrapList<AiItem>(r).rows
      setFaqs(list)
      if (list.length) select(list[0])
    }).catch(() => setLoadError(true)).finally(() => setLoading(false))
  }, [])

  // Selecting a FAQ loads the form fields plus its version history for the restore control.
  const select = (f: AiItem) => {
    setSelected(f); setName(f.name ?? ''); setBody(f.body ?? f.content ?? '')
    api.get(`/ai/faqs/${f.id}/versions`).then(r => setVersions(unwrapList<Version>(r).rows)).catch(() => setVersions([]))
  }

  // Create or update depending on whether a FAQ is already selected.
  const save = async () => {
    setSaving(true); setSaved(false)
    try {
      const res = selected?.id
        ? await api.put(`/ai/faqs/${selected.id}`, { name, body })
        : await api.post('/ai/faqs', { name, body })
      const updated = unwrap<AiItem>(res)
      setFaqs(prev => selected?.id ? prev.map(f => f.id === updated.id ? updated : f) : [updated, ...prev])
      setSelected(updated); setSaved(true); setTimeout(() => setSaved(false), 2500)
    } catch {
      // A failed save used to leave no signal at all (silent catch) — say so like every other mutation here.
      notifyError(t('common:actionFailed'))
    }
    setSaving(false)
  }

  const del = (f: AiItem) => {
    confirm(t('ai.faqs.confirmDelete', { name: f.name }), async () => {
      try {
        // Only drop the row once the backend confirms — a failed delete used to remove
        // it from the list regardless, making it look deleted while still live server-side.
        await api.delete(`/ai/faqs/${f.id}`)
      } catch {
        notifyError(t('common:actionFailed'))
        return
      }
      setFaqs(prev => prev.filter(x => x.id !== f.id))
      if (selected?.id === f.id) { setSelected(null); setName(''); setBody('') }
    }, { danger: true })
  }

  return (
    <>
      <SideList
        title={t('ai.tabs.faqs')} items={faqs} selected={selected}
        onSelect={select} onNew={() => { setSelected(null); setName(''); setBody(''); setVersions([]) }} loading={loading} error={loadError}
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
      {dialog}
    </>
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
  // A failed knowledge load must render its own state, never the "nothing yet" empty state (R8).
  const [loadError, setLoadError] = useState(false)

  // Load knowledge items on mount and preselect the first one, seeding the form fields from it.
  useEffect(() => {
    setLoadError(false)
    api.get('/ai/knowledge').then(r => {
      const list = unwrapList<AiItem>(r).rows
      setItems(list)
      if (list.length) { setSelected(list[0]); setName(list[0].name ?? ''); setBody(list[0].body ?? list[0].content ?? '') }
    }).catch(() => setLoadError(true)).finally(() => setLoading(false))
  }, [])

  // Create or update the knowledge item depending on whether one is already selected.
  const save = async () => {
    setSaving(true); setSaved(false)
    try {
      const res = selected?.id
        ? await api.put(`/ai/knowledge/${selected.id}`, { name, body })
        : await api.post('/ai/knowledge', { name, body })
      const u = unwrap<AiItem>(res)
      setItems(prev => selected?.id ? prev.map(x => x.id === u.id ? u : x) : [u, ...prev])
      setSelected(u); setSaved(true); setTimeout(() => setSaved(false), 2500)
    } catch {
      // A failed save used to leave no signal at all (silent catch) — say so like every other mutation here.
      notifyError(t('common:actionFailed'))
    }
    setSaving(false)
  }

  return (
    <SideList
      title={t('ai.tabs.knowledge')} items={items} selected={selected}
      onSelect={item => { setSelected(item); setName(item.name ?? ''); setBody(item.body ?? item.content ?? '') }}
      onNew={() => { setSelected(null); setName(''); setBody('') }} loading={loading} error={loadError}
      renderItem={(item, active) => (
        <ListRow key={item.id} item={item} active={active}
          onSelect={i => { setSelected(i); setName(i.name ?? ''); setBody(i.body ?? i.content ?? '') }}
          label={item.name} />
      )}>
      <Field label={t('ai.field.name')}>
        <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder={t('ai.knowledge.namePlaceholder')} />
      </Field>
      <Field label={t('ai.field.content')}>
        {/* FAKE-AFFORDANCE (14-08): no /ai/knowledge/{id}/versions endpoint exists, so
            versions/onRestore are omitted entirely rather than faked with an empty
            list + a no-op handler (mirrors ToolsTab's honest-gate reasoning above). */}
        <TextEditor value={body} onChange={setBody} onSave={save} saving={saving} saved={saved}
          placeholder={t('ai.knowledge.bodyPlaceholder')} />
      </Field>
    </SideList>
  )
}

// ── Tools tab ─────────────────────────────────────────────────────────────────

// Built-in tool ids; label/description come from t('ai.tools.items.<id>.*').
const BUILTIN_TOOLS = ['shift_lookup', 'candidate_status', 'send_whatsapp', 'update_candidate', 'knowledge_search', 'calendar_check']
// Which tools ship enabled by default — display-only until the backend exists (see below).
const DEFAULT_ENABLED_TOOLS = new Set(['shift_lookup', 'knowledge_search'])

// AUDIT 2026-07-28 (fake affordance, §3): this used to be a clickable toggle whose
// state lived only in this component and was never sent anywhere — no `tools` field
// on AiAgent, no /ai/agents/{id}/tools route (verified against api-generated.ts).
// Toggling looked like a per-agent save but reset to the same two defaults on every
// remount. Render it read-only with an honest notice instead of faking a save;
// wire it up for real once the backend ships the endpoint (report, don't fake it).
export function ToolsTab() {
  const { t } = useTranslation('workflows')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{t('ai.tools.hint')}</p>
      <p style={{ fontSize: 11, color: 'var(--color-warning-text)', marginBottom: 4 }}>{t('ai.tools.notAvailable')}</p>
      {BUILTIN_TOOLS.map(toolId => {
        const on = DEFAULT_ENABLED_TOOLS.has(toolId)
        return (
          <div key={toolId} aria-disabled="true"
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, cursor: 'not-allowed', opacity: 0.7,
              background: on ? 'var(--color-primary-bg)' : 'var(--bg)',
              border: `1px solid ${on ? 'var(--color-primary)' : 'var(--border)'}` }}>
            <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${on ? 'var(--color-primary)' : 'var(--border)'}`, background: on ? 'var(--color-primary)' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {on && <Check size={9} color="white" />}
            </div>
            <div>
              {/* Text-colour accent uses the AA-contrast text token, not the raw brand primary. */}
              <div style={{ fontSize: 12, fontWeight: 500, color: on ? 'var(--color-primary-text)' : 'var(--text)' }}>{t(`ai.tools.items.${toolId}.label`)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{t(`ai.tools.items.${toolId}.description`)}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
