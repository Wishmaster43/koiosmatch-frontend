import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, RefreshCw, Save } from 'lucide-react'
import { loadSettings, saveSettings } from '../lib/settingsApi'
import { useIndustries } from '@/lib/useIndustries'
// One language source for the whole app (Danny 14/7): the same five shipped
// locales the profile picker offers — never a diverging local list.
import { LANGUAGES as APP_LANGUAGES } from '@/pages/auth/profileParts'
import { BTN_H } from '@/config/buttonMetrics'
import MfaEnforcementSetting from './MfaEnforcementSetting'

// Option lists (data — kept as-is; only labels are translated). Industries are
// now tenant-configurable (Settings → Personalisation → Industries).
const LANGUAGES = APP_LANGUAGES.map(l => l.label)
const CURRENCIES = ['Euro (€)','Dollar ($)','Pond (£)']
const TIMEZONES  = ['Europa/Amsterdam','Europa/Brussel','Europa/Londen','UTC']
const COUNTRIES  = ['Netherlands','Belgium','Germany','United Kingdom']

// Module-scope so they keep a stable identity across renders (otherwise text
// inputs lose focus on every keystroke).
function Row({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', padding: '14px 0', borderBottom: '1px solid var(--hover-bg)', gap: 24 }}>
      <div style={{ width: 200, flexShrink: 0, fontSize: 13, color: 'var(--text-muted)', paddingTop: 8 }}>{label}</div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  )
}

const baseInput = {
  height: 36, padding: '0 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8,
  outline: 'none', color: 'var(--text)', width: '100%', maxWidth: 360, boxSizing: 'border-box',
}

function Input({ value, onChange, placeholder, style }) {
  return (
    <input value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ ...baseInput, ...style }} />
  )
}

function Select({ value, onChange, options }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ ...baseInput, background: 'var(--surface)' }}>
      {options.map(o => <option key={o}>{o}</option>)}
    </select>
  )
}

const EMPTY = {
  company_industry: '', company_country: 'Netherlands',
  company_street: '', company_house_number: '', company_house_number_suffix: '',
  company_postcode: '', company_city: '', company_province: '',
  company_language: 'Nederlands', company_currency: 'Euro (€)', company_timezone: 'Europa/Amsterdam',
  // Opt-in, default OFF (§3B — never default a tenant into a new behavior).
  career_site_active: false,
}

export default function CompanySettings() {
  const { t } = useTranslation('settings')
  // Tenant-configurable industry options for the dropdown below.
  const { industries } = useIndustries()
  const [form,       setForm]       = useState(EMPTY)
  const [bannerUrl,  setBannerUrl]  = useState(null)
  const [saved,      setSaved]      = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [loading,    setLoading]    = useState(true)
  const bannerRef = useRef(null)

  useEffect(() => {
    loadSettings().then(s => {
      setForm(f => ({
        ...f,
        company_industry: s.company_industry ?? '',
        company_country:  s.company_country  ?? 'Netherlands',
        // Migrate legacy single-line address into the street field if needed.
        company_street:              s.company_street              ?? s.company_address1 ?? '',
        company_house_number:        s.company_house_number        ?? '',
        company_house_number_suffix: s.company_house_number_suffix ?? '',
        company_postcode: s.company_postcode ?? '',
        company_city:     s.company_city     ?? '',
        company_province: s.company_province ?? '',
        company_language: s.company_language ?? 'Nederlands',
        company_currency: s.company_currency ?? 'Euro (€)',
        company_timezone: s.company_timezone ?? 'Europa/Amsterdam',
        // Booleans round-trip through the settings store as strings (settingsApi
        // stringifies on save), so coerce every truthy legacy/string form here.
        career_site_active: [true, 1, '1', 'true'].includes(s.career_site_active),
      }))
      if (s.company_banner_url)  setBannerUrl(s.company_banner_url)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleBannerFile = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    setLoading(true)
    try {
      const url = URL.createObjectURL(file)
      setBannerUrl(url)
      await saveSettings({ company_banner_url: url })
    } catch { /* noop */ } finally { setLoading(false) }
  }

  const save = async () => {
    setSaving(true)
    try {
      const payload = { ...form }
      if (bannerUrl) payload.company_banner_url = bannerUrl
      await saveSettings(payload)
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } catch { /* noop */ } finally { setSaving(false) }
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{t('company.title')}</h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('company.subtitle')}</p>
        </div>
        <button onClick={save} disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: BTN_H, padding: '0 14px',
                   fontSize: 13, fontWeight: 500, borderRadius: 8, border: 'none', cursor: 'pointer',
                   background: saved ? 'var(--color-success)' : 'var(--color-primary)', color: 'white' }}>
          {saved ? <><Check size={13}/> {t('common.saved')}</> : saving ? <><RefreshCw size={13} className="animate-spin"/> {t('common.saving')}</> : <><Save size={13}/> {t('common.save')}</>}
        </button>
      </div>

      {/* Company name & logo live under Brand — kept in one place to avoid duplicates. */}
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>{t('company.managedUnder')}</p>

      {loading && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('common.loading')}</p>}

      {!loading && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '0 24px' }}>
          <Row label={t('company.banner')}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {bannerUrl && <img src={bannerUrl} alt="" style={{ width: '100%', maxWidth: 400, height: 100, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />}
              <div style={{ display: 'flex', gap: 8 }}>
                <input ref={bannerRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBannerFile} />
                {/* BTN_H (§4/§9): one explicit height for every text/action button, everywhere. */}
                <button onClick={() => bannerRef.current?.click()} style={{ height: BTN_H, padding: '0 12px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text)' }}>{t('common.upload')}</button>
                {bannerUrl && <button onClick={() => setBannerUrl(null)} style={{ height: BTN_H, padding: '0 12px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text)' }}>{t('common.remove')}</button>}
              </div>
            </div>
          </Row>
          <Row label={t('company.industry')}><Select value={form.company_industry} onChange={v => set('company_industry', v)} options={industries} /></Row>
          <Row label={t('company.country')}><Select value={form.company_country} onChange={v => set('company_country', v)} options={COUNTRIES} /></Row>

          <Row label={t('company.street')}><Input value={form.company_street} onChange={v => set('company_street', v)} placeholder={t('company.streetPlaceholder')} /></Row>
          <Row label={t('company.houseNumber')}>
            <div style={{ display: 'flex', gap: 12 }}>
              <Input value={form.company_house_number} onChange={v => set('company_house_number', v)} placeholder="28" style={{ maxWidth: 170 }} />
              <Input value={form.company_house_number_suffix} onChange={v => set('company_house_number_suffix', v)} placeholder={t('company.houseNumberSuffix')} style={{ maxWidth: 170 }} />
            </div>
          </Row>
          <Row label={t('company.postcode')}><Input value={form.company_postcode} onChange={v => set('company_postcode', v)} placeholder="1234 AB" /></Row>
          <Row label={t('company.city')}><Input value={form.company_city} onChange={v => set('company_city', v)} placeholder={t('company.cityPlaceholder')} /></Row>
          <Row label={t('company.province')}><Input value={form.company_province} onChange={v => set('company_province', v)} placeholder={t('company.province')} /></Row>
          <Row label={t('company.language')}><Select value={form.company_language} onChange={v => set('company_language', v)} options={LANGUAGES} /></Row>
          <Row label={t('company.currency')}><Select value={form.company_currency} onChange={v => set('company_currency', v)} options={CURRENCIES} /></Row>
          <Row label={t('company.timezone')}><Select value={form.company_timezone} onChange={v => set('company_timezone', v)} options={TIMEZONES} /></Row>

          {/* Opt-in toggle only — this persists the tenant's preference today; the
              public career site does not yet enforce it (backend ticket CAREER-SITE-ACTIVE
              is still open), so this is an honest gate, not a live switch (§3). */}
          <Row label={t('company.careerSiteActive')}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.career_site_active}
                  onChange={e => set('career_site_active', e.target.checked)}
                  style={{ accentColor: 'var(--color-primary)' }} />
                {form.career_site_active ? t('company.careerSiteOn') : t('company.careerSiteOff')}
              </label>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('company.careerSiteHint')}</p>
            </div>
          </Row>
        </div>
      )}
      {/* Organisation-wide MFA policy (admin-only, self-gated) — moved here from the
          personal security screen: an org policy is a company setting, not a profile
          item (Danny 16-07). */}
      <MfaEnforcementSetting />
    </div>
  )
}
