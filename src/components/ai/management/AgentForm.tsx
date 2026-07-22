/**
 * AgentForm — create/edit an AI agent (model, prompt, FAQs, tools) with an inline
 * ChatTest panel. Used by AgentsTab. Extracted from AIManagementTabs.
 */
import { useState, useEffect, useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Brain, ChevronDown, Eye, EyeOff, MessageSquare, Send, Trash2 } from 'lucide-react'
import api, { unwrap, unwrapList } from '@/lib/api'
import { interactive } from '@/lib/a11y'
import Avatar from '@/components/ui/Avatar'
import ChipMultiSelect from '@/components/ui/ChipMultiSelect'
import { initialsOf } from '@/lib/initials'
import { inputStyle, Field, CopyableValue, SaveBar } from './shared'
import { InterviewFlowSection } from './InterviewFlowSection'
import type { AiAgent, AiItem, ChatMessage } from '@/types/ai'
// Reuse the WhatsApp-templates option shape from the workflow module's template
// picker (GET /whatsapp-templates) instead of re-declaring it (§11 — one truth).
import type { WaTemplateOption } from '@/components/layout/workflow/whatsappTemplate'

// The agent edit-form's local state. No `model` field (MODEL-1): the company-wide
// model from Settings is used everywhere, never chosen per agent.
interface AgentFormState {
  name: string; custom_endpoint: string; custom_api_key: string
  prompt_id: string | number; faq_ids: Array<string | number>; use_knowledge: boolean; max_history: number
  // WA_INTRO_TEMPLATE-1: the approved WhatsApp template that opens the conversation.
  wa_intro_template: string
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
          <button onClick={onClose} aria-label={t('common:close')}
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
              background: m.role === 'user' ? 'var(--color-primary)' : m.error ? 'var(--color-danger-bg)' : 'var(--bg)',
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
                <div key={j} style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--text-muted)', animation: `bounce 1s ease-in-out ${j * 0.2}s infinite` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border)', display: 'flex', gap: 6 }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder={t('ai.chat.placeholder')} aria-label={t('ai.chat.placeholder')}
          style={{ ...inputStyle, flex: 1 }} />
        <button onClick={send} disabled={!input.trim() || loading} aria-label={t('common:send')}
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
    custom_endpoint: agent?.custom_endpoint ?? '',
    // Write-only field (CMBE 2026-07-15/security audit finding D): the stored key
    // never round-trips back from the server, so it never prefills here — only the
    // `has_custom_api_key` flag (below) says one already exists.
    custom_api_key:  '',
    prompt_id:       agent?.prompt_id       ?? '',
    faq_ids:         agent?.faq_ids         ?? [],
    use_knowledge:   agent?.use_knowledge   ?? false,
    max_history:     agent?.max_history     ?? 10,
    wa_intro_template: agent?.wa_intro_template ?? '',
  })
  const [saving,      setSaving]      = useState(false)
  const [saved,       setSaved]       = useState(false)
  const [chatOpen,    setChatOpen]    = useState(false)
  const [showApiKey,  setShowApiKey]  = useState(false)
  const apiKeyId = useId()
  // Custom API override is an optional, rarely-used disclosure (calm by default) —
  // pre-opened only when a value (endpoint or key) is already configured.
  const [showCustomApi, setShowCustomApi] = useState(!!agent?.custom_endpoint || !!agent?.has_custom_api_key)
  // Recomputed on every render (not snapshotted into state) so switching the
  // selected agent in the parent list reflects that agent's own flag.
  const hasCustomApiKey = Boolean(agent?.has_custom_api_key)

  // WA_INTRO_TEMPLATE-1: the tenant's real synced WhatsApp templates — the intro
  // picker MUST offer only these, never free text or a hardcoded name.
  const [waTemplates, setWaTemplates] = useState<WaTemplateOption[]>([])
  const [waLoading,   setWaLoading]   = useState(true)
  useEffect(() => {
    let alive = true
    api.get('/whatsapp-templates')
      .then(r => { if (alive) setWaTemplates(unwrapList<WaTemplateOption>(r).rows) })
      .catch(() => { /* no WhatsApp connection yet — empty state below */ })
      .finally(() => { if (alive) setWaLoading(false) })
    return () => { alive = false }
  }, [])

  const set = <K extends keyof AgentFormState>(k: K, v: AgentFormState[K]) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    setSaving(true); setSaved(false)
    // The API key is write-only — never re-send the masked placeholder. Omit the
    // field entirely unless the user actually typed a new value, so an untouched
    // key is left exactly as stored (security audit finding D).
    const { custom_api_key, ...rest } = form
    const payload: Record<string, unknown> = { ...rest }
    if (custom_api_key) payload.custom_api_key = custom_api_key
    try {
      const res = isNew
        ? await api.post('/ai/agents', payload)
        : await api.put(`/ai/agents/${agent.id}`, payload)
      onSaved(unwrap<AiAgent>(res))
      set('custom_api_key', '') // clear the typed value; has_custom_api_key now covers it
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    } catch { /* noop */ }
    setSaving(false)
  }

  const toggleFaq = (id: string | number) => set('faq_ids', form.faq_ids.includes(id) ? form.faq_ids.filter(x => x !== id) : [...form.faq_ids, id])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--color-violet-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Brain size={15} color="var(--color-violet)" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{isNew ? t('ai.agent.newAgent') : form.name || t('ai.agent.fallback')}</div>
            {/* AI-AGENTS-2: the agent mirrors this recruiter/manager user — same Avatar as elsewhere */}
            {agent?.user && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                <Avatar initials={initialsOf(agent.user.name)} size={14} soft />
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{agent.user.name}</span>
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

          {/* AI-AGENTS-3: the interview design this agent carries — display-only,
              no flow-list endpoint exists yet to make interview_flow_id pickable. */}
          <InterviewFlowSection flow={agent?.interview_flow} />

          <Field label={t('ai.agent.webhookLabel')}>
            {agent?.webhook_url
              ? <CopyableValue value={agent.webhook_url} copyLabel={t('ai.agent.webhookCopy')} copiedMessage={t('ai.agent.webhookCopied')} />
              : <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>{t('ai.agent.webhookEmpty')}</p>}
          </Field>

          <Field label={t('ai.agent.prompt')}>
            <select value={form.prompt_id} onChange={e => set('prompt_id', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="">{t('ai.agent.noPrompt')}</option>
              {prompts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>

          {/* WA_INTRO_TEMPLATE-1: only real, approved, synced templates are selectable —
              never free text. Empty/loading states reuse the workflow module's wa.* copy
              (same GET /whatsapp-templates source) instead of a duplicate key. */}
          <Field label={t('ai.agent.waIntroTemplate')}>
            {waLoading
              ? <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>{t('wa.templateLoading')}</p>
              : waTemplates.length === 0
                ? <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>{t('wa.templateEmpty')}</p>
                : (
                  <select value={form.wa_intro_template} onChange={e => set('wa_intro_template', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value="">{t('ai.agent.noWaTemplate')}</option>
                    {waTemplates.map(tpl => <option key={tpl.value} value={tpl.value}>{tpl.label}</option>)}
                  </select>
                )}
          </Field>

          {/* Kennisbank section — the general-knowledge toggle plus, when the tenant has
              FAQs, which ones this agent may draw on (soft chips, mirrors the entity
              multi-select convention rather than a hand-rolled checkbox list). */}
          <div style={{ marginBottom: 13 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {t('ai.agent.knowledge')}
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 10 }}>
              <div {...interactive(() => set('use_knowledge', !form.use_knowledge))}
                role="switch" aria-checked={form.use_knowledge}
                style={{ width: 34, height: 18, borderRadius: 999, position: 'relative', transition: 'background 0.15s', background: form.use_knowledge ? 'var(--color-primary)' : 'var(--border)', cursor: 'pointer', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: 2, left: form.use_knowledge ? 16 : 2, width: 14, height: 14, borderRadius: '50%', background: 'white', transition: 'left 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
              </div>
              <span style={{ fontSize: 12, color: 'var(--text)' }}>{t('ai.agent.useKnowledge')}</span>
            </label>
            <Field label={t('ai.agent.selectFaqs')}>
              {faqs.length === 0
                ? <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>{t('ai.agent.noFaqs')}</p>
                : (
                  <ChipMultiSelect
                    options={faqs.map(f => ({ value: String(f.id), label: f.name ?? '' }))}
                    selected={form.faq_ids.map(String)}
                    onToggle={toggleFaq}
                  />
                )}
            </Field>
          </div>

          <Field label={t('ai.agent.maxHistory')}>
            <input type="number" min={1} max={50} value={form.max_history}
              onChange={e => set('max_history', Number(e.target.value))} style={{ ...inputStyle, width: 80 }} />
          </Field>

          {/* Custom API override — rare BYO-endpoint escape hatch; collapsed by
              default (calm by default), no longer gated behind a model picker. */}
          <div style={{ marginBottom: 13 }}>
            <button type="button" onClick={() => setShowCustomApi(o => !o)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.04em', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              {t('ai.agent.customApiSection')}
              <ChevronDown size={10} style={{ transform: showCustomApi ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
            </button>
            {showCustomApi && (
              <div style={{ marginTop: 8 }}>
                <Field label={t('ai.agent.apiEndpoint')}>
                  <input value={form.custom_endpoint} onChange={e => set('custom_endpoint', e.target.value)} style={inputStyle} placeholder="https://api.mijnmodel.nl/v1/chat" />
                </Field>
                {/* Masked write-only field (mirrors EmailSettings' smtp_pass /
                    FacebookLeadsSettings' SecretField, security audit finding D): the
                    stored key is never shown or re-sent — only a "✓ set" badge plus a
                    placeholder telling the user blank keeps the current key. */}
                <div style={{ marginBottom: 13 }}>
                  <label htmlFor={apiKeyId} style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {t('ai.agent.apiKey')}
                    {hasCustomApiKey && !form.custom_api_key && (
                      <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--color-success)', fontWeight: 400, textTransform: 'none', letterSpacing: 'normal' }}>
                        {t('ai.agent.apiKeySet')}
                      </span>
                    )}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input id={apiKeyId} type={showApiKey ? 'text' : 'password'} value={form.custom_api_key}
                      onChange={e => set('custom_api_key', e.target.value)}
                      placeholder={hasCustomApiKey ? t('ai.agent.apiKeyKeepPlaceholder') : 'sk-...'}
                      style={{ ...inputStyle, paddingRight: 36 }} />
                    <button type="button" onClick={() => setShowApiKey(s => !s)}
                      aria-label={showApiKey ? t('ai.agent.hideApiKey') : t('ai.agent.showApiKey')}
                      style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                      {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
