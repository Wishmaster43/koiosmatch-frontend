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
import { PREVIEW_CANDIDATE } from './cvTemplate/previewCandidate'
import CvHtmlPreview from './cvTemplate/CvHtmlPreview'
import CvSectionList from './cvTemplate/CvSectionList'

export default function CvTemplateSettings() {
  const { settings, save, reset } = useCvSettings()
  const { t } = useTranslation('settings')
  const { t: tCv } = useTranslation('candidates')
  const locale = useLocale()
  const [generating,   setGenerating]   = useState(false)
  const [brandLogoUrl, setBrandLogoUrl] = useState(null)
  const [brandName,    setBrandName]    = useState('')

  // Pull logo and company name from Brand settings.
  useEffect(() => {
    loadSettings()
      .then(s => {
        if (s.logo_url)      setBrandLogoUrl(s.logo_url)
        if (s.company_name)  setBrandName(s.company_name)
      })
      .catch(() => {})
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

  const fieldStyle = {
    width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid var(--border)',
    borderRadius: 6, background: 'var(--bg)', color: 'var(--text)', boxSizing: 'border-box',
  }
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

      <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 32, alignItems: 'start' }}>

        {/* Form panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Colours */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px', background: 'var(--surface)' }}>
            <label style={labelStyle}>{t('cvTemplate.accentColors')}</label>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>{t('cvTemplate.accentColorsHint')}</p>

            {[
              { key: 'primaryColor',   label: t('cvTemplate.color1') },
              { key: 'secondaryColor', label: t('cvTemplate.color2') },
            ].map(({ key, label }) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 7 }}>{label}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  {/* eslint-disable-next-line no-restricted-syntax -- DATA: default accent-colour value mirroring the brand primary token, not UI chrome */}
                  <input type="color" value={settings[key] ?? '#19A5CA'} onChange={e => save({ [key]: e.target.value })}
                    style={{ width: 34, height: 34, border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer', padding: 2, flexShrink: 0 }} />
                  <input type="text" value={settings[key] ?? ''} onChange={e => /^#[0-9A-Fa-f]{0,6}$/.test(e.target.value) && save({ [key]: e.target.value })}
                    style={{ ...fieldStyle, width: 96, fontFamily: 'monospace', fontSize: 12 }} />
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {/* eslint-disable-next-line no-restricted-syntax -- DATA: fixed swatch palette offered for the CV template accent colour */}
                  {['#19A5CA','#1B60A9','#F0AB00','#10B981','#EF4444','#8B5CF6','#F97316','#1F2937'].map(col => (
                    <button key={col} onClick={() => save({ [key]: col })}
                      style={{ width: 22, height: 22, borderRadius: '50%', background: col, border: settings[key] === col ? '3px solid var(--text)' : '2px solid transparent', cursor: 'pointer', flexShrink: 0 }} />
                  ))}
                </div>
              </div>
            ))}
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
