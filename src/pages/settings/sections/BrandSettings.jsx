import { useState, useEffect, useRef } from 'react'
import { contrastRatio, applyBrandTokens, clampedOnAccent } from '@/hooks/useTenantTheme'
import { useTranslation } from 'react-i18next'
import { Check, Save, Upload, X } from 'lucide-react'
import Spinner from '@/components/ui/Spinner'
import api from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { loadSettings, saveSettings } from '../lib/settingsApi'
import { BTN_H } from '@/config/buttonMetrics'
import SaveButton from '@/components/ui/SaveButton'
import Button from '@/components/ui/Button'
import { PageTitle, Caption } from '@/components/ui/typography'

// Preset swatches are tenant brand-colour DATA (persisted as brand_color) — literal hex by design, never tokens.
/* eslint-disable no-restricted-syntax -- DATA: fixed swatch palette offered to tenants in the brand-colour picker */
const BRAND_COLOR_PRESETS = [
  '#3B8FD4', '#19A5CA', '#0EA5E9', '#10B981', '#D97706',
  '#DC2626', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316',
]
/* eslint-enable no-restricted-syntax */

export default function BrandSettings() {
  const { t } = useTranslation('settings')
  const auth = useAuth()
  // eslint-disable-next-line no-restricted-syntax -- DATA: default brand colour value, not UI styling
  const [primaryColor, setPrimaryColor]   = useState('#3B8FD4') // default brand colour (data, not styling)
  // eslint-disable-next-line no-restricted-syntax -- DATA: typeable hex mirror of primaryColor's default
  const [hexDraft,     setHexDraft]       = useState('#3B8FD4') // typeable hex mirror of primaryColor
  // BRAND-TEXT-COLOR-1 (Danny 08-08: "als ik geel kies moet de txt niet wit zijn"):
  // the colour of text ON the accent. '' = automatic — useTenantTheme derives
  // black/white from the brand's luminance, which is right for most tenants; an
  // explicit pick overrides it.
  const [textColor,    setTextColor]      = useState('')
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
        if (stored.brand_color)    { setPrimaryColor(stored.brand_color); setHexDraft(stored.brand_color) }
        if (stored.brand_text_color) setTextColor(stored.brand_text_color)
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

  // BRAND-TEXT-COLOR-1 (Danny 08-08: "txt blijft wit"): the live preview used to
  // move ONLY --color-primary, so picking yellow kept the white default text until
  // a save + reload let useTenantTheme recompute it. P2a (13-08): now shares the
  // ONE applyBrandTokens implementation with the hook, so the preview sets the
  // FULL token set (primary/-light/-bg/-text/on-accent) instead of a partial pair.
  const applyAccentTokens = (color, text) => applyBrandTokens(color, text)

  const applyColor = (color) => {
    setPrimaryColor(color)
    setHexDraft(color)
    applyAccentTokens(color, textColor)
  }

  const save = async () => {
    setSaving(true)
    setLogoError(null)
    try {
      // '' (automatic) is sent as null so the backend clears any earlier pick.
      const payload = { brand_color: primaryColor, company_name: companyName, brand_text_color: textColor || null }
      if (logoFile) {
        const fd = new FormData()
        fd.append('logo', logoFile)
        try {
          // The upload endpoint persists the private path itself (logo_path) and the
          // URL is minted fresh on every read (12 h TTL, LOGO-TTL-1) — storing the returned
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
      // logo_url is a fresh signed URL per response (12 h TTL), never cached.
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
          <PageTitle>{t('brand.title')}</PageTitle>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('brand.subtitle')}</p>
        </div>
        {/* SaveButton — the ONE saved-state save action (§4 success token pair). */}
        <SaveButton saved={saved} onClick={save} disabled={saving}>
          {saved   ? <><Check size={13} /> {t('common.saved')}</>                         :
           saving  ? <><Spinner size={13} /> {t('common.saving')}</> :
                     <><Save size={13} /> {t('common.save')}</>}
        </SaveButton>
      </div>

      {loading && <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>{t('common.loading')}</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px' }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>{t('brand.companyName')}</div>
          <Caption as="div" style={{ marginBottom: 10 }}>{t('brand.companyNameHint')}</Caption>
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
          <Caption as="div" style={{ marginBottom: 12 }}>{t('brand.primaryColorHint')}</Caption>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {BRAND_COLOR_PRESETS.map(c => (
              <button key={c} onClick={() => applyColor(c)}
                // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- DATA: preset swatch, its own fill IS the brand-colour value, not a Button
                style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: 'none',
                         cursor: 'pointer', outline: primaryColor === c ? `3px solid ${c}` : 'none',
                         outlineOffset: 2, transition: 'transform 0.1s', transform: primaryColor === c ? 'scale(1.2)' : 'scale(1)' }} />
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4 }}>
              <input type="color" value={primaryColor}
                onChange={e => applyColor(e.target.value)}
                style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid var(--border)',
                         cursor: 'pointer', padding: 2 }} />
              {/* Typeable hex (Danny 16-07): the code next to the picker was read-only
                  text — paste/type a brand hex directly; applies once it's a valid #rrggbb. */}
              <input type="text" value={hexDraft} aria-label={t('brand.primaryColor')}
                onChange={e => {
                  const v = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`
                  setHexDraft(v)
                  if (/^#[0-9a-fA-F]{6}$/.test(v)) applyColor(v.toLowerCase())
                }}
                onBlur={() => setHexDraft(primaryColor)}
                maxLength={7} spellCheck={false}
                style={{ width: 84, fontSize: 12, fontFamily: "'JetBrains Mono', monospace", padding: '5px 8px',
                         borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)',
                         color: 'var(--text)', outline: 'none' }} />
            </div>
          </div>
          {/* Text ON the accent — automatic by default, overridable. */}
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>{t('brand.textColor')}</div>
            <Caption as="div" style={{ marginBottom: 10 }}>{t('brand.textColorHint')}</Caption>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* eslint-disable-next-line no-restricted-syntax -- DATA: fixed light/dark text-colour option values, not styling */}
              {[{ v: '', label: t('brand.textColorAuto') }, { v: '#FFFFFF', label: t('brand.textColorLight') }, { v: '#1F2937', label: t('brand.textColorDark') }].map(o => {
                const active = textColor === o.v
                return (
                  <button key={o.v || 'auto'} type="button" onClick={() => { setTextColor(o.v); applyAccentTokens(primaryColor, o.v) }} aria-pressed={active}
                    // Chosen block keeps DARK text (Danny 08-08): the house soft-tint
                    // normally colours the label with its own token, but here that token
                    // is the tenant's accent — on a light brand (yellow, mint) accent-on-tint
                    // is unreadable. The tint + border still carry the colour; the label stays legible.
                    // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- deliberate exception above: label stays --text (not the tint token) so it never goes accent-on-accent-tint unreadable, not a plain Button
                    style={{ padding: '5px 11px', fontSize: 12, fontWeight: active ? 600 : 500, borderRadius: 8, cursor: 'pointer',
                      color: 'var(--text)',
                      background: active ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'var(--surface)',
                      border: `1px solid ${active ? 'color-mix(in srgb, var(--color-primary) 40%, transparent)' : 'var(--border)'}` }}>
                    {o.label}
                  </button>
                )
              })}
              {/* eslint-disable-next-line no-restricted-syntax -- DATA: fallback value for the native colour input, not styling */}
              <input type="color" value={textColor || '#FFFFFF'} aria-label={t('brand.textColor')}
                onChange={e => { setTextColor(e.target.value); applyAccentTokens(primaryColor, e.target.value) }}
                style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', padding: 2 }} />
            </div>
            {/* Honest contrast warning: an EXPLICIT pick overrides the automatic one,
                so a tenant can pin white on a light brand and make its own buttons
                unreadable (measured on Yesway: a seeded #FFFFFF on orange scores 2.8).
                Say it out loud and name the fix — never silently ignore the choice. */}
            {textColor && contrastRatio(textColor, primaryColor) < 4.5 && (
              <div role="status" style={{ marginTop: 10, fontSize: 11, padding: '7px 10px', borderRadius: 8,
                color: 'var(--color-warning)', background: 'color-mix(in srgb, var(--color-warning) 10%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-warning) 30%, transparent)' }}>
                {/* Two different things can be true below AA, and the screen used to
                    say only one of them (Danny 14-08: "staat op wit maar is geen wit").
                    Between the clamp floor and AA the pick IS in effect, just weak.
                    BELOW the floor the theme silently swaps in the readable colour, so
                    the chip reads "Wit" while the button renders dark. Name that out
                    loud, including which colour is actually painted, or the control
                    claims a state the app is not in (§3). */}
                {clampedOnAccent(textColor, primaryColor).toLowerCase() !== textColor.toLowerCase()
                  ? t('brand.textColorOverridden', {
                      ratio: contrastRatio(textColor, primaryColor).toFixed(1),
                      used: clampedOnAccent(textColor, primaryColor).toUpperCase(),
                    })
                  : t('brand.textColorLowContrast', { ratio: contrastRatio(textColor, primaryColor).toFixed(1) })}
              </div>
            )}
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('brand.preview')}</span>
            {/* BTN_H (§4/§9): one explicit height for every text/action button, everywhere (incl. this live preview). */}
            {/* BRAND-TEXT-COLOR-1: this preview's background IS the tenant accent (primaryColor,
                live-synced to --color-primary), so its label must read the same on-accent token the
                Save button and every other accent-filled control uses — a hardcoded white here was
                exactly Danny's 08-08 bug (yellow brand -> white-on-yellow, unreadable). */}
            {/* eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- non-interactive brand-colour PREVIEW: must render the raw picked colour live, not the house Button identity */}
            <button style={{ height: BTN_H, padding: '0 14px', fontSize: 12, fontWeight: 500,
                             background: primaryColor, color: 'var(--color-on-accent)', border: 'none', borderRadius: 7, cursor: 'default' }}>
              {t('brand.buttonPreview')}
            </button>
            <span style={{ fontSize: 12, color: primaryColor, fontWeight: 500, cursor: 'default' }}>{t('brand.linkPreview')}</span>
          </div>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px' }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>{t('brand.logo')}</div>
          <Caption as="div" style={{ marginBottom: 12 }}>{t('brand.logoHint')}</Caption>
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
              <Button variant="secondary" onClick={() => fileRef.current?.click()}>
                <Upload size={13} /> {t('common.upload')}
              </Button>
              {logoPreview && (
                <Button variant="dangerSoft" onClick={() => { setLogoPreview(null); setLogoFile(null) }}>
                  {t('common.remove')}
                </Button>
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
              <Button variant="ghost" iconOnly onClick={() => setLogoError(null)} aria-label={t('common.close')} style={{ color: 'var(--color-danger)' }}>
                <X size={13} />
              </Button>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
