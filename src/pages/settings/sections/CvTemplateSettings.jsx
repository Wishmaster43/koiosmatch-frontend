/**
 * CvTemplateSettings — configure the generated CV (accent colours + section
 * visibility/order) with a live A4 preview. The PDF + preview reuse the candidate
 * CV translations (candidates:cv.*); this section's own UI uses settings:cvTemplate.*.
 *
 * Thin composer: the section list lives in cvTemplate/CvSectionList, the A4 mock in
 * cvTemplate/CvHtmlPreview, the sample person in cvTemplate/previewCandidate.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, RotateCcw } from 'lucide-react'
import { pdf } from '@react-pdf/renderer'
import { CvDocument } from '@/pages/candidates/CandidateCvTemplate'
import { useCvSettings } from '@/lib/useCvSettings'
import { useLocale } from '@/lib/datetime'
import { loadSettings } from '../lib/settingsApi'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'
import { PREVIEW_CANDIDATE } from './cvTemplate/previewCandidate'
import CvHtmlPreview from './cvTemplate/CvHtmlPreview'
import CvSectionList from './cvTemplate/CvSectionList'

export default function CvTemplateSettings() {
  const { settings, save, reset } = useCvSettings()
  const { t } = useTranslation('settings')
  const { t: tCv } = useTranslation('candidates')
  // Generic, already-translated fallback (all five locales) — reused here so a
  // failed brand load gets a real notice without inventing section-specific copy.
  const { t: tCommon } = useTranslation('common')
  const locale = useLocale()
  const [generating,   setGenerating]   = useState(false)
  const [brandLogoUrl, setBrandLogoUrl] = useState(null)
  const [brandName,    setBrandName]    = useState('')
  const [brandLoadError, setBrandLoadError] = useState(false)
  // Local text drafts for the two hex inputs: lets the user type freely (no
  // caret fighting) while only PERSISTING a syntactically complete colour —
  // resynced whenever the stored value changes from OUTSIDE this input
  // (swatch click, reset, initial load), never while the draft itself differs.
  const [hexDrafts, setHexDrafts] = useState({ primaryColor: '', secondaryColor: '' })
  useEffect(() => {
    setHexDrafts({ primaryColor: settings.primaryColor ?? '', secondaryColor: settings.secondaryColor ?? '' })
  }, [settings.primaryColor, settings.secondaryColor])

  // Pull logo and company name from Brand settings. Alive-guard (CLAUDE.md §9)
  // stops a response that resolves after unmount from writing stale state; the
  // catch now flags the failure instead of silently reading as "not configured".
  useEffect(() => {
    let alive = true
    loadSettings()
      .then(s => {
        if (!alive) return
        if (s.logo_url)     setBrandLogoUrl(s.logo_url)
        if (s.company_name) setBrandName(s.company_name)
      })
      .catch(() => { if (alive) setBrandLoadError(true) })
    return () => { alive = false }
  }, [])

  const settingsWithBrand = { ...settings, logoUrl: brandLogoUrl, companyName: brandName }

  const handleDownloadPreview = async () => {
    setGenerating(true)
    try {
      const blob = await pdf(<CvDocument c={PREVIEW_CANDIDATE} settings={settingsWithBrand} locale={locale} t={tCv} />).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = 'CV-preview.pdf'
      document.body.appendChild(a); a.click()
      document.body.removeChild(a); URL.revokeObjectURL(url)
    } finally {
      setGenerating(false)
    }
  }

  // Canon field style (G33/fieldMetrics) — was its own padding-8/radius-6 copy.
  const fieldStyle = fieldInputStyle
  const labelStyle = { fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 5, display: 'block' }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1220 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{t('cvTemplate.title')}</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, marginBottom: 0 }}>{t('cvTemplate.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleDownloadPreview} disabled={generating}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 12, fontWeight: 500,
              border: '1px solid var(--border)', borderRadius: 7, background: 'var(--bg)', color: 'var(--text)', cursor: 'pointer' }}>
            <Download size={13} />{generating ? t('cvTemplate.generating') : t('cvTemplate.pdfPreview')}
          </button>
          <button onClick={reset}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 12, fontWeight: 500,
              border: '1px solid var(--border)', borderRadius: 7, background: 'var(--bg)', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <RotateCcw size={12} /> {t('cvTemplate.reset')}
          </button>
        </div>
      </div>

      {/* Brand load failure (logo/company name) — a generic, already-translated
          notice so this never silently reads the same as "not configured". */}
      {brandLoadError && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--color-warning-bg)',
                      fontSize: 12, color: 'var(--color-warning)', marginBottom: 16 }}>
          {tCommon('errorGeneric')}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 32, alignItems: 'start' }}>

        {/* Form panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Colours */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px', background: 'var(--surface)' }}>
            {/* Section heading, not a field label — it names the whole card, not one control */}
            <div style={labelStyle}>{t('cvTemplate.accentColors')}</div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>{t('cvTemplate.accentColorsHint')}</p>

            {[
              { key: 'primaryColor',   label: t('cvTemplate.color1') },
              { key: 'secondaryColor', label: t('cvTemplate.color2') },
            ].map(({ key, label }) => {
              const hexInputId = `cv-accent-${key}-hex`
              const draft = hexDrafts[key] ?? ''
              return (
                <div key={key} style={{ marginBottom: 14 }}>
                  <label htmlFor={hexInputId} style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 7, display: 'block' }}>{label}</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    {/* eslint-disable-next-line no-restricted-syntax -- DATA: default accent-colour value mirroring the brand primary token, not UI chrome */}
                    <input type="color" aria-label={label} value={settings[key] ?? '#19A5CA'} onChange={e => save({ [key]: e.target.value })}
                      style={{ width: 34, height: 34, border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer', padding: 2, flexShrink: 0 }} />
                    {/* Free typing is never blocked; only a syntactically complete
                        #RRGGBB value is persisted (a half-typed colour must never
                        land in the tenant settings). */}
                    <input id={hexInputId} type="text" maxLength={7} value={draft}
                      onChange={e => {
                        const value = e.target.value
                        setHexDrafts(prev => ({ ...prev, [key]: value }))
                        if (/^#[0-9A-Fa-f]{6}$/.test(value)) save({ [key]: value })
                      }}
                      style={{ ...fieldStyle, width: 96, fontFamily: 'monospace', fontSize: 12 }} />
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {/* eslint-disable-next-line no-restricted-syntax -- DATA: fixed swatch palette offered for the CV template accent colour */}
                    {['#19A5CA','#1B60A9','#F0AB00','#10B981','#EF4444','#8B5CF6','#F97316','#1F2937'].map(col => (
                      <button key={col} type="button" onClick={() => save({ [key]: col })}
                        aria-pressed={settings[key] === col} aria-label={`${label} ${col}`}
                        style={{ width: 22, height: 22, borderRadius: '50%', background: col, border: settings[key] === col ? '3px solid var(--text)' : '2px solid transparent', cursor: 'pointer', flexShrink: 0 }} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          <CvSectionList sections={settings.sections} onSave={save} />
        </div>

        {/* Preview panel */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{t('cvTemplate.preview')}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('cvTemplate.previewHint')}</span>
          </div>
          <CvHtmlPreview settings={settingsWithBrand} t={tCv} />
        </div>

      </div>
    </div>
  )
}
