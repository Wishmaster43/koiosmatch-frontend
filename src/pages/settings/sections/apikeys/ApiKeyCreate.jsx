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
import { ArrowLeft, Key } from 'lucide-react'
import { createApiKey } from './apiKeysApi'
import { KEY_TYPES } from './constants'
import ScopeEditor from './ScopeEditor'
import SearchSelect from '@/components/ui/SearchSelect'
import OneTimeSecretReveal from '@/pages/settings/components/OneTimeSecretReveal'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'
import Button from '@/components/ui/Button'
import { Caption } from '@/components/ui/typography'

// Two-phase inline view (see the module doc above): the create form, then the one-time secret reveal — no modal, so the whole overview stays readable.
export default function ApiKeyCreate({ onBack, onCreated }) {
  const { t } = useTranslation('settings')
  const [form, setForm]     = useState({ friendly_name: '', type: 'additional', organisation: '', description: '', contact_name: '', contact_email: '' })
  const [scopes, setScopes] = useState({})   // access grid, sent with the create call
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(false)
  const [result, setResult] = useState(null)   // { ...key, secret } after create
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

  // Canon field style (G33/fieldMetrics) — was its own height-38/padding-11 copy
  // (one of only two 38px outliers on the whole platform; 34 is the majority).
  const inputStyle = fieldInputStyle
  const labelStyle = { fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 5, display: 'block' }
  const fieldGrid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }

  return (
    <div>
      {/* Header: back + icon + title (mirrors ApiKeyDetail) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
        <Button variant="secondary" onClick={onBack} aria-label={t('common.back')}>
          <ArrowLeft size={13} /> {t('common.back')}
        </Button>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--color-primary-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Key size={16} style={{ color: 'var(--color-primary-text)' }} />
        </div>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{t('apiKeys.createTitle')}</h2>
      </div>

      {/* Form / secret reveal, capped to a comfortable reading width */}
      <div style={{ maxWidth: 760 }}>
        {result ? (
          // Phase 2 — one-time secret reveal (shared with WebhookCreate).
          <OneTimeSecretReveal
            title={t('apiKeys.secretOnce')}
            secret={result.secret}
            copyLabel={t('apiKeys.copySecret')}
            copiedLabel={t('common.copied')}
            doneLabel={t('apiKeys.done')}
            onDone={onBack}
          />
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
                <SearchSelect
                  options={KEY_TYPES.map(ty => ({ value: ty, label: t(`apiKeys.type.${ty}`) }))}
                  selected={[form.type]}
                  onToggle={v => set('type')({ target: { value: v } })}
                  closeOnToggle
                  searchable={false}
                  renderTrigger={toggle => (
                    // HUISSTIJL-1 necessity: this is a SearchSelect trigger styled as a
                    // form field (inputStyle), not an action — Button's identity is for
                    // actions, a dropdown trigger inherits SearchSelect/fieldMetrics face.
                    <button type="button" id="ak-type" onClick={toggle}
                      // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- form-field trigger face (SearchSelect/fieldMetrics), not an action button; Button identity does not apply to field triggers
                      style={{ ...inputStyle, cursor: 'pointer', textAlign: 'left' }}>
                      {t(`apiKeys.type.${form.type}`)}
                    </button>
                  )}
                />
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
              <Caption style={{ display: 'block', margin: '0 0 10px' }}>{t('apiKeys.access.subtitle')}</Caption>
              <ScopeEditor value={scopes} onChange={setScopes} />
            </div>

            {error && <div style={{ fontSize: 12, color: 'var(--color-danger-text)' }}>{t('apiKeys.createError')}</div>}

            <div style={{ display: 'flex', gap: 10 }}>
              <Button variant="primary" onClick={submit} disabled={saving || !form.friendly_name.trim()}>
                {saving ? t('apiKeys.creating') : t('apiKeys.create')}
              </Button>
              <Button variant="secondary" onClick={onBack}>
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
