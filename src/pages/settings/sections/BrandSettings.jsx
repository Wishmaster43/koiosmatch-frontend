import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, RefreshCw, Save, Upload, X } from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { loadSettings, saveSettings } from '../lib/settingsApi'

// Preset swatches are tenant brand-colour DATA (persisted as brand_color) — literal hex by design, never tokens.
const BRAND_COLOR_PRESETS = [
  '#3B8FD4', '#19A5CA', '#0EA5E9', '#10B981', '#D97706',
  '#DC2626', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316',
]

export default function BrandSettings() {
  const { t } = useTranslation('settings')
  const auth = useAuth()
  const [primaryColor, setPrimaryColor]   = useState('#3B8FD4') // default brand colour (data, not styling)
  const [logoPreview,  setLogoPreview]    = useState(null)
  const [logoFile,     setLogoFile]       = useState(null)
  const [companyName,  setCompanyName]    = useState('')
  const [saved,        setSaved]          = useState(false)
  const [saving,       setSaving]         = useState(false)
  const [loading,      setLoading]        = useState(true)
  // Server-side upload error (422 — bad type/size, or the SVG-script-scan rejection) —
  // shown inline near the logo block instead of swallowed (was a silent catch {}).
  const [logoError,    setLogoError]      = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    loadSettings()
      .then(stored => {
        if (stored.brand_color)    setPrimaryColor(stored.brand_color)
        if (stored.company_name)   setCompanyName(stored.company_name)
        if (stored.logo_url)       setLogoPreview(stored.logo_url)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoError(null) // a fresh pick clears any previous upload error
    setLogoFile(file)
    const reader = new FileReader()
    reader.onload = ev => setLogoPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  const applyColor = (color) => {
    setPrimaryColor(color)
    document.documentElement.style.setProperty('--color-primary', color)
  }

  const save = async () => {
    setSaving(true)
    setLogoError(null)
    try {
      const payload = { brand_color: primaryColor, company_name: companyName }
      if (logoFile) {
        const fd = new FormData()
        fd.append('logo', logoFile)
        try {
          // The upload endpoint persists the private path itself (logo_path) and the
          // URL is minted fresh on every read (5 min TTL) — storing the returned
          // signed URL in settings would re-create the legacy logo_url row the
          // backend just cleaned up, and it expires. Response only feeds the preview.
          const res = await api.post('/settings/logo', fd)
          if (res.data?.logo_url) setLogoPreview(res.data.logo_url)
          setLogoFile(null)
        } catch (err) {
          // 422 (bad type/size, or the SVG script-scan rejection) — show the
          // backend's own message; the rest of the form still saves below.
          setLogoError(err?.response?.data?.message ?? t('brand.logoUploadError'))
        }
      }
      await saveSettings(payload)
      document.documentElement.style.setProperty('--color-primary', primaryColor)
      // Refresh the auth/tenant payload so the topbar logo appears immediately —
      // logo_url is a fresh signed URL per response (5 min TTL), never cached.
      auth?.refreshUser?.().catch(() => {})
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch { /* noop */ }
    setSaving(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{t('brand.title')}</h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('brand.subtitle')}</p>
        </div>
        <button onClick={save} disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px',
                   fontSize: 13, fontWeight: 500, borderRadius: 8, cursor: saving ? 'wait' : 'pointer',
                   border: 'none', opacity: saving ? 0.7 : 1,
                   background: saved ? 'var(--color-success)' : 'var(--color-primary)', color: 'white', transition: 'background 0.2s' }}>
          {saved   ? <><Check size={13} /> {t('common.saved')}</>                         :
           saving  ? <><RefreshCw size={13} className="animate-spin" /> {t('common.saving')}</> :
                     <><Save size={13} /> {t('common.save')}</>}
        </button>
      </div>

      {loading && <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>{t('common.loading')}</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px' }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>{t('brand.companyName')}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>{t('brand.companyNameHint')}</div>
          <input
            value={companyName}
            onChange={e => setCompanyName(e.target.value)}
            placeholder={t('brand.companyNamePlaceholder')}
            style={{ height: 36, width: '100%', maxWidth: 320, padding: '0 12px', fontSize: 13,
                     border: '1px solid var(--border)', borderRadius: 8, outline: 'none', color: 'var(--text)' }}
          />
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px' }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>{t('brand.primaryColor')}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>{t('brand.primaryColorHint')}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {BRAND_COLOR_PRESETS.map(c => (
              <button key={c} onClick={() => applyColor(c)}
                style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: 'none',
                         cursor: 'pointer', outline: primaryColor === c ? `3px solid ${c}` : 'none',
                         outlineOffset: 2, transition: 'transform 0.1s', transform: primaryColor === c ? 'scale(1.2)' : 'scale(1)' }} />
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4 }}>
              <input type="color" value={primaryColor}
                onChange={e => applyColor(e.target.value)}
                style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid var(--border)',
                         cursor: 'pointer', padding: 2 }} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{primaryColor}</span>
            </div>
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('brand.preview')}</span>
            <button style={{ height: 30, padding: '0 14px', fontSize: 12, fontWeight: 500,
                             background: primaryColor, color: 'white', border: 'none', borderRadius: 7, cursor: 'default' }}>
              {t('brand.buttonPreview')}
            </button>
            <span style={{ fontSize: 12, color: primaryColor, fontWeight: 500, cursor: 'default' }}>{t('brand.linkPreview')}</span>
          </div>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px' }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>{t('brand.logo')}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>{t('brand.logoHint')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {logoPreview ? (
              <img src={logoPreview} alt="Logo" style={{ height: 48, maxWidth: 120, objectFit: 'contain',
                border: '1px solid var(--border)', borderRadius: 8, padding: 4 }} />
            ) : (
              <div style={{ width: 80, height: 48, borderRadius: 8, background: 'var(--hover-bg)',
                            border: '1px dashed var(--border)', display: 'flex', alignItems: 'center',
                            justifyContent: 'center' }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t('brand.noLogo')}</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => fileRef.current?.click()}
                style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px',
                         fontSize: 13, fontWeight: 500, borderRadius: 8, cursor: 'pointer',
                         border: '1px solid var(--border)', background: 'var(--hover-bg)', color: 'var(--text)' }}>
                <Upload size={13} /> {t('common.upload')}
              </button>
              {logoPreview && (
                <button onClick={() => { setLogoPreview(null); setLogoFile(null) }}
                  style={{ height: 34, padding: '0 12px', fontSize: 13, borderRadius: 8, cursor: 'pointer',
                           border: '1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)', background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>
                  {t('common.remove')}
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"
              style={{ display: 'none' }} onChange={handleLogoChange} />
          </div>

          {/* Server-side upload error (422 — bad type/size, or the SVG script-scan rejection). */}
          {logoError && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 12, padding: '10px 12px',
              borderRadius: 8, background: 'var(--color-danger-bg)',
              border: '1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)' }}>
              <span style={{ fontSize: 12, color: 'var(--color-danger)', flex: 1 }}>{logoError}</span>
              <button onClick={() => setLogoError(null)} aria-label={t('common.close')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', display: 'flex' }}>
                <X size={13} />
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
