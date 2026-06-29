/**
 * AgentForm — create/edit an AI agent (model, prompt, FAQs, tools) with an inline
 * ChatTest panel. Used by AgentsTab. Extracted from AIManagementTabs.
 */
import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Brain, Check, MessageSquare, Send, Trash2 } from 'lucide-react'
import api from '@/lib/api'
import { interactive } from '@/lib/a11y'
import { MODELS, STRENGTH_COLORS, inputStyle, Field, Badge, SaveBar } from './shared'
import type { AiAgent, AiItem, ChatMessage } from '@/types/ai'

// The agent edit-form's local state.
interface AgentFormState {
  name: string; model: string; custom_endpoint: string; custom_api_key: string
  prompt_id: string | number; faq_ids: Array<string | number>; use_knowledge: boolean; max_history: number
}

// ── Chat test ─────────────────────────────────────────────────────────────────

function ChatTest({ agent, onClose }: { agent: AiAgent; onClose?: () => void }) {
  const { t } = useTranslation('workflows')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input,    setInput]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

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

export function AgentForm({ agent, prompts, faqs, onSaved, onDelete }: {
  agent: AiAgent | null; prompts: AiItem[]; faqs: AiItem[]; onSaved: (a: AiAgent) => void; onDelete: (a: AiAgent) => void
}) {
  const { t } = useTranslation('workflows')
  const isNew = !agent?.id
  const [form, setForm] = useState<AgentFormState>({
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

  const set = <K extends keyof AgentFormState>(k: K, v: AgentFormState[K]) => setForm(f => ({ ...f, [k]: v }))

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

  const toggleFaq = (id: string | number) => set('faq_ids', form.faq_ids.includes(id) ? form.faq_ids.filter(x => x !== id) : [...form.faq_ids, id])

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
            <button onClick={() => agent && onDelete(agent)}
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
                <div key={m.value} {...interactive(() => set('model', m.value))}
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
                const fid = f.id as string | number
                const on = form.faq_ids.includes(fid)
                return (
                  <label key={f.id} onClick={() => toggleFaq(fid)}
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
              <div {...interactive(() => set('use_knowledge', !form.use_knowledge))}
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
