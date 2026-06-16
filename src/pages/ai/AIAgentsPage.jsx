/**
 * AIAgentsPage — manage AI agents and their building blocks.
 *
 * Five tabs: Agents (create/configure an agent + inline chat tester), Prompts,
 * FAQ, Kennisbank (knowledge), and Tools. Prompts/FAQ/knowledge support saving
 * with version history. Everything is persisted via /ai/* endpoints.
 *
 * Main blocks below:
 *   - MODELS / STRENGTH_*  → catalog of selectable LLM models + their labels
 *   - TABS                 → the five tab definitions
 *   - AgentForm / ChatTest → configure an agent and test it live
 *   - PromptsTab/FAQTab/...→ list + editor with version history per resource
 */
import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Brain, Plus, Trash2, Save, RefreshCw, Send, User, Bot,
  ChevronRight, Clock, Check, AlertCircle, BookOpen, FileText,
  Wrench, MessageSquare, X, ChevronDown, Eye, Zap,
} from 'lucide-react'
import api from '../../lib/api'
import WorkflowsPage from './WorkflowsPage'

// ─── constants ───────────────────────────────────────────────────────────────

const MODELS = [
  { value: 'gpt-4o',              label: 'GPT-4o',              provider: 'OpenAI',    strength: 'high' },
  { value: 'gpt-4o-mini',         label: 'GPT-4o Mini',         provider: 'OpenAI',    strength: 'medium' },
  { value: 'gpt-4-turbo',         label: 'GPT-4 Turbo',         provider: 'OpenAI',    strength: 'high' },
  { value: 'o1-mini',             label: 'o1 Mini',             provider: 'OpenAI',    strength: 'reasoning' },
  { value: 'o1',                  label: 'o1',                  provider: 'OpenAI',    strength: 'reasoning' },
  { value: 'claude-opus-4-8',     label: 'Claude Opus 4',       provider: 'Anthropic', strength: 'high' },
  { value: 'claude-sonnet-4-6',   label: 'Claude Sonnet 4',     provider: 'Anthropic', strength: 'medium' },
  { value: 'claude-haiku-4-5',    label: 'Claude Haiku 4',      provider: 'Anthropic', strength: 'fast' },
  { value: 'gemini-2.5-pro',      label: 'Gemini 2.5 Pro',      provider: 'Google',    strength: 'high' },
  { value: 'gemini-2.5-flash',    label: 'Gemini 2.5 Flash',    provider: 'Google',    strength: 'medium' },
  { value: 'custom',              label: 'Custom (eigen API)',   provider: 'Custom',    strength: null },
]

const STRENGTH_LABELS = { high: 'Hoog', medium: 'Gemiddeld', fast: 'Snel', reasoning: 'Redeneren' }
const STRENGTH_COLORS = { high: '#7C3AED', medium: '#0369A1', fast: '#16A34A', reasoning: '#D97706' }

const TABS = [
  { id: 'agents',    label: 'Agents',       icon: Brain },
  { id: 'prompts',   label: 'Prompts',      icon: FileText },
  { id: 'faq',       label: 'FAQ',          icon: BookOpen },
  { id: 'knowledge', label: 'Kennisbank',   icon: BookOpen },
  { id: 'tools',     label: 'Tools',        icon: Wrench },
  { id: 'workflows', label: 'Workflows',    icon: Zap },
]

const inputStyle = {
  width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--input-bg)',
  color: 'var(--text)', outline: 'none',
}
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 5 }

// ─── helpers ─────────────────────────────────────────────────────────────────

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

function Badge({ label, color, bg }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 600, color, background: bg,
                   borderRadius: 999, padding: '1px 7px', whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}

function SaveBar({ saving, saved, onSave }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {saved && <span style={{ fontSize: 11, color: '#16A34A', display: 'flex', alignItems: 'center', gap: 4 }}>
        <Check size={11} /> Opgeslagen
      </span>}
      <button onClick={onSave} disabled={saving}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
                 fontSize: 12, fontWeight: 600, borderRadius: 8, border: 'none',
                 background: 'var(--color-primary)', color: 'white', cursor: saving ? 'default' : 'pointer',
                 opacity: saving ? 0.6 : 1 }}>
        {saving ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={12} />}
        Opslaan
      </button>
    </div>
  )
}

// ─── version list ─────────────────────────────────────────────────────────────

function VersionList({ versions, onRestore }) {
  const [open, setOpen] = useState(false)
  if (!versions?.length) return null
  return (
    <div style={{ marginTop: 8 }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)',
                 background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        <Clock size={11} /> {versions.length} versie{versions.length !== 1 ? 's' : ''}
        <ChevronDown size={11} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>
      {open && (
        <div style={{ marginTop: 6, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          {versions.map((v, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                  padding: '7px 12px', borderBottom: i < versions.length - 1 ? '1px solid var(--border)' : 'none',
                                  background: 'var(--bg)', fontSize: 12 }}>
              <span style={{ color: 'var(--text-muted)' }}>
                v{v.version ?? i + 1} — {v.created_at ? new Date(v.created_at).toLocaleString('nl') : ''}
                {v.created_by && <span style={{ marginLeft: 6, color: '#9CA3AF' }}>{v.created_by}</span>}
              </span>
              <button onClick={() => onRestore(v)}
                style={{ fontSize: 11, color: 'var(--color-primary)', background: 'none',
                         border: 'none', cursor: 'pointer', padding: '1px 6px' }}>
                Herstel
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── text editor with save + versioning ──────────────────────────────────────

function TextEditor({ value, onChange, onSave, saving, saved, versions, onRestore, placeholder, height = 260 }) {
  return (
    <div>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ ...inputStyle, height, resize: 'vertical', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6 }}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
        <VersionList versions={versions} onRestore={onRestore} />
        <SaveBar saving={saving} saved={saved} onSave={onSave} />
      </div>
    </div>
  )
}

// ─── Prompts tab ─────────────────────────────────────────────────────────────

function PromptsTab() {
  const [prompts,  setPrompts]  = useState([])
  const [selected, setSelected] = useState(null)
  const [body,     setBody]     = useState('')
  const [name,     setName]     = useState('')
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [versions, setVersions] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    api.get('/ai/prompts').then(r => {
      const list = r.data?.data ?? r.data ?? []
      setPrompts(list)
      if (list.length) select(list[0])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const select = (p) => {
    setSelected(p)
    setBody(p.body ?? p.content ?? '')
    setName(p.name ?? '')
    api.get(`/ai/prompts/${p.id}/versions`).then(r => setVersions(r.data?.data ?? r.data ?? [])).catch(() => setVersions([]))
  }

  const save = async () => {
    setSaving(true); setSaved(false)
    try {
      const res = selected?.id
        ? await api.put(`/ai/prompts/${selected.id}`, { name, body })
        : await api.post('/ai/prompts', { name, body })
      const updated = res.data?.data ?? res.data
      setPrompts(prev => selected?.id
        ? prev.map(p => p.id === updated.id ? updated : p)
        : [updated, ...prev])
      setSelected(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      api.get(`/ai/prompts/${updated.id}/versions`).then(r => setVersions(r.data?.data ?? r.data ?? [])).catch(() => {})
    } catch {}
    setSaving(false)
  }

  const createNew = () => {
    setSelected(null); setBody(''); setName(''); setVersions([])
  }

  const del = async (p) => {
    if (!confirm(`Prompt "${p.name}" verwijderen?`)) return
    await api.delete(`/ai/prompts/${p.id}`).catch(() => {})
    setPrompts(prev => prev.filter(x => x.id !== p.id))
    if (selected?.id === p.id) createNew()
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16, height: '100%' }}>
      {/* List */}
      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Prompts</span>
          <button onClick={createNew} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', padding: 2 }}>
            <Plus size={14} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading && <p style={{ padding: 16, fontSize: 12, color: 'var(--text-muted)' }}>Laden…</p>}
          {prompts.map(p => (
            <div key={p.id} onClick={() => select(p)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                       padding: '9px 14px', cursor: 'pointer', fontSize: 13,
                       background: selected?.id === p.id ? 'var(--color-primary-bg)' : 'transparent',
                       color: selected?.id === p.id ? 'var(--color-primary)' : 'var(--text)',
                       borderBottom: '1px solid var(--border)' }}
              onMouseEnter={e => { if (selected?.id !== p.id) e.currentTarget.style.background = 'var(--hover-bg)' }}
              onMouseLeave={e => { if (selected?.id !== p.id) e.currentTarget.style.background = 'transparent' }}>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
              <button onClick={e => { e.stopPropagation(); del(p) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'transparent', padding: 2, flexShrink: 0 }}
                onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
                onMouseLeave={e => (e.currentTarget.style.color = 'transparent')}>
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      </div>
      {/* Editor */}
      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 20 }}>
        <Field label="Naam">
          <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder="Bijv. Yessy systeem prompt" />
        </Field>
        <Field label="Inhoud">
          <TextEditor
            value={body} onChange={setBody} onSave={save} saving={saving} saved={saved}
            versions={versions} onRestore={v => setBody(v.body ?? v.content ?? '')}
            placeholder="Je bent een vriendelijke AI assistent…" height={320}
          />
        </Field>
      </div>
    </div>
  )
}

// ─── FAQ tab ─────────────────────────────────────────────────────────────────

function FAQTab() {
  const [faqs,     setFaqs]     = useState([])
  const [selected, setSelected] = useState(null)
  const [name,     setName]     = useState('')
  const [body,     setBody]     = useState('')
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [versions, setVersions] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    api.get('/ai/faqs').then(r => {
      const list = r.data?.data ?? r.data ?? []
      setFaqs(list)
      if (list.length) select(list[0])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const select = (f) => {
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

  const del = async (f) => {
    if (!confirm(`FAQ "${f.name}" verwijderen?`)) return
    await api.delete(`/ai/faqs/${f.id}`).catch(() => {})
    setFaqs(prev => prev.filter(x => x.id !== f.id))
    if (selected?.id === f.id) { setSelected(null); setName(''); setBody('') }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16, height: '100%' }}>
      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>FAQ's</span>
          <button onClick={() => { setSelected(null); setName(''); setBody(''); setVersions([]) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', padding: 2 }}>
            <Plus size={14} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading && <p style={{ padding: 16, fontSize: 12, color: 'var(--text-muted)' }}>Laden…</p>}
          {faqs.map(f => (
            <div key={f.id} onClick={() => select(f)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                       padding: '9px 14px', cursor: 'pointer', fontSize: 13,
                       background: selected?.id === f.id ? 'var(--color-primary-bg)' : 'transparent',
                       color: selected?.id === f.id ? 'var(--color-primary)' : 'var(--text)',
                       borderBottom: '1px solid var(--border)' }}
              onMouseEnter={e => { if (selected?.id !== f.id) e.currentTarget.style.background = 'var(--hover-bg)' }}
              onMouseLeave={e => { if (selected?.id !== f.id) e.currentTarget.style.background = 'transparent' }}>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
              <button onClick={e => { e.stopPropagation(); del(f) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'transparent', padding: 2 }}
                onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
                onMouseLeave={e => (e.currentTarget.style.color = 'transparent')}>
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      </div>
      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 20 }}>
        <Field label="Naam">
          <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder="Bijv. Veelgestelde vragen diensten" />
        </Field>
        <Field label="Inhoud (vraag + antwoord formaat)">
          <TextEditor
            value={body} onChange={setBody} onSave={save} saving={saving} saved={saved}
            versions={versions} onRestore={v => setBody(v.body ?? v.content ?? '')}
            placeholder={"V: Hoe meld ik me af voor een dienst?\nA: Stuur een bericht via WhatsApp...\n\nV: ...\nA: ..."} height={320}
          />
        </Field>
      </div>
    </div>
  )
}

// ─── Knowledge tab ────────────────────────────────────────────────────────────

function KnowledgeTab() {
  const [items,    setItems]    = useState([])
  const [selected, setSelected] = useState(null)
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
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16, height: '100%' }}>
      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Kennisbank</span>
          <button onClick={() => { setSelected(null); setName(''); setBody('') }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', padding: 2 }}>
            <Plus size={14} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading && <p style={{ padding: 16, fontSize: 12, color: 'var(--text-muted)' }}>Laden…</p>}
          {items.map(item => (
            <div key={item.id} onClick={() => { setSelected(item); setName(item.name ?? ''); setBody(item.body ?? item.content ?? '') }}
              style={{ padding: '9px 14px', cursor: 'pointer', fontSize: 13,
                       background: selected?.id === item.id ? 'var(--color-primary-bg)' : 'transparent',
                       color: selected?.id === item.id ? 'var(--color-primary)' : 'var(--text)',
                       borderBottom: '1px solid var(--border)' }}
              onMouseEnter={e => { if (selected?.id !== item.id) e.currentTarget.style.background = 'var(--hover-bg)' }}
              onMouseLeave={e => { if (selected?.id !== item.id) e.currentTarget.style.background = 'transparent' }}>
              {item.name}
            </div>
          ))}
        </div>
      </div>
      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 20 }}>
        <Field label="Naam">
          <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder="Bijv. Arbeidsvoorwaarden" />
        </Field>
        <Field label="Inhoud">
          <TextEditor value={body} onChange={setBody} onSave={save} saving={saving} saved={saved}
            versions={[]} onRestore={() => {}}
            placeholder="Voer kennisbank-inhoud in…" height={340} />
        </Field>
      </div>
    </div>
  )
}

// ─── Tools tab ────────────────────────────────────────────────────────────────

function ToolsTab() {
  const BUILTIN_TOOLS = [
    { id: 'shift_lookup',      label: 'Dienst opzoeken',        description: 'Zoekt beschikbare diensten op voor een kandidaat' },
    { id: 'candidate_status',  label: 'Kandidaatstatus',        description: 'Haalt de huidige status en pool op van een kandidaat' },
    { id: 'send_whatsapp',     label: 'WhatsApp sturen',        description: 'Stuurt een bericht naar de kandidaat via WhatsApp' },
    { id: 'update_candidate',  label: 'Kandidaat updaten',      description: 'Past status, notities of beschikbaarheid aan' },
    { id: 'knowledge_search',  label: 'Kennisbank doorzoeken',  description: 'Zoekt relevante informatie op in de kennisbank' },
    { id: 'calendar_check',    label: 'Agenda raadplegen',      description: 'Controleert rooster en diensten van een kandidaat' },
  ]
  const [enabled, setEnabled] = useState(() => new Set(['shift_lookup', 'knowledge_search']))

  const toggle = id => setEnabled(prev => {
    const n = new Set(prev)
    n.has(id) ? n.delete(id) : n.add(id)
    return n
  })

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 20, maxWidth: 640 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Beschikbare tools</h3>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18 }}>Activeer welke tools een agent mag gebruiken</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {BUILTIN_TOOLS.map(tool => {
          const on = enabled.has(tool.id)
          return (
            <div key={tool.id} onClick={() => toggle(tool.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                       background: on ? 'var(--color-primary-bg)' : 'var(--bg)',
                       border: `1px solid ${on ? 'var(--color-primary)' : 'var(--border)'}`,
                       transition: 'all 0.15s' }}>
              <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${on ? 'var(--color-primary)' : 'var(--border)'}`,
                             background: on ? 'var(--color-primary)' : 'transparent', flexShrink: 0,
                             display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {on && <Check size={11} color="white" />}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: on ? 'var(--color-primary)' : 'var(--text)' }}>{tool.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{tool.description}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Chat test ────────────────────────────────────────────────────────────────

function ChatTest({ agent }) {
  const [messages, setMessages] = useState([])
  const [input,    setInput]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    const userMsg = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)
    try {
      const res = await api.post(`/ai/agents/${agent.id}/chat`, {
        message: text,
        history: messages.slice(-10),
      })
      const reply = res.data?.reply ?? res.data?.message ?? res.data?.content ?? '(geen antwoord)'
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠ Fout bij ophalen antwoord.', error: true }])
    }
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--surface)',
                  borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <MessageSquare size={14} color="var(--color-primary)" />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Test — {agent.name}</span>
        <button onClick={() => setMessages([])}
          style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
          Wissen
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, marginTop: 40 }}>
            Stuur een bericht om de agent te testen
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '75%', padding: '9px 13px', borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
              background: m.role === 'user' ? 'var(--color-primary)' : m.error ? '#FEF2F2' : 'var(--bg)',
              color: m.role === 'user' ? 'white' : m.error ? '#DC2626' : 'var(--text)',
              fontSize: 13, lineHeight: 1.5, border: m.role === 'user' ? 'none' : '1px solid var(--border)',
            }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ padding: '9px 13px', borderRadius: '12px 12px 12px 2px', background: 'var(--bg)',
                          border: '1px solid var(--border)', display: 'flex', gap: 4, alignItems: 'center' }}>
              {[0,1,2].map(j => (
                <div key={j} style={{ width: 6, height: 6, borderRadius: '50%', background: '#9CA3AF',
                                      animation: `bounce 1s ease-in-out ${j * 0.2}s infinite` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Typ een bericht…"
          style={{ ...inputStyle, flex: 1 }} />
        <button onClick={send} disabled={!input.trim() || loading}
          style={{ width: 36, height: 36, borderRadius: 8, border: 'none', background: 'var(--color-primary)',
                   color: 'white', cursor: input.trim() ? 'pointer' : 'default',
                   opacity: input.trim() ? 1 : 0.4, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Send size={14} />
        </button>
      </div>
    </div>
  )
}

// ─── Agent form ───────────────────────────────────────────────────────────────

function AgentForm({ agent, prompts, faqs, onSaved, onDelete }) {
  const isNew = !agent?.id
  const [form,    setForm]    = useState({
    name:            agent?.name            ?? '',
    model:           agent?.model           ?? 'gpt-4o-mini',
    custom_endpoint: agent?.custom_endpoint ?? '',
    custom_api_key:  agent?.custom_api_key  ?? '',
    prompt_id:       agent?.prompt_id       ?? '',
    faq_ids:         agent?.faq_ids         ?? [],
    use_knowledge:   agent?.use_knowledge   ?? false,
    max_history:     agent?.max_history     ?? 10,
  })
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [chatOpen, setChatOpen] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    setSaving(true); setSaved(false)
    try {
      const res = isNew
        ? await api.post('/ai/agents', form)
        : await api.put(`/ai/agents/${agent.id}`, form)
      onSaved(res.data?.data ?? res.data)
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    } catch {}
    setSaving(false)
  }

  const selectedModel = MODELS.find(m => m.value === form.model)

  const toggleFaq = id => set('faq_ids', form.faq_ids.includes(id) ? form.faq_ids.filter(x => x !== id) : [...form.faq_ids, id])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F5F3FF',
                        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Brain size={18} color="#7C3AED" />
          </div>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
              {isNew ? 'Nieuwe agent' : form.name || 'Agent'}
            </h3>
            {selectedModel && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{selectedModel.provider}</span>
                {selectedModel.strength && (
                  <Badge label={STRENGTH_LABELS[selectedModel.strength]}
                    color={STRENGTH_COLORS[selectedModel.strength]}
                    bg={STRENGTH_COLORS[selectedModel.strength] + '18'} />
                )}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {!isNew && (
            <button onClick={() => setChatOpen(o => !o)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: 12, fontWeight: 500,
                       borderRadius: 8, border: '1px solid var(--border)', background: chatOpen ? 'var(--color-primary-bg)' : 'var(--surface)',
                       color: chatOpen ? 'var(--color-primary)' : 'var(--text-muted)', cursor: 'pointer' }}>
              <MessageSquare size={13} /> Test
            </button>
          )}
          {!isNew && (
            <button onClick={() => onDelete(agent)}
              style={{ padding: '6px 10px', fontSize: 12, borderRadius: 8, border: '1px solid var(--border)',
                       background: 'var(--surface)', color: '#EF4444', cursor: 'pointer' }}>
              <Trash2 size={13} />
            </button>
          )}
          <SaveBar saving={saving} saved={saved} onSave={save} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: chatOpen ? '1fr 380px' : '1fr', gap: 16, flex: 1, minHeight: 0 }}>
        <div style={{ overflowY: 'auto' }}>
          <Field label="Naam">
            <input value={form.name} onChange={e => set('name', e.target.value)} style={inputStyle} placeholder="Bijv. Yessy AI" />
          </Field>

          <Field label="Model">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {MODELS.map(m => (
                <div key={m.value} onClick={() => set('model', m.value)}
                  style={{ padding: '8px 10px', borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s',
                           border: `1.5px solid ${form.model === m.value ? 'var(--color-primary)' : 'var(--border)'}`,
                           background: form.model === m.value ? 'var(--color-primary-bg)' : 'var(--bg)' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: form.model === m.value ? 'var(--color-primary)' : 'var(--text)' }}>
                    {m.label}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, display: 'flex', gap: 5 }}>
                    {m.provider}
                    {m.strength && <Badge label={STRENGTH_LABELS[m.strength]} color={STRENGTH_COLORS[m.strength]} bg={STRENGTH_COLORS[m.strength] + '18'} />}
                  </div>
                </div>
              ))}
            </div>
          </Field>

          {form.model === 'custom' && (
            <>
              <Field label="API Endpoint">
                <input value={form.custom_endpoint} onChange={e => set('custom_endpoint', e.target.value)} style={inputStyle} placeholder="https://api.mijnmodel.nl/v1/chat" />
              </Field>
              <Field label="API Key">
                <input type="password" value={form.custom_api_key} onChange={e => set('custom_api_key', e.target.value)} style={inputStyle} placeholder="sk-..." />
              </Field>
            </>
          )}

          <Field label="Instructie (Prompt)">
            <select value={form.prompt_id} onChange={e => set('prompt_id', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="">— Geen prompt geselecteerd —</option>
              {prompts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>

          <Field label="FAQ's selecteren">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto',
                          border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
              {faqs.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: 4 }}>Geen FAQ's aangemaakt</p>}
              {faqs.map(f => {
                const on = form.faq_ids.includes(f.id)
                return (
                  <label key={f.id} onClick={() => toggleFaq(f.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                             padding: '5px 8px', borderRadius: 6,
                             background: on ? 'var(--color-primary-bg)' : 'transparent' }}>
                    <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${on ? 'var(--color-primary)' : 'var(--border)'}`,
                                   background: on ? 'var(--color-primary)' : 'transparent', flexShrink: 0,
                                   display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {on && <Check size={9} color="white" />}
                    </div>
                    <span style={{ fontSize: 12, color: on ? 'var(--color-primary)' : 'var(--text)' }}>{f.name}</span>
                  </label>
                )
              })}
            </div>
          </Field>

          <Field label="Kennisbank">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <div onClick={() => set('use_knowledge', !form.use_knowledge)}
                style={{ width: 36, height: 20, borderRadius: 999, position: 'relative', transition: 'background 0.15s',
                         background: form.use_knowledge ? 'var(--color-primary)' : '#D1D5DB', cursor: 'pointer', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: 2, left: form.use_knowledge ? 18 : 2, width: 16, height: 16,
                               borderRadius: '50%', background: 'white', transition: 'left 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
              </div>
              <span style={{ fontSize: 13, color: 'var(--text)' }}>Algemene kennisbank gebruiken</span>
            </label>
          </Field>

          <Field label="Max. conversatiehistorie">
            <input type="number" min={1} max={50} value={form.max_history}
              onChange={e => set('max_history', Number(e.target.value))} style={{ ...inputStyle, width: 100 }} />
          </Field>
        </div>

        {chatOpen && !isNew && <ChatTest agent={{ ...agent, name: form.name }} />}
      </div>
    </div>
  )
}

// ─── Agents tab ───────────────────────────────────────────────────────────────

function AgentsTab() {
  const [agents,   setAgents]   = useState([])
  const [selected, setSelected] = useState(null)
  const [prompts,  setPrompts]  = useState([])
  const [faqs,     setFaqs]     = useState([])
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
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const newAgent = () => setSelected({ _new: true })

  const onSaved = (agent) => {
    setAgents(prev => {
      const exists = prev.find(a => a.id === agent.id)
      return exists ? prev.map(a => a.id === agent.id ? agent : a) : [agent, ...prev]
    })
    setSelected(agent)
  }

  const onDelete = async (agent) => {
    if (!confirm(`Agent "${agent.name}" verwijderen?`)) return
    await api.delete(`/ai/agents/${agent.id}`).catch(() => {})
    setAgents(prev => prev.filter(a => a.id !== agent.id))
    setSelected(agents.find(a => a.id !== agent.id) ?? null)
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16, height: '100%' }}>
      {/* Agent list */}
      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Agents</span>
          <button onClick={newAgent} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', padding: 2 }}>
            <Plus size={14} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading && <p style={{ padding: 16, fontSize: 12, color: 'var(--text-muted)' }}>Laden…</p>}
          {!loading && agents.length === 0 && (
            <p style={{ padding: 16, fontSize: 12, color: 'var(--text-muted)' }}>Nog geen agents. Klik + om te starten.</p>
          )}
          {agents.map(a => {
            const m = MODELS.find(x => x.value === a.model)
            return (
              <div key={a.id} onClick={() => setSelected(a)}
                style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13,
                         background: selected?.id === a.id ? 'var(--color-primary-bg)' : 'transparent',
                         borderBottom: '1px solid var(--border)' }}
                onMouseEnter={e => { if (selected?.id !== a.id) e.currentTarget.style.background = 'var(--hover-bg)' }}
                onMouseLeave={e => { if (selected?.id !== a.id) e.currentTarget.style.background = 'transparent' }}>
                <div style={{ fontWeight: 500, color: selected?.id === a.id ? 'var(--color-primary)' : 'var(--text)' }}>{a.name}</div>
                {m && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{m.provider} — {m.label}</div>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Form */}
      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 20, overflowY: 'auto' }}>
        {selected
          ? <AgentForm agent={selected._new ? null : selected} prompts={prompts} faqs={faqs} onSaved={onSaved} onDelete={onDelete} />
          : <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--text-muted)', fontSize: 13 }}>
              Selecteer een agent of maak een nieuwe aan
            </div>
        }
      </div>
    </div>
  )
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function AIAgentsPage() {
  const [tab, setTab] = useState('agents')
  const ActiveTab = { agents: AgentsTab, prompts: PromptsTab, faq: FAQTab, knowledge: KnowledgeTab, tools: ToolsTab, workflows: WorkflowsPage }[tab]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '20px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexShrink: 0 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F5F3FF',
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Brain size={18} color="#7C3AED" />
        </div>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px' }}>AI & Workflows</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>Configureer agents, prompts en geautomatiseerde workflows</p>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexShrink: 0,
                    background: 'var(--surface)', borderRadius: 10, padding: 4,
                    border: '1px solid var(--border)', width: 'fit-content' }}>
        {TABS.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
                       fontSize: 12, fontWeight: active ? 600 : 400, borderRadius: 7, border: 'none',
                       background: active ? 'var(--color-primary)' : 'transparent',
                       color: active ? 'white' : 'var(--text-muted)', cursor: 'pointer',
                       transition: 'all 0.15s' }}>
              <Icon size={13} />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <ActiveTab />
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0) }
          30% { transform: translateY(-6px) }
        }
      `}</style>
    </div>
  )
}
