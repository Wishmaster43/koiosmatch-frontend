/**
 * AIManagementTabs — management panels rendered inside the ConfigPanel
 * when an ai_agent workflow module is selected.
 *
 * Exports: AgentsTab, PromptsTab, FAQTab, KnowledgeTab, ToolsTab
 */
import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Brain, Plus, Trash2, Save, RefreshCw, Send, Check,
  Clock, ChevronDown, MessageSquare, Wrench,
} from 'lucide-react'
import api from '../../lib/api'

// ── constants ─────────────────────────────────────────────────────────────────

export const MODELS = [
  { value: 'gpt-4o',            label: 'GPT-4o',            provider: 'OpenAI',    strength: 'high' },
  { value: 'gpt-4o-mini',       label: 'GPT-4o Mini',       provider: 'OpenAI',    strength: 'medium' },
  { value: 'gpt-4-turbo',       label: 'GPT-4 Turbo',       provider: 'OpenAI',    strength: 'high' },
  { value: 'o1-mini',           label: 'o1 Mini',           provider: 'OpenAI',    strength: 'reasoning' },
  { value: 'o1',                label: 'o1',                provider: 'OpenAI',    strength: 'reasoning' },
  { value: 'claude-opus-4-8',   label: 'Claude Opus 4',     provider: 'Anthropic', strength: 'high' },
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4',   provider: 'Anthropic', strength: 'medium' },
  { value: 'claude-haiku-4-5',  label: 'Claude Haiku 4',    provider: 'Anthropic', strength: 'fast' },
  { value: 'gemini-2.5-pro',    label: 'Gemini 2.5 Pro',    provider: 'Google',    strength: 'high' },
  { value: 'gemini-2.5-flash',  label: 'Gemini 2.5 Flash',  provider: 'Google',    strength: 'medium' },
  { value: 'custom',            label: 'Custom (eigen API)', provider: 'Custom',    strength: null },
]

// Strength → colour; label = t('ai.strength.<key>').
const STRENGTH_COLORS = { high: '#7C3AED', medium: '#0369A1', fast: '#16A34A', reasoning: '#D97706' }

const inputStyle = {
  width: '100%', padding: '7px 10px', fontSize: 13, borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--input-bg)',
  color: 'var(--text)', outline: 'none', boxSizing: 'border-box',
}

// ── shared helpers ────────────────────────────────────────────────────────────

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 13 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function Badge({ label, color, bg }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 600, color, background: bg, borderRadius: 999, padding: '1px 6px', whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}

function SaveBar({ saving, saved, onSave }) {
  const { t } = useTranslation('workflows')
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {saved && (
        <span style={{ fontSize: 11, color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: 3 }}>
          <Check size={11} /> {t('ai.saved')}
        </span>
      )}
      <button onClick={onSave} disabled={saving}
        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', fontSize: 12, fontWeight: 600,
          borderRadius: 8, border: 'none', background: 'var(--color-primary)', color: 'white',
          cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1 }}>
        {saving
          ? <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} />
          : <Save size={11} />}
        {t('common:save')}
      </button>
    </div>
  )
}

function VersionList({ versions, onRestore }) {
  const { t } = useTranslation('workflows')
  const [open, setOpen] = useState(false)
  if (!versions?.length) return null
  return (
    <div style={{ marginTop: 6 }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        <Clock size={11} /> {t('ai.versions', { count: versions.length })}
        <ChevronDown size={10} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>
      {open && (
        <div style={{ marginTop: 5, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          {versions.map((v, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '6px 10px', borderBottom: i < versions.length - 1 ? '1px solid var(--border)' : 'none',
              background: 'var(--bg)', fontSize: 11 }}>
              <span style={{ color: 'var(--text-muted)' }}>
                v{v.version ?? i + 1} — {v.created_at ? new Date(v.created_at).toLocaleString() : ''}
              </span>
              <button onClick={() => onRestore(v)}
                style={{ fontSize: 11, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: '1px 5px' }}>
                {t('ai.restore')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TextEditor({ value, onChange, onSave, saving, saved, versions, onRestore, placeholder, height = 220 }) {
  return (
    <div>
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ ...inputStyle, height, resize: 'vertical', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6 }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
        <VersionList versions={versions} onRestore={onRestore} />
        <SaveBar saving={saving} saved={saved} onSave={onSave} />
      </div>
    </div>
  )
}

// ── SideList — reusable left-list + right-detail layout ──────────────────────

function SideList({ title, items, selected, onSelect, onNew, loading, renderItem, children }) {
  const { t } = useTranslation('workflows')
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 12, height: '100%', minHeight: 0 }}>
      {/* List */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--surface)' }}>
        <div style={{ padding: '9px 11px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{title}</span>
          <button onClick={onNew} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', padding: 2 }}>
            <Plus size={13} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading && <p style={{ padding: '12px 11px', fontSize: 12, color: 'var(--text-muted)' }}>{t('ai.loading')}</p>}
          {!loading && items.length === 0 && (
            <p style={{ padding: '12px 11px', fontSize: 12, color: 'var(--text-muted)' }}>{t('ai.emptyStart')}</p>
          )}
          {items.map(item => renderItem(item, selected?.id === item.id))}
        </div>
      </div>
      {/* Detail */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, overflowY: 'auto', background: 'var(--surface)' }}>
        {children}
      </div>
    </div>
  )
}

function ListRow({ item, active, onSelect, label, sublabel, onDelete }) {
  return (
    <div onClick={() => onSelect(item)}
      style={{ padding: '8px 11px', cursor: 'pointer', fontSize: 12,
        background: active ? 'var(--color-primary-bg)' : 'transparent',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--hover-bg)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{ fontWeight: 500, color: active ? 'var(--color-primary)' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
        {sublabel && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{sublabel}</div>}
      </div>
      {onDelete && (
        <button onClick={e => { e.stopPropagation(); onDelete(item) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'transparent', padding: 2, flexShrink: 0 }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-danger)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'transparent')}>
          <Trash2 size={10} />
        </button>
      )}
    </div>
  )
}

// ── Chat test ─────────────────────────────────────────────────────────────────

function ChatTest({ agent, onClose }) {
  const { t } = useTranslation('workflows')
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
      const res = await api.post(`/ai/agents/${agent.id}/chat`, { message: text, history: messages.slice(-10) })
      const reply = res.data?.reply ?? res.data?.message ?? res.data?.content ?? t('ai.chat.noReply')
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: t('ai.chat.error'), error: true }])
    }
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden', background: 'var(--surface)' }}>
      <div style={{ padding: '9px 13px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <MessageSquare size={13} color="var(--color-primary)" />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', flex: 1 }}>{t('ai.chat.test')} — {agent.name}</span>
        <button onClick={() => setMessages([])}
          style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
          {t('ai.chat.clear')}
        </button>
        {onClose && (
          <button onClick={onClose}
            style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
            ✕
          </button>
        )}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, marginTop: 32 }}>
            {t('ai.chat.empty')}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '80%', padding: '7px 11px', fontSize: 12, lineHeight: 1.5,
              borderRadius: m.role === 'user' ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
              background: m.role === 'user' ? 'var(--color-primary)' : m.error ? '#FEF2F2' : 'var(--bg)',
              color: m.role === 'user' ? 'white' : m.error ? 'var(--color-danger)' : 'var(--text)',
              border: m.role === 'user' ? 'none' : '1px solid var(--border)',
            }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex' }}>
            <div style={{ padding: '7px 11px', borderRadius: '10px 10px 10px 2px', background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', gap: 3 }}>
              {[0,1,2].map(j => (
                <div key={j} style={{ width: 5, height: 5, borderRadius: '50%', background: '#9CA3AF', animation: `bounce 1s ease-in-out ${j * 0.2}s infinite` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border)', display: 'flex', gap: 6 }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder={t('ai.chat.placeholder')}
          style={{ ...inputStyle, flex: 1 }} />
        <button onClick={send} disabled={!input.trim() || loading}
          style={{ width: 32, height: 32, borderRadius: 7, border: 'none', background: 'var(--color-primary)', color: 'white',
            cursor: input.trim() ? 'pointer' : 'default', opacity: input.trim() ? 1 : 0.4,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Send size={13} />
        </button>
      </div>
    </div>
  )
}

// ── Agent form ────────────────────────────────────────────────────────────────

function AgentForm({ agent, prompts, faqs, onSaved, onDelete }) {
  const { t } = useTranslation('workflows')
  const isNew = !agent?.id
  const [form, setForm] = useState({
    name:            agent?.name            ?? '',
    model:           agent?.model           ?? 'gpt-4o-mini',
    custom_endpoint: agent?.custom_endpoint ?? '',
    custom_api_key:  agent?.custom_api_key  ?? '',
    prompt_id:       agent?.prompt_id       ?? '',
    faq_ids:         agent?.faq_ids         ?? [],
    use_knowledge:   agent?.use_knowledge   ?? false,
    max_history:     agent?.max_history     ?? 10,
  })
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
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
    } catch { /* noop */ }
    setSaving(false)
  }

  const toggleFaq = id => set('faq_ids', form.faq_ids.includes(id) ? form.faq_ids.filter(x => x !== id) : [...form.faq_ids, id])

  const selectedModel = MODELS.find(m => m.value === form.model)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Brain size={15} color="#7C3AED" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{isNew ? t('ai.agent.newAgent') : form.name || t('ai.agent.fallback')}</div>
            {selectedModel && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{selectedModel.provider}</span>
                {selectedModel.strength && (
                  <Badge label={t(`ai.strength.${selectedModel.strength}`)}
                    color={STRENGTH_COLORS[selectedModel.strength]}
                    bg={STRENGTH_COLORS[selectedModel.strength] + '18'} />
                )}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {!isNew && (
            <button onClick={() => setChatOpen(o => !o)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: 12, fontWeight: 500,
                borderRadius: 8, border: '1px solid var(--border)',
                background: chatOpen ? 'var(--color-primary-bg)' : 'var(--surface)',
                color: chatOpen ? 'var(--color-primary)' : 'var(--text-muted)', cursor: 'pointer' }}>
              <MessageSquare size={12} /> {t('ai.chat.test')}
            </button>
          )}
          {!isNew && (
            <button onClick={() => onDelete(agent)}
              style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--color-danger)', cursor: 'pointer', display: 'flex' }}>
              <Trash2 size={12} />
            </button>
          )}
          <SaveBar saving={saving} saved={saved} onSave={save} />
        </div>
      </div>

      {chatOpen && !isNew ? (
        <div style={{ height: 320 }}>
          <ChatTest agent={{ ...agent, name: form.name }} onClose={() => setChatOpen(false)} />
        </div>
      ) : (
        <>
          <Field label={t('ai.field.name')}>
            <input value={form.name} onChange={e => set('name', e.target.value)} style={inputStyle} placeholder={t('ai.agent.namePlaceholder')} />
          </Field>

          <Field label={t('ai.agent.model')}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
              {MODELS.map(m => (
                <div key={m.value} onClick={() => set('model', m.value)}
                  style={{ padding: '7px 9px', borderRadius: 8, cursor: 'pointer', transition: 'all 0.12s',
                    border: `1.5px solid ${form.model === m.value ? 'var(--color-primary)' : 'var(--border)'}`,
                    background: form.model === m.value ? 'var(--color-primary-bg)' : 'var(--bg)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: form.model === m.value ? 'var(--color-primary)' : 'var(--text)' }}>
                    {m.label}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{m.provider}</div>
                </div>
              ))}
            </div>
          </Field>

          {form.model === 'custom' && (
            <>
              <Field label={t('ai.agent.apiEndpoint')}>
                <input value={form.custom_endpoint} onChange={e => set('custom_endpoint', e.target.value)} style={inputStyle} placeholder="https://api.mijnmodel.nl/v1/chat" />
              </Field>
              <Field label={t('ai.agent.apiKey')}>
                <input type="password" value={form.custom_api_key} onChange={e => set('custom_api_key', e.target.value)} style={inputStyle} placeholder="sk-..." />
              </Field>
            </>
          )}

          <Field label={t('ai.agent.prompt')}>
            <select value={form.prompt_id} onChange={e => set('prompt_id', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="">{t('ai.agent.noPrompt')}</option>
              {prompts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>

          <Field label={t('ai.agent.selectFaqs')}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 160, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
              {faqs.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('ai.agent.noFaqs')}</p>}
              {faqs.map(f => {
                const on = form.faq_ids.includes(f.id)
                return (
                  <label key={f.id} onClick={() => toggleFaq(f.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', padding: '4px 6px', borderRadius: 6, background: on ? 'var(--color-primary-bg)' : 'transparent' }}>
                    <div style={{ width: 14, height: 14, borderRadius: 4, border: `2px solid ${on ? 'var(--color-primary)' : 'var(--border)'}`, background: on ? 'var(--color-primary)' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {on && <Check size={9} color="white" />}
                    </div>
                    <span style={{ fontSize: 12, color: on ? 'var(--color-primary)' : 'var(--text)' }}>{f.name}</span>
                  </label>
                )
              })}
            </div>
          </Field>

          <Field label={t('ai.agent.knowledge')}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <div onClick={() => set('use_knowledge', !form.use_knowledge)}
                style={{ width: 34, height: 18, borderRadius: 999, position: 'relative', transition: 'background 0.15s', background: form.use_knowledge ? 'var(--color-primary)' : '#D1D5DB', cursor: 'pointer', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: 2, left: form.use_knowledge ? 16 : 2, width: 14, height: 14, borderRadius: '50%', background: 'white', transition: 'left 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
              </div>
              <span style={{ fontSize: 12, color: 'var(--text)' }}>{t('ai.agent.useKnowledge')}</span>
            </label>
          </Field>

          <Field label={t('ai.agent.maxHistory')}>
            <input type="number" min={1} max={50} value={form.max_history}
              onChange={e => set('max_history', Number(e.target.value))} style={{ ...inputStyle, width: 80 }} />
          </Field>
        </>
      )}
    </div>
  )
}

// ── Agents tab ────────────────────────────────────────────────────────────────

export function AgentsTab() {
  const { t } = useTranslation('workflows')
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
    }).catch(() => { /* noop */ }).finally(() => setLoading(false))
  }, [])

  const onSaved = (agent) => {
    setAgents(prev => {
      const exists = prev.find(a => a.id === agent.id)
      return exists ? prev.map(a => a.id === agent.id ? agent : a) : [agent, ...prev]
    })
    setSelected(agent)
  }

  const onDelete = async (agent) => {
    if (!confirm(t('ai.agent.confirmDelete', { name: agent.name }))) return
    await api.delete(`/ai/agents/${agent.id}`).catch(() => {})
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
  const [prompts,  setPrompts]  = useState([])
  const [selected, setSelected] = useState(null)
  const [name,     setName]     = useState('')
  const [body,     setBody]     = useState('')
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

  const del = async (p) => {
    if (!confirm(t('ai.prompts.confirmDelete', { name: p.name }))) return
    await api.delete(`/ai/prompts/${p.id}`).catch(() => {})
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
    if (!confirm(t('ai.faqs.confirmDelete', { name: f.name }))) return
    await api.delete(`/ai/faqs/${f.id}`).catch(() => {})
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
  const [enabled, setEnabled] = useState(() => new Set(['shift_lookup', 'knowledge_search']))

  const toggle = id => setEnabled(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{t('ai.tools.hint')}</p>
      {BUILTIN_TOOLS.map(toolId => {
        const on = enabled.has(toolId)
        return (
          <div key={toolId} onClick={() => toggle(toolId)}
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
