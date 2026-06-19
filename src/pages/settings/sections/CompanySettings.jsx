import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, RefreshCw, Save } from 'lucide-react'
import { loadSettings, saveSettings } from '../lib/settingsApi'

// Option lists (data — kept as-is; only labels are translated).
const INDUSTRIES = ['Werving','Uitzendbureau','Horeca','Logistiek','Zorg','IT','Bouw','Onderwijs','Financiën','Overig']
const LANGUAGES  = ['Nederlands','Engels','Duits','Frans']
const CURRENCIES = ['Euro (€)','Dollar ($)','Pond (£)']
const TIMEZONES  = ['Europa/Amsterdam','Europa/Brussel','Europa/Londen','UTC']
const COUNTRIES  = ['Netherlands','Belgium','Germany','United Kingdom']

// Module-scope so they keep a stable identity across renders (otherwise text
// inputs lose focus on every keystroke).
function Row({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', padding: '14px 0', borderBottom: '1px solid #F9FAFB', gap: 24 }}>
      <div style={{ width: 200, flexShrink: 0, fontSize: 13, color: '#6B7280', paddingTop: 8 }}>{label}</div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  )
}

const baseInput = {
  height: 36, padding: '0 10px', fontSize: 13, border: '1px solid #E5E7EB', borderRadius: 8,
  outline: 'none', color: '#111827', width: '100%', maxWidth: 360, boxSizing: 'border-box',
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
      style={{ ...baseInput, background: 'white' }}>
      {options.map(o => <option key={o}>{o}</option>)}
    </select>
  )
}

const EMPTY = {
  company_industry: '', company_country: 'Netherlands',
  company_street: '', company_house_number: '', company_house_number_suffix: '',
  company_address2: '', company_postcode: '', company_city: '', company_province: '',
  company_language: 'Nederlands', company_currency: 'Euro (€)', company_timezone: 'Europa/Amsterdam',
}

export default function CompanySettings() {
  const { t } = useTranslation('settings')
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
        company_address2: s.company_address2 ?? '',
        company_postcode: s.company_postcode ?? '',
        company_city:     s.company_city     ?? '',
        company_province: s.company_province ?? '',
        company_language: s.company_language ?? 'Nederlands',
        company_currency: s.company_currency ?? 'Euro (€)',
        company_timezone: s.company_timezone ?? 'Europa/Amsterdam',
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
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>{t('company.title')}</h2>
          <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{t('company.subtitle')}</p>
        </div>
        <button onClick={save} disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px',
                   fontSize: 13, fontWeight: 500, borderRadius: 8, border: 'none', cursor: 'pointer',
                   background: saved ? 'var(--color-success)' : 'var(--color-primary)', color: 'white' }}>
          {saved ? <><Check size={13}/> {t('common.saved')}</> : saving ? <><RefreshCw size={13} className="animate-spin"/> {t('common.saving')}</> : <><Save size={13}/> {t('common.save')}</>}
        </button>
      </div>

      {/* Company name & logo live under Brand — kept in one place to avoid duplicates. */}
      <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 12 }}>{t('company.managedUnder')}</p>

      {loading && <p style={{ fontSize: 13, color: '#9CA3AF' }}>{t('common.loading')}</p>}

      {!loading && (
        <div style={{ background: 'white', border: '1px solid #F3F4F6', borderRadius: 12, padding: '0 24px' }}>
          <Row label={t('company.banner')}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {bannerUrl && <img src={bannerUrl} alt="" style={{ width: '100%', maxWidth: 400, height: 100, objectFit: 'cover', borderRadius: 8, border: '1px solid #F3F4F6' }} />}
              <div style={{ display: 'flex', gap: 8 }}>
                <input ref={bannerRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBannerFile} />
                <button onClick={() => bannerRef.current?.click()} style={{ height: 32, padding: '0 12px', fontSize: 12, border: '1px solid #E5E7EB', borderRadius: 7, background: 'white', cursor: 'pointer', color: '#374151' }}>{t('common.upload')}</button>
                {bannerUrl && <button onClick={() => setBannerUrl(null)} style={{ height: 32, padding: '0 12px', fontSize: 12, border: '1px solid #E5E7EB', borderRadius: 7, background: 'white', cursor: 'pointer', color: '#374151' }}>{t('common.remove')}</button>}
              </div>
            </div>
          </Row>
          <Row label={t('company.industry')}><Select value={form.company_industry} onChange={v => set('company_industry', v)} options={INDUSTRIES} /></Row>
          <Row label={t('company.country')}><Select value={form.company_country} onChange={v => set('company_country', v)} options={COUNTRIES} /></Row>

          <Row label={t('company.street')}><Input value={form.company_street} onChange={v => set('company_street', v)} placeholder={t('company.streetPlaceholder')} /></Row>
          <Row label={t('company.houseNumber')}>
            <div style={{ display: 'flex', gap: 12 }}>
              <Input value={form.company_house_number} onChange={v => set('company_house_number', v)} placeholder="28" style={{ maxWidth: 170 }} />
              <Input value={form.company_house_number_suffix} onChange={v => set('company_house_number_suffix', v)} placeholder={t('company.houseNumberSuffix')} style={{ maxWidth: 170 }} />
            </div>
          </Row>
          <Row label={t('company.address2')}><Input value={form.company_address2} onChange={v => set('company_address2', v)} /></Row>
          <Row label={t('company.postcode')}><Input value={form.company_postcode} onChange={v => set('company_postcode', v)} placeholder="1234 AB" /></Row>
          <Row label={t('company.city')}><Input value={form.company_city} onChange={v => set('company_city', v)} placeholder={t('company.cityPlaceholder')} /></Row>
          <Row label={t('company.province')}><Input value={form.company_province} onChange={v => set('company_province', v)} placeholder={t('company.province')} /></Row>
          <Row label={t('company.language')}><Select value={form.company_language} onChange={v => set('company_language', v)} options={LANGUAGES} /></Row>
          <Row label={t('company.currency')}><Select value={form.company_currency} onChange={v => set('company_currency', v)} options={CURRENCIES} /></Row>
          <Row label={t('company.timezone')}><Select value={form.company_timezone} onChange={v => set('company_timezone', v)} options={TIMEZONES} /></Row>
        </div>
      )}
    </div>
  )
}
