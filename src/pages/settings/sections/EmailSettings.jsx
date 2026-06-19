/**
 * EmailSettings — one full email connection PER context (klanten / kandidaten /
 * planning), each its own tab. Because connecting e.g. Gmail for client reminders
 * vs. planning means separate accounts, every context has its own provider/SMTP
 * credentials, sender identity AND email signature. Everything is stored under
 * `email_<context>_*` settings keys; the signature is HTML (RichTextEditor).
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Save, RefreshCw, Check, Mail, AlertTriangle, Eye, EyeOff } from 'lucide-react'
import api from '../../../lib/api'
import { loadSettings, saveSettings } from '../lib/settingsApi'
import RichTextEditor from '../../../components/ui/RichTextEditor'

export default function EmailSettings({ context = 'klanten' }) {
  const { t } = useTranslation('settings')
  const K = `email_${context}_`   // settings-key prefix for this context

  const [provider,     setProvider]     = useState('manual')
  const [fromName,     setFromName]      = useState('')
  const [fromEmail,    setFromEmail]     = useState('')
  const [smtpHost,     setSmtpHost]      = useState('')
  const [smtpPort,     setSmtpPort]      = useState('587')
  const [smtpUser,     setSmtpUser]      = useState('')
  const [smtpPass,     setSmtpPass]      = useState('')
  const [smtpPassSet,  setSmtpPassSet]   = useState(false)
  const [smtpSecure,   setSmtpSecure]    = useState('tls')
  const [signature,    setSignature]     = useState('')
  const [sigExpanded,  setSigExpanded]    = useState(false)
  const [showPass,     setShowPass]      = useState(false)
  const [saved,        setSaved]         = useState(false)
  const [saving,       setSaving]        = useState(false)
  const [loading,      setLoading]       = useState(true)
  const [testing,      setTesting]       = useState(false)
  const [testResult,   setTestResult]    = useState(null)

  useEffect(() => {
    setLoading(true)
    loadSettings()
      .then(stored => {
        setProvider(stored[`${K}provider`]  ?? 'manual')
        setFromName(stored[`${K}from_name`] ?? '')
        setFromEmail(stored[`${K}from`]     ?? '')
        setSmtpHost(stored[`${K}smtp_host`] ?? '')
        setSmtpPort(stored[`${K}smtp_port`] ?? '587')
        setSmtpUser(stored[`${K}smtp_user`] ?? '')
        setSmtpSecure(stored[`${K}smtp_secure`] ?? 'tls')
        setSmtpPassSet(stored[`${K}smtp_pass`] === '••••••••')
        setSignature(stored[`${K}signature`] ?? '')
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [K])

  const save = async () => {
    setSaving(true)
    try {
      const payload = {
        [`${K}provider`]: provider, [`${K}from_name`]: fromName, [`${K}from`]: fromEmail,
        [`${K}smtp_host`]: smtpHost, [`${K}smtp_port`]: smtpPort, [`${K}smtp_user`]: smtpUser,
        [`${K}smtp_secure`]: smtpSecure, [`${K}signature`]: signature,
      }
      if (smtpPass) payload[`${K}smtp_pass`] = smtpPass
      await saveSettings(payload)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch { /* noop */ }
    setSaving(false)
  }

  const testConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await api.post('/settings/email/test', { context })
      setTestResult({ ok: true, msg: res.data?.message ?? t('email.testSent') })
    } catch (err) {
      setTestResult({ ok: false, msg: err.response?.data?.message ?? t('email.testFailed') })
    }
    setTesting(false)
  }

  const inputStyle = {
    height: 36, width: '100%', padding: '0 12px', fontSize: 13,
    border: '1px solid #E5E7EB', borderRadius: 8, outline: 'none', color: '#111827',
  }
  const labelStyle = { fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 4, display: 'block' }

  const PROVIDERS = [
    { id: 'gmail',  label: 'Gmail',                 desc: t('email.gmailDesc') },
    { id: 'office', label: 'Office 365',            desc: t('email.officeDesc') },
    { id: 'manual', label: t('email.manualLabel'),  desc: t('email.manualDesc') },
  ]

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: 20, gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>{t(`email.context.${context}.title`)}</h2>
          <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{t(`email.context.${context}.subtitle`)}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={testConnection} disabled={testing}
            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px', whiteSpace: 'nowrap',
                     fontSize: 13, fontWeight: 500, borderRadius: 8, cursor: testing ? 'wait' : 'pointer',
                     border: '1px solid #E5E7EB', background: '#F9FAFB', color: '#374151', opacity: testing ? 0.6 : 1 }}>
            {testing ? <RefreshCw size={13} className="animate-spin" /> : <Mail size={13} />}
            {t('email.testConnection')}
          </button>
          <button onClick={save} disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px', whiteSpace: 'nowrap',
                     fontSize: 13, fontWeight: 500, borderRadius: 8, cursor: saving ? 'wait' : 'pointer',
                     border: 'none', opacity: saving ? 0.7 : 1,
                     background: saved ? 'var(--color-success)' : 'var(--color-primary)', color: 'white', transition: 'background 0.2s' }}>
            {saved   ? <><Check size={13} /> {t('common.saved')}</>                         :
             saving  ? <><RefreshCw size={13} className="animate-spin" /> {t('common.saving')}</> :
                       <><Save size={13} /> {t('common.save')}</>}
          </button>
        </div>
      </div>

      {testResult && (
        <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, fontSize: 13,
                      display: 'flex', alignItems: 'center', gap: 8,
                      background: testResult.ok ? '#F0FDF4' : '#FEF2F2',
                      border: `1px solid ${testResult.ok ? '#86EFAC' : '#FCA5A5'}`,
                      color: testResult.ok ? 'var(--color-success)' : 'var(--color-danger)' }}>
          {testResult.ok ? <Check size={14} /> : <AlertTriangle size={14} />}
          {testResult.msg}
        </div>
      )}

      {loading && <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 12 }}>{t('common.loading')}</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Provider choice */}
        <div style={{ background: 'white', border: '1px solid #F3F4F6', borderRadius: 10, padding: '16px 18px' }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', marginBottom: 12 }}>{t('email.provider')}</div>
          <div style={{ display: 'flex', gap: 10 }}>
            {PROVIDERS.map(p => (
              <button key={p.id} onClick={() => setProvider(p.id)}
                style={{ flex: 1, padding: '12px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                         border: `1px solid ${provider === p.id ? 'var(--color-primary)' : '#E5E7EB'}`,
                         background: provider === p.id ? 'var(--color-primary-bg, var(--color-secondary-bg))' : '#F9FAFB',
                         transition: 'all 0.15s' }}>
                <div style={{ fontSize: 13, fontWeight: 600,
                              color: provider === p.id ? 'var(--color-primary)' : '#111827', marginBottom: 2 }}>
                  {p.label}
                </div>
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>{p.desc}</div>
              </button>
            ))}
          </div>

          {(provider === 'gmail' || provider === 'office') && (
            <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--color-warning-bg)',
                          border: '1px solid #FDE68A', borderRadius: 8, fontSize: 12, color: '#92400E' }}>
              <strong>{t('email.oauthWarningTitle')}</strong> {t('email.oauthWarning', { provider: provider === 'gmail' ? 'Google' : 'Microsoft' })}
            </div>
          )}
        </div>

        {/* Sender details */}
        <div style={{ background: 'white', border: '1px solid #F3F4F6', borderRadius: 10, padding: '16px 18px' }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', marginBottom: 14 }}>{t('email.senderDetails')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>{t('email.senderName')}</label>
              <input value={fromName} onChange={e => setFromName(e.target.value)} placeholder={t('email.senderNamePlaceholder')} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>{t('email.fromAddress')}</label>
              <input type="email" value={fromEmail} onChange={e => setFromEmail(e.target.value)} placeholder={t('email.fromPlaceholder')} style={inputStyle} />
            </div>
          </div>
        </div>

        {/* SMTP (manual only) */}
        {provider === 'manual' && (
          <div style={{ background: 'white', border: '1px solid #F3F4F6', borderRadius: 10, padding: '16px 18px' }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', marginBottom: 14 }}>{t('email.smtpConfig')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>{t('email.smtpServer')}</label>
                <input value={smtpHost} onChange={e => setSmtpHost(e.target.value)} placeholder={t('email.smtpServerPlaceholder')} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>{t('email.port')}</label>
                <input type="number" value={smtpPort} onChange={e => setSmtpPort(e.target.value)} style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>{t('email.username')}</label>
                <input value={smtpUser} onChange={e => setSmtpUser(e.target.value)} placeholder={t('email.usernamePlaceholder')} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>
                  {t('email.password')}
                  {smtpPassSet && !smtpPass && (
                    <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--color-success)', fontWeight: 400 }}>{t('email.passwordSet')}</span>
                  )}
                </label>
                <div style={{ position: 'relative' }}>
                  <input type={showPass ? 'text' : 'password'} value={smtpPass}
                    onChange={e => setSmtpPass(e.target.value)}
                    placeholder={smtpPassSet ? t('email.passwordKeepPlaceholder') : t('email.passwordPlaceholder')}
                    style={{ ...inputStyle, paddingRight: 36 }} />
                  <button onClick={() => setShowPass(s => !s)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                             background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}>
                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>
            <div>
              <label style={labelStyle}>{t('email.security')}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { id: 'tls',  label: t('email.secTls') },
                  { id: 'ssl',  label: t('email.secSsl') },
                  { id: 'none', label: t('email.secNone') },
                ].map(s => (
                  <button key={s.id} onClick={() => setSmtpSecure(s.id)}
                    style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                             border: `1px solid ${smtpSecure === s.id ? 'var(--color-primary)' : '#E5E7EB'}`,
                             background: smtpSecure === s.id ? 'var(--color-primary-bg, var(--color-secondary-bg))' : '#F9FAFB',
                             color: smtpSecure === s.id ? 'var(--color-primary)' : '#374151',
                             fontWeight: smtpSecure === s.id ? 500 : 400 }}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Email signature (per context) */}
        <div style={{ background: 'white', border: '1px solid #F3F4F6', borderRadius: 10, padding: '16px 18px' }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', marginBottom: 2 }}>{t('email.signature')}</div>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 12 }}>{t('email.signatureHint')}</div>
          <RichTextEditor value={signature} onChange={setSignature}
            expanded={sigExpanded} onToggleExpand={() => setSigExpanded(e => !e)} />
        </div>

      </div>
    </div>
  )
}
