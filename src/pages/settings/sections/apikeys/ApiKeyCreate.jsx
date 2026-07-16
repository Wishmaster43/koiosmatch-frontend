/**
 * ApiKeyCreate — inline "new API key" view (replaces the list, like ApiKeyDetail).
 *
 * No modal: the form + access grid render full-width on the page so the whole
 * overview is readable at once. Two phases: (1) the create form, (2) the one-time
 * secret reveal. The secret is never persisted client-side — leaving the view
 * discards it from memory.
 */
import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Check, Copy, Key } from 'lucide-react'
import { createApiKey } from './apiKeysApi'
import { KEY_TYPES } from './constants'
import ScopeEditor from './ScopeEditor'
import { BTN_H } from '@/config/buttonMetrics'

export default function ApiKeyCreate({ onBack, onCreated }) {
  const { t } = useTranslation('settings')
  const [form, setForm]     = useState({ friendly_name: '', type: 'additional', organisation: '', description: '', contact_name: '', contact_email: '' })
  const [scopes, setScopes] = useState({})   // access grid, sent with the create call
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(false)
  const [result, setResult] = useState(null)   // { ...key, secret } after create
  const [copied, setCopied] = useState(false)
  const firstField          = useRef(null)

  // Focus the name field on open.
  useEffect(() => { firstField.current?.focus() }, [])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  // Submit the form; on success move to the secret-reveal phase and notify the list.
  const submit = async () => {
    if (!form.friendly_name.trim()) return
    setSaving(true)
    setError(false)
    try {
      const created = await createApiKey({ ...form, friendly_name: form.friendly_name.trim(), scopes })
      setResult(created)
      onCreated?.(created)
    } catch {
      setError(true)
    }
    setSaving(false)
  }

  const copySecret = () => {
    navigator.clipboard.writeText(result?.secret ?? '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const inputStyle = { width: '100%', height: 38, padding: '0 11px', fontSize: 13, color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, outline: 'none', background: 'var(--surface)' }
  const labelStyle = { fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 5, display: 'block' }
  const fieldGrid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }

  return (
    <div>
      {/* Header: back + icon + title (mirrors ApiKeyDetail) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
        {/* BTN_H (§4/§9): one explicit height for every text/action button, everywhere. */}
        <button onClick={onBack} aria-label={t('common.back')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: BTN_H, padding: '0 12px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--hover-bg)', color: 'var(--text)', cursor: 'pointer' }}>
          <ArrowLeft size={13} /> {t('common.back')}
        </button>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--color-primary-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Key size={16} style={{ color: 'var(--color-primary)' }} />
        </div>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{t('apiKeys.createTitle')}</h2>
      </div>

      {/* Form / secret reveal, capped to a comfortable reading width */}
      <div style={{ maxWidth: 760 }}>
        {result ? (
          // Phase 2 — one-time secret reveal.
          <div>
            <div style={{ background: 'var(--color-success-bg)', border: '1px solid #BBF7D0', borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#166534', marginBottom: 8 }}>{t('apiKeys.secretOnce')}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <code style={{ flex: 1, fontSize: 12, fontFamily: "'JetBrains Mono', monospace", background: 'var(--surface)', border: '1px solid #BBF7D0', borderRadius: 6, padding: '9px 11px', color: 'var(--text)', overflowX: 'auto', whiteSpace: 'nowrap' }}>{result.secret}</code>
                <button onClick={copySecret} aria-label={t('apiKeys.copySecret')}
                  style={{ height: BTN_H, padding: '0 12px', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, border: '1px solid #BBF7D0', borderRadius: 6, background: 'var(--surface)', cursor: 'pointer', color: 'var(--color-success)', whiteSpace: 'nowrap' }}>
                  {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? t('common.copied') : t('apiKeys.copySecret')}
                </button>
              </div>
            </div>
            <button onClick={onBack}
              style={{ height: BTN_H, padding: '0 20px', fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 8, background: 'var(--color-primary)', color: 'white', cursor: 'pointer' }}>
              {t('apiKeys.done')}
            </button>
          </div>
        ) : (
          // Phase 1 — the create form.
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle} htmlFor="ak-name">{t('apiKeys.field.name')}</label>
              <input id="ak-name" ref={firstField} value={form.friendly_name} onChange={set('friendly_name')}
                placeholder={t('apiKeys.namePlaceholder')} style={inputStyle}
                onKeyDown={(e) => e.key === 'Enter' && submit()} />
            </div>
            <div style={fieldGrid}>
              <div>
                <label style={labelStyle} htmlFor="ak-type">{t('apiKeys.field.type')}</label>
                <select id="ak-type" value={form.type} onChange={set('type')} style={{ ...inputStyle, cursor: 'pointer' }}>
                  {KEY_TYPES.map((ty) => <option key={ty} value={ty}>{t(`apiKeys.type.${ty}`)}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle} htmlFor="ak-org">{t('apiKeys.field.organisation')}</label>
                <input id="ak-org" value={form.organisation} onChange={set('organisation')} style={inputStyle} />
              </div>
            </div>
            <div>
              <label style={labelStyle} htmlFor="ak-desc">{t('apiKeys.field.description')}</label>
              <input id="ak-desc" value={form.description} onChange={set('description')} style={inputStyle} />
            </div>
            <div style={fieldGrid}>
              <div>
                <label style={labelStyle} htmlFor="ak-cn">{t('apiKeys.field.contactName')}</label>
                <input id="ak-cn" value={form.contact_name} onChange={set('contact_name')} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle} htmlFor="ak-ce">{t('apiKeys.field.contactEmail')}</label>
                <input id="ak-ce" type="email" value={form.contact_email} onChange={set('contact_email')} style={inputStyle} />
              </div>
            </div>

            {/* Access grid — full width, no cramped scroll box, for readability */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <label style={labelStyle}>{t('apiKeys.tab.access')}</label>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 10px' }}>{t('apiKeys.access.subtitle')}</p>
              <ScopeEditor value={scopes} onChange={setScopes} />
            </div>

            {error && <div style={{ fontSize: 12, color: 'var(--color-danger)' }}>{t('apiKeys.createError')}</div>}

            {/* BTN_H (§4/§9): one explicit height for every text/action button, everywhere. */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={submit} disabled={saving || !form.friendly_name.trim()}
                style={{ height: BTN_H, padding: '0 20px', fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 8, background: 'var(--color-primary)', color: 'white', cursor: form.friendly_name.trim() ? 'pointer' : 'not-allowed', opacity: form.friendly_name.trim() ? 1 : 0.5 }}>
                {saving ? t('apiKeys.creating') : t('apiKeys.create')}
              </button>
              <button onClick={onBack}
                style={{ height: BTN_H, padding: '0 16px', fontSize: 13, fontWeight: 500, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
