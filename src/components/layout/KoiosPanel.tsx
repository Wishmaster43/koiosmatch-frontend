import { useState, useRef, useEffect } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Plus, Bot, Sparkles, AtSign, Paperclip, ArrowUp, Maximize2, Minimize2 } from 'lucide-react'
import { useLocale } from '@/lib/datetime'
import { useKoiosChat } from './koios/useKoiosChat'
import { useKoiosSettings } from './koios/useKoiosSettings'
import { useKoiosExpanded } from './koios/useKoiosExpanded'
import KoiosSteps from './koios/KoiosSteps'
import KoiosUsage from './koios/KoiosUsage'
import KoiosModelPicker from './koios/KoiosModelPicker'
import type { KoiosChatMessage, TFn } from '@/types/koios'

// ── Mention picker items ──────────────────────────────────────────────────────
// Mention items; label = t('nav.<navKey>'). desc is illustrative demo data.
const MENTIONS = [
  { id: 'kandidaten', navKey: 'candidates', desc: '2.845 actief' },
  { id: 'planning',   navKey: 'planning',   desc: 'Diensten deze week' },
  { id: 'klanten',    navKey: 'customers',  desc: '47 actief' },
  { id: 'vacatures',  navKey: 'vacancies',  desc: '9 open' },
  { id: 'workflows',  navKey: 'workflows',  desc: 'Automatisering' },
]

// gradient used for the assistant avatar + user bubble.
const GRADIENT = 'linear-gradient(135deg,var(--color-primary),#8B5CF6)'

// Panel width: normal vs. expanded, mirroring EntityDrawer's own proportions.
const WIDTH_COLLAPSED = 300
const WIDTH_EXPANDED = 560

// Resolve a message to its display text + whether it's a calm system notice
// (notices carry no steps/usage). Keeps the JSX below readable.
function resolveMessage(msg: KoiosChatMessage, t: TFn) {
  if (msg.kind === 'welcome')   return { text: t('koios.welcome'),       notice: false }
  if (msg.kind === 'error')     return { text: t('koios.errorReply'),    notice: true }
  if (msg.kind === 'forbidden') return { text: t('koios.forbidden'),     notice: true }
  if (msg.role === 'user')      return { text: msg.content,              notice: false }
  if (msg.stopReason === 'not_configured')
    return { text: msg.answer || t('koios.notConfigured'),               notice: true }
  return { text: msg.answer, notice: false }
}

// ── Chat bubble ───────────────────────────────────────────────────────────────
function KoiosMessage({ msg, isNew, t, locale }: { msg: KoiosChatMessage; isNew?: boolean; t: TFn; locale?: string }) {
  const isKoios = msg.role !== 'user'
  const { text, notice } = resolveMessage(msg, t)
  // Subtle tag under the bubble for a self-refusal or an unfinished (max_steps) run.
  const stopTag = isKoios && !notice && msg.stopReason === 'refusal' ? t('koios.stopRefused')
    : isKoios && !notice && msg.stopReason === 'max_steps' ? t('koios.stopMaxSteps') : null

  return (
    <div style={{ display: 'flex', gap: 8, flexDirection: isKoios ? 'row' : 'row-reverse',
      alignItems: 'flex-end', animation: isNew ? 'fadeSlideIn 0.2s ease' : 'none' }}>
      {isKoios && (
        <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, marginBottom: 2,
          background: GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Bot size={13} color="white" />
        </div>
      )}
      <div style={{ maxWidth: '84%', display: 'flex', flexDirection: 'column',
        alignItems: isKoios ? 'flex-start' : 'flex-end' }}>
        <div style={{
          padding: '9px 13px',
          borderRadius: isKoios ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
          fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap',
          background: isKoios ? 'var(--surface)' : GRADIENT,
          color:      isKoios ? (notice ? 'var(--text-muted)' : 'var(--text)') : '#fff',
          border:     isKoios ? '1px solid var(--border)' : 'none',
          boxShadow:  isKoios ? 'none' : '0 2px 10px rgba(99,102,241,0.35)',
        }}>
          {text}
        </div>
        {stopTag && <div style={{ marginTop: 4, fontSize: 10, color: 'var(--text-muted)' }}>{stopTag}</div>}
        {isKoios && !notice && <KoiosSteps steps={msg.steps} t={t} />}
        {isKoios && !notice && msg.stopReason !== 'not_configured' && (
          <KoiosUsage usage={msg.usage} model={msg.model} t={t} locale={locale} />
        )}
      </div>
    </div>
  )
}

// ── Typing indicator ──────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
      <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
        background: GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Bot size={13} color="white" />
      </div>
      <div style={{ padding: '10px 14px', borderRadius: '4px 16px 16px 16px',
        background: 'var(--surface)', border: '1px solid var(--border)',
        display: 'flex', gap: 4, alignItems: 'center' }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#8B5CF6',
            display: 'block', animation: 'bounce 1.2s infinite', animationDelay: `${i * 0.18}s` }} />
        ))}
      </div>
    </div>
  )
}

// ── Quick suggestions ─────────────────────────────────────────────────────────
// Quick suggestions; label = t('koios.<key>').
const QUICK = [
  { key: 'quickCandidates',  icon: '👥' },
  { key: 'quickOpenShifts',  icon: '📅' },
  { key: 'quickNewWorkflow', icon: '⚡' },
  { key: 'quickReport',      icon: '📊' },
]

// ── Main panel ────────────────────────────────────────────────────────────────
export default function KoiosPanel({ open, onClose }: { open?: boolean; onClose?: () => void }) {
  const { t } = useTranslation('common')
  const locale = useLocale()
  // All chat state + the synchronous /ai/koios/chat call live in the hook.
  const { messages, loading, model, setModel, send, reset } = useKoiosChat()
  // Settings (selectable models + connection status), loaded on first open.
  const { settings } = useKoiosSettings(open)
  // Wide/normal toggle, persisted across reloads (mirrors the drawer's expand state).
  const { expanded, toggle: toggleExpanded } = useKoiosExpanded()
  // Connection status (optimistic until loaded; only `false` flips to "offline").
  const connected = settings?.status?.claude_configured !== false
  const mentions = MENTIONS.map(m => ({ ...m, label: t(`nav.${m.navKey}`) }))
  const quick    = QUICK.map(q => ({ ...q, label: t(`koios.${q.key}`) }))
  const [input,       setInput]       = useState('')
  const [focused,     setFocused]     = useState(false)
  const [showMention, setShowMention] = useState(false)
  const [mentionQ,    setMentionQ]    = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef   = useRef<HTMLDivElement>(null)
  const mentionRef  = useRef<HTMLDivElement>(null)

  // Keep the latest message in view.
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  // Auto-resize the textarea up to a cap.
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 100) + 'px'
  }, [input])

  // Close the mention picker on an outside click.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (mentionRef.current && !mentionRef.current.contains(e.target as Node)) setShowMention(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Submit the composer: hand the text to the hook, then clear + refocus.
  const submit = (text?: string) => {
    const trimmed = (text ?? '').trim()
    if (!trimmed || loading) return
    send(trimmed)
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setShowMention(false)
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  const handleInput = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setInput(val)
    const lastAt = val.lastIndexOf('@')
    if (lastAt !== -1 && lastAt === val.length - 1) { setShowMention(true); setMentionQ('') }
    else if (lastAt !== -1 && val.slice(lastAt + 1).match(/^\w*$/)) { setShowMention(true); setMentionQ(val.slice(lastAt + 1).toLowerCase()) }
    else setShowMention(false)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(input) }
    if (e.key === 'Escape') setShowMention(false)
  }

  const insertMention = (item: { label: string }) => {
    const lastAt = input.lastIndexOf('@')
    const before = lastAt !== -1 ? input.slice(0, lastAt) : input
    setInput(before + '@' + item.label + ' ')
    setShowMention(false)
    textareaRef.current?.focus()
  }

  const newChat = () => { reset(); setInput(''); setShowMention(false) }

  const filteredMentions = mentions.filter(m =>
    !mentionQ || m.label.toLowerCase().includes(mentionQ) || m.id.includes(mentionQ),
  )

  if (!open) return null

  return (
    <div style={{ width: expanded ? WIDTH_EXPANDED : WIDTH_COLLAPSED, flexShrink: 0,
      borderRight: '1px solid var(--sidebar-border)', background: 'var(--sidebar-bg)', height: '100%',
      display: 'flex', flexDirection: 'column', transition: 'width 0.2s ease' }}>

      {/* ── Header ── */}
      <div style={{ height: 56, borderBottom: '1px solid var(--sidebar-border)', flexShrink: 0,
        display: 'flex', alignItems: 'center', padding: '0 14px', gap: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
          background: GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Sparkles size={13} color="white" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--sidebar-text)', lineHeight: 1.2 }}>Koios</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', display: 'block',
              background: connected ? 'var(--color-success)' : 'var(--color-warning)' }} />
            <span style={{ fontSize: 10, fontWeight: 500, color: connected ? 'var(--color-success)' : 'var(--color-warning)' }}>
              {t(connected ? 'koios.online' : 'koios.offline')}
            </span>
          </div>
        </div>
        <button onClick={newChat} title={t('koios.newChat')}
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px', fontSize: 10,
            fontWeight: 600, background: 'rgba(99,102,241,0.12)', color: 'var(--color-primary)',
            border: 'none', borderRadius: 6, cursor: 'pointer', transition: 'background 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.22)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(99,102,241,0.12)'}>
          <Plus size={10} /> {t('koios.newChatShort')}
        </button>
        <button onClick={toggleExpanded} aria-label={t(expanded ? 'collapse' : 'expand')} aria-expanded={expanded}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sidebar-muted)',
            padding: 4, display: 'flex', borderRadius: 6, transition: 'background 0.1s' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--sidebar-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}>
          {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>
        <button onClick={onClose} aria-label={t('common:close', { defaultValue: 'Sluiten' })}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sidebar-muted)',
            padding: 4, display: 'flex', borderRadius: 6, transition: 'background 0.1s' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--sidebar-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}>
          <X size={15} />
        </button>
      </div>

      {/* ── Messages ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 12px',
        display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map((msg, i) => (
          <KoiosMessage key={i} msg={msg} isNew={i === messages.length - 1} t={t} locale={locale} />
        ))}
        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* ── Quick suggestions (only on the welcome screen) ── */}
      {messages.length === 1 && !loading && (
        <div style={{ padding: '0 12px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
          {quick.map(q => (
            <button key={q.key} onClick={() => submit(q.label)}
              style={{ textAlign: 'left', padding: '8px 11px', fontSize: 12,
                border: '1px solid var(--sidebar-border)', borderRadius: 10, background: 'none',
                color: 'var(--sidebar-text)', cursor: 'pointer', transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', gap: 8 }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--sidebar-hover)'; e.currentTarget.style.borderColor = 'var(--color-primary)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = 'var(--sidebar-border)' }}>
              <span>{q.icon}</span>
              <span>{q.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Input area ── */}
      <div style={{ padding: '10px 12px 14px', borderTop: '1px solid var(--sidebar-border)', flexShrink: 0, position: 'relative' }}>

        {/* Mention picker */}
        {showMention && filteredMentions.length > 0 && (
          <div ref={mentionRef}
            style={{ position: 'absolute', bottom: '100%', left: 12, right: 12, marginBottom: 6,
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
              boxShadow: '0 4px 20px rgba(0,0,0,0.12)', overflow: 'hidden', zIndex: 50 }}>
            <div style={{ padding: '8px 12px 4px', fontSize: 10, fontWeight: 700,
              color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {t('koios.addContext')}
            </div>
            {filteredMentions.map(m => (
              <button key={m.id} onClick={() => insertMention(m)}
                style={{ width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none',
                  background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
                  gap: 10, transition: 'background 0.1s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  background: 'linear-gradient(135deg,var(--color-primary-bg),#F3E8FF)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-primary)' }}>@</span>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{m.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.desc}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Input box */}
        <div style={{
          background: 'var(--surface)',
          border: `1.5px solid ${focused ? 'var(--color-primary)' : 'var(--border)'}`,
          borderRadius: 20,
          padding: '10px 10px 8px 14px',
          boxShadow: focused ? '0 0 0 3px rgba(99,102,241,0.1)' : '0 1px 3px rgba(0,0,0,0.05)',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={t('koios.taskPlaceholder')}
            rows={1}
            style={{
              width: '100%', background: 'none', border: 'none', outline: 'none',
              resize: 'none', fontSize: 13, color: 'var(--text)', fontFamily: 'inherit',
              lineHeight: 1.5, overflowY: 'hidden', display: 'block', marginBottom: 8,
            }}
          />

          {/* Toolbar row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>

            {/* @ mention */}
            <button
              onClick={() => { setInput(v => v + '@'); setShowMention(true); setMentionQ(''); textareaRef.current?.focus() }}
              title={t('koios.addContext')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 5px',
                borderRadius: 7, color: 'var(--sidebar-muted)', display: 'flex',
                transition: 'background 0.1s, color 0.1s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg)'; e.currentTarget.style.color = 'var(--color-primary)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--sidebar-muted)' }}>
              <AtSign size={14} />
            </button>

            {/* Paperclip */}
            <button title={t('koios.attachFile')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 5px',
                borderRadius: 7, color: 'var(--sidebar-muted)', display: 'flex',
                transition: 'background 0.1s, color 0.1s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg)'; e.currentTarget.style.color = 'var(--color-primary)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--sidebar-muted)' }}>
              <Paperclip size={14} />
            </button>

            {/* Model picker — only renders when there is more than one selectable model */}
            <KoiosModelPicker
              models={settings?.models?.selectable}
              value={model ?? settings?.models?.active}
              onChange={setModel}
            />

            <div style={{ flex: 1 }} />

            {/* Send */}
            <button
              onClick={() => submit(input)}
              disabled={!input.trim() || loading}
              aria-label={t('koios.taskPlaceholder')}
              style={{
                width: 30, height: 30, borderRadius: '50%', border: 'none', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: input.trim() && !loading ? '#1F2937' : 'var(--border)',
                color: 'white',
                cursor: input.trim() && !loading ? 'pointer' : 'default',
                transition: 'background 0.15s, transform 0.1s',
              }}
              onMouseEnter={e => { if (input.trim() && !loading) e.currentTarget.style.transform = 'scale(1.08)' }}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
              <ArrowUp size={14} />
            </button>
          </div>
        </div>

        <div style={{ fontSize: 10, color: 'var(--sidebar-muted)', textAlign: 'center', marginTop: 7 }}>
          {t('koios.inputHint')}
        </div>
      </div>

      <style>{`
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-5px)} }
        @keyframes fadeSlideIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  )
}
