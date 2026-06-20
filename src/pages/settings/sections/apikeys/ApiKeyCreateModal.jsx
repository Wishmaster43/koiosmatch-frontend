/**
 * ApiKeyCreateModal — create a key, then reveal its secret exactly once.
 *
 * Two phases in one dialog: (1) a small form, (2) the one-time secret reveal with
 * a copy button and a "you won't see this again" warning. The secret is never
 * persisted client-side — closing the reveal discards it from memory.
 */
import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy, X } from 'lucide-react'
import { createApiKey } from './apiKeysApi'
import { KEY_TYPES } from './constants'
import ScopeEditor from './ScopeEditor'

export default function ApiKeyCreateModal({ onClose, onCreated }) {
  const { t } = useTranslation('settings')
  const [form, setForm]       = useState({ friendly_name: '', type: 'additional', organisation: '', description: '', contact_name: '', contact_email: '' })
  const [scopes, setScopes]   = useState({})   // access grid, sent with the create call
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState(false)
  const [result, setResult]   = useState(null)   // { ...key, secret } after create
  const [copied, setCopied]   = useState(false)
  const firstField            = useRef(null)

  // Focus the first field on open and close on Escape (basic dialog a11y).
  useEffect(() => {
    firstField.current?.focus()
    const onKey = (e) => { if (e.key === 'Escape' && !result) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, result])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  // Submit the form; on success move to the secret-reveal phase.
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

  const inputStyle = { width: '100%', height: 36, padding: '0 10px', fontSize: 13, color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, outline: 'none', background: 'var(--surface)' }
  const labelStyle = { fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }

  return (
    // Backdrop — clicking it cancels, but only before the secret is shown.
    <div role="presentation" onClick={() => !result && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-label={t('apiKeys.createTitle')} onClick={(e) => e.stopPropagation()}
        style={{ width: 520, maxWidth: '100%', maxHeight: '88vh', overflowY: 'auto', background: 'var(--surface)', borderRadius: 14, padding: 22, boxShadow: '0 12px 40px rgba(0,0,0,0.18)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{t('apiKeys.createTitle')}</h2>
          <button onClick={onClose} aria-label={t('common.cancel')}
            style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 7, background: 'var(--hover-bg)', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={14} />
          </button>
        </div>

        {result ? (
          // Phase 2 — one-time secret reveal.
          <div>
            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#166534', marginBottom: 8 }}>{t('apiKeys.secretOnce')}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <code style={{ flex: 1, fontSize: 12, fontFamily: "'JetBrains Mono', monospace", background: 'var(--surface)', border: '1px solid #BBF7D0', borderRadius: 6, padding: '8px 10px', color: 'var(--text)', overflowX: 'auto', whiteSpace: 'nowrap' }}>{result.secret}</code>
                <button onClick={copySecret} aria-label={t('apiKeys.copySecret')}
                  style={{ height: 34, padding: '0 10px', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, border: '1px solid #BBF7D0', borderRadius: 6, background: 'var(--surface)', cursor: 'pointer', color: 'var(--color-success)', whiteSpace: 'nowrap' }}>
                  {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? t('common.copied') : t('apiKeys.copySecret')}
                </button>
              </div>
            </div>
            <button onClick={onClose}
              style={{ width: '100%', height: 38, fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 8, background: 'var(--color-primary)', color: 'white', cursor: 'pointer' }}>
              {t('apiKeys.done')}
            </button>
          </div>
        ) : (
          // Phase 1 — the create form.
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={labelStyle} htmlFor="ak-name">{t('apiKeys.field.name')}</label>
              <input id="ak-name" ref={firstField} value={form.friendly_name} onChange={set('friendly_name')}
                placeholder={t('apiKeys.namePlaceholder')} style={inputStyle}
                onKeyDown={(e) => e.key === 'Enter' && submit()} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle} htmlFor="ak-type">{t('apiKeys.field.type')}</label>
                <select id="ak-type" value={form.type} onChange={set('type')} style={{ ...inputStyle, cursor: 'pointer' }}>
                  {KEY_TYPES.map((ty) => <option key={ty} value={ty}>{t(`apiKeys.type.${ty}`)}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle} htmlFor="ak-org">{t('apiKeys.field.organisation')}</label>
                <input id="ak-org" value={form.organisation} onChange={set('organisation')} style={inputStyle} />
              </div>
            </div>
            <div>
              <label style={labelStyle} htmlFor="ak-desc">{t('apiKeys.field.description')}</label>
              <input id="ak-desc" value={form.description} onChange={set('description')} style={inputStyle} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle} htmlFor="ak-cn">{t('apiKeys.field.contactName')}</label>
                <input id="ak-cn" value={form.contact_name} onChange={set('contact_name')} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle} htmlFor="ak-ce">{t('apiKeys.field.contactEmail')}</label>
                <input id="ak-ce" type="email" value={form.contact_email} onChange={set('contact_email')} style={inputStyle} />
              </div>
            </div>

            {/* Access grid — set permissions up front (shared with the Access tab) */}
            <div>
              <label style={labelStyle}>{t('apiKeys.tab.access')}</label>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 8px' }}>{t('apiKeys.access.subtitle')}</p>
              <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                <ScopeEditor value={scopes} onChange={setScopes} />
              </div>
            </div>

            {error && <div style={{ fontSize: 12, color: 'var(--color-danger)' }}>{t('apiKeys.createError')}</div>}

            <button onClick={submit} disabled={saving || !form.friendly_name.trim()}
              style={{ height: 38, marginTop: 4, fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 8, background: 'var(--color-primary)', color: 'white', cursor: form.friendly_name.trim() ? 'pointer' : 'not-allowed', opacity: form.friendly_name.trim() ? 1 : 0.5 }}>
              {saving ? t('apiKeys.creating') : t('apiKeys.create')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
