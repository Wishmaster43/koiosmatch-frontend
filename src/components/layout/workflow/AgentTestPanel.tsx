/**
 * AgentTestPanel — live chat interface to test the AI agent directly from
 * the config panel. The agent is defined inline (instructions live in the
 * block's own config — MODEL-1: no per-step model anymore, one company-wide
 * model runs every AI step), so we POST that config to /ai/agents/test and
 * show the response in a chat UI with token + latency stats.
 */
import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Send, Trash2, Plus, X, Loader2, Bot, User, Zap } from 'lucide-react'
import api, { unwrap } from '@/lib/api'

interface Message {
  role: 'user' | 'assistant'
  content: string
  tokens?: number
  duration_ms?: number
  model?: string
}

interface Variable { key: string; value: string }

// Formats milliseconds to a readable duration string
function fmtMs(ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`
}

export default function AgentTestPanel({ config }: {
  config?: Record<string, unknown>
}) {
  const { t } = useTranslation('workflows')
  const [messages,   setMessages]   = useState<Message[]>([])
  const [input,      setInput]      = useState('')
  const [variables,  setVariables]  = useState<Variable[]>([])
  const [loading,    setLoading]    = useState(false)
  const [totalTokens, setTotalTokens] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom whenever a new message arrives
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const addVariable = () => setVariables(v => [...v, { key: '', value: '' }])
  const removeVariable = (i: number) => setVariables(v => v.filter((_, j) => j !== i))
  const updateVariable = (i: number, field: 'key' | 'value', val: string) =>
    setVariables(v => v.map((r, j) => j === i ? { ...r, [field]: val } : r))

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    const userMsg: Message = { role: 'user', content: input.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    // Build variable map for the request
    const vars = Object.fromEntries(variables.filter(v => v.key).map(v => [v.key, v.value]))

    try {
      const res = await api.post('/ai/agents/test', {
        message: userMsg.content,
        variables: vars,
        conversation_history: messages,
        config,
      })
      const data = unwrap<{
        response?: string; message?: string; tokens_used?: number
        usage?: { total_tokens?: number }; duration_ms?: number; model?: string
      }>(res)
      const assistantMsg: Message = {
        role:        'assistant',
        content:     data.response ?? data.message ?? JSON.stringify(data),
        tokens:      data.tokens_used ?? data.usage?.total_tokens,
        duration_ms: data.duration_ms,
        model:       data.model,
      }
      setMessages(prev => [...prev, assistantMsg])
      if (assistantMsg.tokens) setTotalTokens(t => t + assistantMsg.tokens!)
    } catch {
      // Show a friendly error bubble instead of crashing
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: t('agentTest.noConnection'),
      }])
    } finally {
      setLoading(false)
    }
  }

  const clearChat = () => { setMessages([]); setTotalTokens(0) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>

      {/* Variable overrides */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {t('agentTest.title')}
          </span>
          <button onClick={addVariable}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0' }}>
            <Plus size={11} /> {t('agentTest.add')}
          </button>
        </div>
        {variables.length === 0 && (
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
            {t('agentTest.empty')}
          </p>
        )}
        {variables.map((v, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4, alignItems: 'center' }}>
            <input value={v.key} onChange={e => updateVariable(i, 'key', e.target.value)}
              placeholder={t('agentTest.name')}
              style={{ flex: 1, padding: '4px 8px', fontSize: 11, border: '1px solid var(--border)', borderRadius: 6, outline: 'none', background: 'var(--surface)', color: 'var(--text)' }} />
            <input value={v.value} onChange={e => updateVariable(i, 'value', e.target.value)}
              placeholder={t('agentTest.value')}
              style={{ flex: 2, padding: '4px 8px', fontSize: 11, border: '1px solid var(--border)', borderRadius: 6, outline: 'none', background: 'var(--surface)', color: 'var(--text)' }} />
            <button onClick={() => removeVariable(i)} aria-label={t('agentTest.removeVariable')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex' }}>
              <X size={11} />
            </button>
          </div>
        ))}
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, opacity: 0.5 }}>
            <Bot size={32} color="var(--text-muted)" />
            <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>
              {t('agentTest.intro')}
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 3 }}>
            {/* Avatar row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: msg.role === 'user' ? 'var(--color-primary-bg)' : 'var(--color-success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {msg.role === 'user'
                  ? <User size={11} color="var(--color-primary)" />
                  : <Bot size={11} color="var(--color-success)" />}
              </div>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                {msg.role === 'user' ? t('agentTest.you') : (msg.model ?? t('agentTest.agent'))}
              </span>
            </div>
            {/* Bubble */}
            <div style={{
              maxWidth: '88%', padding: '8px 11px', borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
              background: msg.role === 'user' ? 'var(--color-primary)' : 'var(--hover-bg)',
              color: msg.role === 'user' ? 'white' : 'var(--text)',
              fontSize: 12, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {msg.content}
            </div>
            {/* Stats under assistant bubble */}
            {msg.role === 'assistant' && (msg.tokens || msg.duration_ms) && (
              <div style={{ display: 'flex', gap: 8, fontSize: 10, color: 'var(--text-muted)', paddingLeft: 4 }}>
                {msg.tokens && <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}><Zap size={9} />{t('agentTest.tokens', { count: msg.tokens })}</span>}
                {msg.duration_ms && <span>{fmtMs(msg.duration_ms)}</span>}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 12 }}>
            <Loader2 size={13} className="animate-spin" />
            {t('agentTest.thinking')}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Stats bar */}
      {totalTokens > 0 && (
        <div style={{ padding: '4px 14px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Zap size={9} /> {t('agentTest.tokensTotal', { count: totalTokens })}
          </span>
          <button onClick={clearChat}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-danger)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
            <Trash2 size={10} /> {t('agentTest.clear')}
          </button>
        </div>
      )}

      {/* Input bar */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexShrink: 0 }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
          placeholder={t('agentTest.inputPlaceholder')}
          rows={2}
          style={{ flex: 1, padding: '7px 10px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 8, outline: 'none', resize: 'none', background: 'var(--surface)', color: 'var(--text)', lineHeight: 1.5, fontFamily: 'inherit' }}
        />
        <button onClick={sendMessage} disabled={!input.trim() || loading} aria-label={t('agentTest.send')}
          style={{ width: 36, height: 36, borderRadius: 8, background: input.trim() && !loading ? 'var(--color-primary)' : 'var(--border)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: input.trim() && !loading ? 'pointer' : 'not-allowed', alignSelf: 'flex-end', flexShrink: 0 }}>
          <Send size={14} color="white" />
        </button>
      </div>
    </div>
  )
}
