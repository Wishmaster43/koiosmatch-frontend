/**
 * AgentForm — create/edit an AI agent (model, prompt, FAQs, tools) with an inline
 * ChatTest panel. Used by AgentsTab. Extracted from AIManagementTabs.
 */
import { useState, useEffect, useId, useRef } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { useDateFormat } from '@/lib/datetime'
import { Brain, ChevronDown, Eye, EyeOff, MessageSquare, Send, Trash2 } from 'lucide-react'
import api, { unwrap, unwrapList } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import Avatar from '@/components/ui/Avatar'
// G34: the house searchable dropdown replaces the native prompt/WA-template <select>s.
import CreatableSelect from '@/components/ui/CreatableSelect'
import { initialsOf } from '@/lib/initials'
import { inputStyle, Field, CopyableValue, SaveBar } from './shared'
import { InterviewFlowSection } from './InterviewFlowSection'
import { AgentKnowledgeSection } from './AgentKnowledgeSection'
import type { AiAgent, AiItem, AiKnowledgeLookupItem, ChatMessage } from '@/types/ai'
// Reuse the WhatsApp-templates option shape from the workflow module's template
// picker (GET /whatsapp-templates) instead of re-declaring it (§11 — one truth).
import type { WaTemplateOption } from '@/components/layout/workflow/whatsappTemplate'
import Button from '@/components/ui/Button'
import { groupLabelStyle, SectionTitle } from '@/components/ui/typography'

// Mirrors shared.tsx's `Field` label style — used directly (not via `Field`) for the
// two CreatableSelect pickers below, which need their own aria-labelledby wiring
// r6: identity from the typography module; only display/margin are local layout.
const fieldLabelStyle: CSSProperties = { ...groupLabelStyle, display: 'block', marginBottom: 5 }

// KNOWLEDGE-SCOPE-1 (K-276): the backend rejects a knowledge_ids request body over
// this length (422 on knowledge_ids.0) — guard it client-side too, at the toggle.
const KNOWLEDGE_IDS_MAX = 200

// The agent edit-form's local state. No `model` field (MODEL-1): the company-wide
// model from Settings is used everywhere, never chosen per agent.
interface AgentFormState {
  name: string; custom_endpoint: string; custom_api_key: string
  prompt_id: string | number; faq_ids: Array<string | number>; use_knowledge: boolean; max_history: number
  // WA_INTRO_TEMPLATE-1: the approved WhatsApp template that opens the conversation.
  wa_intro_template: string
  // KNOWLEDGE-SCOPE-1 (K-276): the per-agent knowledge-item coupling.
  knowledge_ids: string[]
}

// ── Chat test ─────────────────────────────────────────────────────────────────

function ChatTest({ agent, onClose }: { agent: AiAgent; onClose?: () => void }) {
  const { t } = useTranslation('workflows')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input,    setInput]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // Sends the typed message, appends it to the local transcript immediately, then appends the assistant's reply (or a visible error bubble) once the API responds.
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
        {/* Pre-existing bespoke-size (no fixed height, 11px) inline test-panel controls —
            out of this ink/tint task's scope; not converted to avoid a size regression. */}
        <button onClick={() => setMessages([])}
          // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- see comment above
          style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
          {t('ai.chat.clear')}
        </button>
        {onClose && (
          <button onClick={onClose} aria-label={t('common:close')}
            // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- see comment above
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
              // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- chat-bubble fill (own-message accent), not an action button
              background: m.role === 'user' ? 'var(--color-primary)' : m.error ? 'var(--color-danger-bg)' : 'var(--bg)',
              // Error ink is --color-on-danger-bg — the raw danger colour reads only
              // 3.95:1 on its own pastel, AA fail (Opus r3.5).
              color: m.role === 'user' ? 'white' : m.error ? 'var(--color-on-danger-bg)' : 'var(--text)',
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
        <Button variant="primary" onClick={send} disabled={!input.trim() || loading} aria-label={t('common:send')}
          style={{ width: 32 }}>
          <Send size={13} />
        </Button>
      </div>
    </div>
  )
}

// ── Agent form ────────────────────────────────────────────────────────────────

export function AgentForm({ agent, prompts, faqs, knowledgeItems, onSaved, onDelete }: {
  agent: AiAgent | null; prompts: AiItem[]; faqs: AiItem[]; knowledgeItems: AiKnowledgeLookupItem[]
  onSaved: (a: AiAgent) => void; onDelete: (a: AiAgent) => void
}) {
  const { t } = useTranslation('workflows')
  // House date formatting (DATUM-1) for the inbound stamps below.
  const { formatDateTime } = useDateFormat()
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
    knowledge_ids:   agent?.knowledge_ids   ?? [],
  })
  // KNOWLEDGE-SCOPE-1: the contract's "omit = unchanged" applies to knowledge_ids —
  // only send it once the user actually touched the picker (mirrors the write-only
  // custom_api_key handling below, same reasoning: never overwrite with a stale copy).
  const [knowledgeTouched, setKnowledgeTouched] = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [saved,       setSaved]       = useState(false)
  const [chatOpen,    setChatOpen]    = useState(false)
  const [showApiKey,  setShowApiKey]  = useState(false)
  const apiKeyId = useId()
  // The prompt/WA-template pickers are now the house CreatableSelect, which renders
  // a <button> — unlike shared.tsx's `Field` (built for <input>/<select>, htmlFor
  // only), a button ignores an associated <label for> for its accessible name, so
  // these two fields wire their own label id via aria-labelledby instead (mirrors
  // components/forms/fields.tsx's Field, which already carries this exact fix).
  const promptLabelId = useId()
  const waTemplateLabelId = useId()
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
  // Loads the tenant's real synced WhatsApp templates for the intro picker (WA_INTRO_TEMPLATE-1); an alive guard drops the result if the form unmounts first, and a failed/absent connection just leaves the empty-state below.
  useEffect(() => {
    let alive = true
    api.get('/whatsapp-templates')
      .then(r => { if (alive) setWaTemplates(unwrapList<WaTemplateOption>(r).rows) })
      .catch(() => { /* no WhatsApp connection yet — empty state below */ })
      .finally(() => { if (alive) setWaLoading(false) })
    return () => { alive = false }
  }, [])

  const set = <K extends keyof AgentFormState>(k: K, v: AgentFormState[K]) => setForm(f => ({ ...f, [k]: v }))

  // Persists the form (see the API-key handling below for why it is stripped by default).
  const save = async () => {
    setSaving(true); setSaved(false)
    // The API key is write-only — never re-send the masked placeholder. Omit the
    // field entirely unless the user actually typed a new value, so an untouched
    // key is left exactly as stored (security audit finding D).
    const { custom_api_key, knowledge_ids, ...rest } = form
    const payload: Record<string, unknown> = { ...rest }
    if (custom_api_key) payload.custom_api_key = custom_api_key
    // KNOWLEDGE-SCOPE-1: omitting the key leaves the coupling untouched server-side —
    // only send it once the user actually toggled a knowledge item.
    if (knowledgeTouched) payload.knowledge_ids = knowledge_ids
    try {
      const res = isNew
        ? await api.post('/ai/agents', payload)
        : await api.put(`/ai/agents/${agent.id}`, payload)
      onSaved(unwrap<AiAgent>(res))
      set('custom_api_key', '') // clear the typed value; has_custom_api_key now covers it
      // Repair pass MUST-FIX 2: a stale `touched` flag must not survive a successful
      // save — otherwise the NEXT save (even of a different agent, belt-and-braces
      // alongside the AgentsTab remount-per-agent key) could resend this array.
      setKnowledgeTouched(false)
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    } catch {
      // A failed save used to leave no signal at all (silent catch) — say so instead.
      notifyError(t('common:actionFailed'))
    }
    setSaving(false)
  }

  const toggleFaq = (id: string | number) => set('faq_ids', form.faq_ids.includes(id) ? form.faq_ids.filter(x => x !== id) : [...form.faq_ids, id])
  // Toggling a knowledge item marks the coupling as touched (so save() knows to send
  // it) and enforces the contract's 200-id cap (KNOWLEDGE-SCOPE-1). Reads the latest
  // array inside the functional updater — not the `form` closure — so a rapid
  // "select all" batch (each chip calling this in sequence within one event) can't
  // race past the limit on a stale read.
  const toggleKnowledgeItem = (id: string) => {
    setForm(f => {
      const has = f.knowledge_ids.includes(id)
      if (!has && f.knowledge_ids.length >= KNOWLEDGE_IDS_MAX) return f
      return { ...f, knowledge_ids: has ? f.knowledge_ids.filter(x => x !== id) : [...f.knowledge_ids, id] }
    })
    setKnowledgeTouched(true)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--color-violet-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Brain size={15} color="var(--color-violet)" />
          </div>
          <div>
            <SectionTitle as="div">{isNew ? t('ai.agent.newAgent') : form.name || t('ai.agent.fallback')}</SectionTitle>
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
            // Pre-existing bespoke toggle-state control (own on/off fill), out of this
            // ink/tint task's scope; not converted to avoid a size/identity regression.
            <button onClick={() => setChatOpen(o => !o)}
              // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- see comment above
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: 12, fontWeight: 500,
                borderRadius: 8, border: '1px solid var(--border)',
                background: chatOpen ? 'var(--color-primary-bg)' : 'var(--surface)',
                // Text-colour accent uses the AA-contrast text token, not the raw brand primary.
                color: chatOpen ? 'var(--color-primary-text)' : 'var(--text-muted)', cursor: 'pointer' }}>
              <MessageSquare size={12} /> {t('ai.chat.test')}
            </button>
          )}
          {!isNew && (
            <button onClick={() => agent && onDelete(agent)}
              aria-label={t('common:delete')} title={t('common:delete')}
              // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- pre-existing bespoke-size icon button, out of this ink/tint task's scope
              style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--color-danger-text)', cursor: 'pointer', display: 'flex' }}>
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
            {/* PUNT-2 (BE 0a8521df): inbound-verwerkingsstempels — read-only, DD-MM-YYYY HH:mm. */}
            {agent?.last_inbound_at && (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '6px 0 0' }}>
                {t('ai.agent.lastInbound')}: {formatDateTime(agent.last_inbound_at)}
                {typeof agent.inbound_handled_count === 'number' ? ` · ${t('ai.agent.inboundCount', { count: agent.inbound_handled_count })}` : ''}
              </p>
            )}
            {agent?.last_inbound_error_at && (
              <p style={{ fontSize: 12, color: 'var(--color-danger-text)', margin: '4px 0 0' }}>
                {t('ai.agent.lastInboundError')}: {agent.last_inbound_error_code ?? '—'} · {formatDateTime(agent.last_inbound_error_at)}
              </p>
            )}
          </Field>

          <div style={{ marginBottom: 13 }}>
            <label id={promptLabelId} style={fieldLabelStyle}>{t('ai.agent.prompt')}</label>
            <CreatableSelect value={form.prompt_id ? String(form.prompt_id) : null} allowCreate={false} clearable
              aria-labelledby={promptLabelId} onChange={v => set('prompt_id', v)}
              placeholder={t('ai.agent.noPrompt')} options={prompts.map(p => ({ value: String(p.id), label: p.name ?? '' }))}
              style={inputStyle} />
          </div>

          {/* WA_INTRO_TEMPLATE-1: only real, approved, synced templates are selectable —
              never free text. Empty/loading states reuse the workflow module's wa.* copy
              (same GET /whatsapp-templates source) instead of a duplicate key. */}
          <div style={{ marginBottom: 13 }}>
            <label id={waTemplateLabelId} style={fieldLabelStyle}>{t('ai.agent.waIntroTemplate')}</label>
            {waLoading
              ? <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>{t('wa.templateLoading')}</p>
              : waTemplates.length === 0
                ? <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>{t('wa.templateEmpty')}</p>
                : (
                  <CreatableSelect value={form.wa_intro_template || null} allowCreate={false} clearable
                    aria-labelledby={waTemplateLabelId} onChange={v => set('wa_intro_template', v)}
                    placeholder={t('ai.agent.noWaTemplate')} options={waTemplates}
                    style={inputStyle} />
                )}
          </div>

          {/* Kennisbank section — the general-knowledge toggle, the FAQ picker, and
              (KNOWLEDGE-SCOPE-1) the knowledge-item coupling. Extracted component so
              this container stays under the file-size target (§3). */}
          <AgentKnowledgeSection
            useKnowledge={form.use_knowledge} onUseKnowledgeChange={v => set('use_knowledge', v)}
            faqs={faqs} faqIds={form.faq_ids} onToggleFaq={toggleFaq}
            knowledgeItems={knowledgeItems} knowledgeIds={form.knowledge_ids} onToggleKnowledgeItem={toggleKnowledgeItem}
            atMax={form.knowledge_ids.length >= KNOWLEDGE_IDS_MAX}
          />

          <Field label={t('ai.agent.maxHistory')}>
            <input type="number" min={1} max={50} value={form.max_history}
              onChange={e => set('max_history', Number(e.target.value))} style={{ ...inputStyle, width: 80 }} />
          </Field>

          {/* Custom API override — rare BYO-endpoint escape hatch; collapsed by
              default (calm by default), no longer gated behind a model picker. */}
          <div style={{ marginBottom: 13 }}>
            {/* Pre-existing bespoke collapsible-section header control, out of this
                ink/tint task's scope; not converted to avoid a size/identity regression. */}
            <button type="button" onClick={() => setShowCustomApi(o => !o)}
              // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- see comment above
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.04em', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              {t('ai.agent.customApiSection')}
              <ChevronDown size={10} style={{ transform: showCustomApi ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
            </button>
            {showCustomApi && (
              <div style={{ marginTop: 8 }}>
                <Field label={t('ai.agent.apiEndpoint')}>
                  <input value={form.custom_endpoint} onChange={e => set('custom_endpoint', e.target.value)} style={inputStyle} placeholder="https://api.example.com/v1/chat" />
                </Field>
                {/* Masked write-only field (mirrors EmailSettings' smtp_pass /
                    FacebookLeadsSettings' SecretField, security audit finding D): the
                    stored key is never shown or re-sent — only a "✓ set" badge plus a
                    placeholder telling the user blank keeps the current key. */}
                <div style={{ marginBottom: 13 }}>
                  <label htmlFor={apiKeyId} style={fieldLabelStyle}>
                    {t('ai.agent.apiKey')}
                    {hasCustomApiKey && !form.custom_api_key && (
                      <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--color-success-text)', fontWeight: 400, textTransform: 'none', letterSpacing: 'normal' }}>
                        {t('ai.agent.apiKeySet')}
                      </span>
                    )}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input id={apiKeyId} type={showApiKey ? 'text' : 'password'} value={form.custom_api_key}
                      onChange={e => set('custom_api_key', e.target.value)}
                      placeholder={hasCustomApiKey ? t('ai.agent.apiKeyKeepPlaceholder') : 'sk-...'}
                      style={{ ...inputStyle, paddingRight: 36 }} />
                    {/* Pre-existing bespoke show/hide-password affordance absolutely
                        positioned inside the input, out of this ink/tint task's scope. */}
                    <button type="button" onClick={() => setShowApiKey(s => !s)}
                      aria-label={showApiKey ? t('ai.agent.hideApiKey') : t('ai.agent.showApiKey')}
                      // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- see comment above
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
