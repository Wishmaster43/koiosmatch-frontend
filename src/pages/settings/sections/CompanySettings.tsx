/**
 * CompanySettings — the tenant's company-profile form (identity/address/
 * preferences), grouped into titled cards. Industries/countries come from
 * backend lookups; currencies/timezones stay a fixed local list (data, not
 * comments — see the constants below).
 */
import { useState, useEffect, useRef } from 'react'
import type { ReactNode, ChangeEvent, CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { loadSettings, saveSettings } from '../lib/settingsApi'
import { useIndustries } from '@/lib/useIndustries'
import { useCountriesLookup } from '@/lib/useCountriesLookup'
import { useProvinces } from '@/hooks/useProvinces'
import { useSettingsSectionState } from '@/hooks/useSettingsSectionState'
import SearchSelect from '@/components/ui/SearchSelect'
import { useLocaleOptions } from '@/lib/useLocaleOptions'
import { cardHead } from '@/components/ui/modalCards'
// One language source for the whole app (Danny 14/7): the same five shipped
// locales the profile picker offers — never a diverging local list.
import { LANGUAGES as APP_LANGUAGES } from '@/pages/auth/shared'
import { languageDisplayName } from '@/lib/languageNames'
import Button from '@/components/ui/Button'
import SaveButton from '@/components/ui/SaveButton'
import { PageTitle } from '@/components/ui/typography'
import { fieldSelectStyle, fieldInputStyle } from '@/components/forms/fieldMetrics'
import { postcodePlaceholder } from '@/lib/postcode'
import CatalogSection from './CatalogSection'
import Row from './settingsFormRow'

// Option lists (data — kept as-is; only labels are translated). Industries and
// countries are now backend-sourced (Settings → Personalisation → Industries;
// GET /countries, COUNTRY-LOOKUP-1) — never a hardcoded list of either.
// Value = locale CODE (what the setting stores and i18n understands), label =
// the language NAME (Danny 25-08: "Language must be Dutch, not nl").
const LANGUAGES = APP_LANGUAGES.map(l => ({ value: l.value, label: l.label }))
// Legacy rows stored the NAME; normalize either shape to the code.
const toLanguageCode = (v: string): string => APP_LANGUAGES.find(l => l.value === v || l.label === v)?.value ?? 'nl'
// I18N-1 lane I3 (BE 5a109b00): currency and timezone are stored as CODES
// (ISO-4217 / IANA, 422 outside the backend's closed lists) and the pickers read
// those lists from GET /settings/locale-options (useLocaleOptions). Rows saved
// before this change hold the old Dutch LABEL ('Euro (€)', 'Europa/Amsterdam');
// these two maps normalise a stored label to its code on load, so the next save
// writes the code the backend now validates.
const LEGACY_CURRENCY: Record<string, string> = { 'Euro (€)': 'EUR', 'Dollar ($)': 'USD', 'Pond (£)': 'GBP' }
const LEGACY_TIMEZONE: Record<string, string> = { 'Europa/Amsterdam': 'Europe/Amsterdam', 'Europa/Brussel': 'Europe/Brussels', 'Europa/Londen': 'Europe/London' }
const toCurrencyCode = (v: string): string => LEGACY_CURRENCY[v] ?? (v || 'EUR')
const toTimezoneCode = (v: string): string => LEGACY_TIMEZONE[v] ?? (v || 'Europe/Amsterdam')

// The card chrome this screen already used for its single form block, hoisted so
// all three blocks share one source (§11).
const GROUP_CARD = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '0 24px',
}

// One titled block of rows — the settings-wide "titled card" idiom (shared
// `cardHead` above a bordered surface, mirroring Settings → Vestigingen's
// address/contact blocks), so the three groups read as one form, not three screens.
function Group({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <section>
      <h3 style={cardHead}>{title}</h3>
      <div style={GROUP_CARD}>{children}</div>
    </section>
  )
}

// Field faces come from fieldMetrics' canon (§4 2b) — never a local copy.
const baseInput = fieldInputStyle

// Thin wrapper over the shared field style (baseInput) so a call-site can layer its
// own override on top without re-declaring the canon face.
interface InputProps {
  value: string | undefined
  onChange: (v: string) => void
  placeholder?: string
  style?: CSSProperties
}
function Input({ value, onChange, placeholder, style }: InputProps) {
  return (
    <input value={value ?? ''} onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)} placeholder={placeholder}
      style={{ ...baseInput, ...style }} />
  )
}

// Replaces the bare native <select> with the shared searchable dropdown (audit sweep) —
// same value/onChange contract as before. `options` accepts plain strings (value ===
// label, e.g. LANGUAGES/CURRENCIES/TIMEZONES) OR {value,label} pairs (e.g. the
// backend-sourced country codes) — the trigger always shows the resolved LABEL,
// never a raw stored code (the bug this replaces: a stored 'NL' rendered as literal
// "NL" because the old hardcoded list only matched on full English names).
interface SelectOption {
  value: string
  label: string
}
interface SelectProps {
  value: string | undefined
  onChange: (v: string) => void
  options: Array<string | SelectOption>
}
function Select({ value, onChange, options }: SelectProps) {
  const opts: SelectOption[] = options.map(o => (typeof o === 'string' ? { value: o, label: o } : o))
  const selectedLabel = opts.find(o => o.value === value)?.label ?? value
  return (
    <SearchSelect
      options={opts}
      selected={value ? [value] : []}
      onToggle={onChange}
      closeOnToggle
      renderTrigger={toggle => (
        // §4 2b: a dropdown TRIGGER is a FORM FIELD — its face comes from
        // fieldMetrics' select canon, never Button (Opus-controle klus d — "Opus review job d").
        <button type="button" onClick={toggle}
          // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- form-field trigger face (fieldSelectStyle canon), not an action button
          style={{ ...fieldSelectStyle, maxWidth: 360, textAlign: 'left' }}>
          {selectedLabel}
        </button>
      )}
    />
  )
}

// company_country stores the ISO-2 CODE ('NL'), matching the backend's own seed
// (DevResetCommand.php) and GET /countries — a plain English name here used to
// mismatch that seed and render as a raw unmatched value (COUNTRY-LOOKUP-1).
const EMPTY = {
  company_industry: '', company_country: 'NL',
  company_street: '', company_house_number: '', company_house_number_suffix: '',
  company_postcode: '', company_city: '', company_province: '',
  company_language: 'nl', company_currency: 'EUR', company_timezone: 'Europe/Amsterdam',
}

// Renders the company-profile form (see file docblock above) and owns its load/save state.
export default function CompanySettings() {
  const { t, i18n } = useTranslation('settings')
  // Tenant-configurable industry options for the dropdown below.
  // Options pair the STORED industry name with a translated label (LOOKUP-I18N-1).
  const { industryOptions: industries } = useIndustries()
  // Closed locale vocabularies (currency / timezone / language) as code+label pairs.
  const { options: localeOptions } = useLocaleOptions()
  const currencyOptions = localeOptions.currencies.map(o => ({ value: o.code, label: o.label }))
  const timezoneOptions = localeOptions.timezones.map(o => ({ value: o.code, label: o.label }))
  // TAAL-NAAM-1 (Danny 25-08: "Language must be Dutch, not nl"): the backend's
  // languages list labels its codes as bare codes ("EN", "DE" — measured on demo
  // 06-09), so the NAME comes from ICU in the current UI language; the backend label
  // is only the fallback when ICU does not know the code.
  const languageOptions = localeOptions.languages.length
    ? localeOptions.languages.map(o => { const name = languageDisplayName(o.code, i18n.language); return { value: o.code, label: name.toUpperCase() === o.code.toUpperCase() ? o.label : name } })
    : LANGUAGES
  // Backend-sourced operating-country codes, labelled in the current UI language.
  const { options: countryOptions } = useCountriesLookup()
  const [form,       setForm]       = useState<typeof EMPTY>(EMPTY)
  // Provinces cascade on the picked country (PROVINCES-1) — same hook the candidate
  // and vacancy address blocks use, so the tenant maintains one list.
  const { provinces } = useProvinces(form.company_country || 'NL')
  const provinceOptions = (provinces ?? []).map(p => (typeof p === 'string' ? { value: p, label: p } : p))

  const [bannerUrl,  setBannerUrl]  = useState<string | null>(null)
  const { saved, setSaved, saving, setSaving, loading, setLoading, loadError, setLoadError, reloadKey, setReloadKey } = useSettingsSectionState()
  const bannerRef = useRef<HTMLInputElement>(null)

  // Loads the saved company settings once on mount, migrating a legacy single-line
  // address into the street field and normalising the language code.
  useEffect(() => {
    setLoading(true)
    setLoadError(false)
    loadSettings().then(s => {
      setForm(f => ({
        ...f,
        company_industry: s.company_industry ?? '',
        company_country:  s.company_country  ?? 'NL',
        // Migrate legacy single-line address into the street field if needed.
        company_street:              s.company_street              ?? s.company_address1 ?? '',
        company_house_number:        s.company_house_number        ?? '',
        company_house_number_suffix: s.company_house_number_suffix ?? '',
        company_postcode: s.company_postcode ?? '',
        company_city:     s.company_city     ?? '',
        company_province: s.company_province ?? '',
        company_language: toLanguageCode(s.company_language),
        company_currency: toCurrencyCode(s.company_currency),
        company_timezone: toTimezoneCode(s.company_timezone),
      }))
      // Never trust a stored blob: URL — it only ever worked in the browser tab
      // that created it (session-local object URL) and is dead in every other
      // tab/session/user (§3: no fake affordance surviving a reload).
      if (s.company_banner_url && !String(s.company_banner_url).startsWith('blob:')) setBannerUrl(s.company_banner_url)
    }).catch(() => setLoadError(true)).finally(() => setLoading(false))
  }, [reloadKey, setLoadError, setLoading])

  const set = (k: keyof typeof EMPTY, v: string) => setForm(f => ({ ...f, [k]: v }))

  // BANNER-UPLOAD-1 (CMBE 23-07, mirrors /settings/logo): multipart POST persists
  // the private path server-side; GET /settings mints a fresh signed URL (12h TTL).
  // The response only feeds the preview — never store the signed URL in settings.
  const handleBannerFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.append('banner', file)
    try {
      // hand-written: the spec carries no 2xx schema for /settings/banner.
      const res = await api.post<{ banner_url?: string }>('/settings/banner', fd)
      if (res.data?.banner_url) setBannerUrl(res.data.banner_url)
    } catch (err) {
      // 422 = bad type/size or the SVG script-scan — show the backend's own message.
      const uploadErr = err as { response?: { data?: { message?: string } } }
      notifyError(uploadErr?.response?.data?.message ?? t('company.bannerUploadFailed'))
    } finally {
      e.target.value = ''
    }
  }

  // User pressed save: persists the form (banner URL excluded, it is backend-owned)
  // and flashes the saved state briefly for feedback.
  const save = async () => {
    setSaving(true)
    try {
      // company_banner_url is backend-owned now (BANNER-UPLOAD-1) — never sent here.
      await saveSettings({ ...form })
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } catch { notifyError(t('company.saveError')) } finally { setSaving(false) }
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <PageTitle>{t('company.title')}</PageTitle>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('company.subtitle')}</p>
        </div>
        <SaveButton onClick={save} disabled={saving} saved={saved} saving={saving} />
      </div>

      {/* Company name & logo live under Brand — kept in one place to avoid duplicates. */}
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>{t('company.managedUnder')}</p>

      {loading && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('common.loading')}</p>}

      {/* Load failure gets an honest error + retry instead of a silently blank form (§9). */}
      {!loading && loadError && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-danger-text)', fontSize: 13 }}>
            <AlertTriangle size={14} /> {t('company.loadError')}
          </div>
          <Button variant="secondary" onClick={() => setReloadKey(k => k + 1)}>
            <RefreshCw size={13} /> {t('company.retry')}
          </Button>
        </div>
      )}

      {!loading && !loadError && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 1. Identity — what the company IS, before any address detail. */}
          <Group title={t('company.sectionIdentity')}>
            <Row label={t('company.banner')}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {bannerUrl && <img src={bannerUrl} alt={t('company.banner')} style={{ width: '100%', maxWidth: 400, height: 100, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />}
                <div style={{ display: 'flex', gap: 8 }}>
                  {/* Real upload (BANNER-UPLOAD-1). No local "remove": clearing only the
                      preview would reappear on reload — a delete needs its own endpoint. */}
                  <input ref={bannerRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" style={{ display: 'none' }} onChange={handleBannerFile} />
                  <Button variant="secondary" size="sm" onClick={() => bannerRef.current?.click()}>
                    {t('common.upload')}
                  </Button>
                </div>
              </div>
            </Row>
            <Row label={t('company.industry')} last><Select value={form.company_industry} onChange={v => set('company_industry', v)} options={industries} /></Row>
          </Group>

          {/* 2. Address, in the order an address is WRITTEN (Danny 09-08): street →
              number → postcode → city → province → country. Country used to sit on
              top, split off from the block it closes, so reading the address took a
              jump. Country still feeds the province cascade below — that link runs
              through `form.company_country` state, not through JSX order, so the
              province list keeps updating from a field rendered underneath it. */}
          <Group title={t('company.sectionAddress')}>
            <Row label={t('company.street')}><Input value={form.company_street} onChange={v => set('company_street', v)} placeholder={t('company.streetPlaceholder')} /></Row>
            <Row label={t('company.houseNumber')}>
              <div style={{ display: 'flex', gap: 12 }}>
                <Input value={form.company_house_number} onChange={v => set('company_house_number', v)} placeholder="28" style={{ maxWidth: 170 }} />
                <Input value={form.company_house_number_suffix} onChange={v => set('company_house_number_suffix', v)} placeholder={t('company.houseNumberSuffix')} style={{ maxWidth: 170 }} />
              </div>
            </Row>
            <Row label={t('company.postcode')}><Input value={form.company_postcode} onChange={v => set('company_postcode', v)} placeholder={postcodePlaceholder(form.company_country, t)} /></Row>
            <Row label={t('company.city')}><Input value={form.company_city} onChange={v => set('company_city', v)} placeholder={t('company.cityPlaceholder')} /></Row>
            {/* Provincie ("Province") is a searchable dropdown like everywhere else (Danny 08-08,
                CLAUDE.md §4) — options cascade on the picked country, mirroring the
                candidate/vacancy address blocks. */}
            <Row label={t('company.province')}>
              <Select value={form.company_province} onChange={v => set('company_province', v)}
                options={provinceOptions} />
            </Row>
            <Row label={t('company.country')} last><Select value={form.company_country} onChange={v => set('company_country', v)} options={countryOptions} /></Row>
          </Group>

          {/* 3. Preferences — the tenant's locale defaults, unrelated to the address. */}
          <Group title={t('company.sectionPreferences')}>
            {/* Closed lists from the backend (codes as values, labels as shown); the
                app's own language list stays the fallback until the request lands. */}
            <Row label={t('company.language')}><Select value={form.company_language} onChange={v => set('company_language', v)} options={languageOptions} /></Row>
            <Row label={t('company.currency')}><Select value={form.company_currency} onChange={v => set('company_currency', v)} options={currencyOptions} /></Row>
            <Row label={t('company.timezone')} last><Select value={form.company_timezone} onChange={v => set('company_timezone', v)} options={timezoneOptions} /></Row>
          </Group>
        </div>
      )}
      {/* Organisation policies (MFA enforcement, …) live in their OWN sub-menu now:
          Settings → Bedrijf → Organisatiebeleid ("Company → Organisation policy")
          (Danny 23-07 — no longer crammed
          under the company-profile form). */}
      {/* CATALOG-GROUPS-1: the company section's generic catalogue rows (address, region &
          currency, billing e-mail) as titled blocks under the profile form. */}
      <div style={{ marginTop: 24 }}><CatalogSection section="company" embedded /></div>
    </div>
  )
}
