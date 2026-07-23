/**
 * CvTemplateSettings — configure the generated CV (accent colours + section
 * visibility/order) with a live A4 preview. The PDF + preview reuse the candidate
 * CV translations (candidates:cv.*); this section's own UI uses settings:cvTemplate.*.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, RotateCcw, ToggleLeft, ToggleRight, ChevronUp, ChevronDown } from 'lucide-react'
import { pdf } from '@react-pdf/renderer'
import { CvDocument } from '@/pages/candidates/CandidateCvTemplate'
import { useCvSettings } from '@/lib/useCvSettings'
import { useLocale } from '@/lib/datetime'
import { loadSettings } from '../lib/settingsApi'

const PREVIEW_CANDIDATE = {
  name: 'Anouk de Vries',
  title: 'Verzorgende IG',
  email: 'anouk.devries@email.nl',
  phone: '06 12 34 56 78',
  address: 'Amsterdam',
  dob: '1990-03-15',
  nationality: 'Nederlands',
  summary: 'Enthousiaste zorgprofessional met 8 jaar ervaring in de ouderenzorg en thuiszorg. Betrouwbaar, klantgericht en flexibel inzetbaar.',
  experiences: [
    { title: 'Verzorgende IG', company: 'Thuiszorg Noord', start_date: '2020-01-01', description: 'Zelfstandige thuiszorgverlening, medicijnbeheer en rapportage.' },
    { title: 'Helpende Plus',  company: 'Zorggroep West',  start_date: '2017-03-01', end_date: '2019-12-31' },
  ],
  educations: [
    { title: 'MBO Verpleging & Verzorging niveau 3', school: 'ROC Amsterdam', start_year: 2015, end_year: 2017 },
    { title: 'VMBO Zorg & Welzijn',                  school: 'Pieter Nieuwland College', start_year: 2011, end_year: 2015 },
  ],
  languages: [{ language: 'Nederlands', level: 'Moedertaal' }, { language: 'Engels', level: 'B2' }],
  skills:    [{ name: 'Medicijnbeheer' }, { name: 'Rapportage' }, { name: 'Tilhulpmiddelen' }, { name: 'BHV' }],
  certs:     [{ name: 'BIG-registratie' }, { name: 'VCA Basis' }],
}

// Live HTML mock of the PDF; `t` is the candidates translate fn (cv.* labels).
// Print palette + accent defaults/presets are fixed CV data (mirrors the always-light PDF, independent of app theme) — hexes stay literal by design.
function CvHtmlPreview({ settings, t }) {
  /* eslint-disable no-restricted-syntax -- DATA/fixed template design: this whole preview renders the always-light CV/PDF export
     (accent-colour defaults mirror the brand tokens; the rest is the document's own fixed print palette), so it must render
     identically regardless of the recruiter's own app light/dark theme — it intentionally does not follow --text/--color-* tokens. */
  const color1  = settings.primaryColor   ?? '#19A5CA'
  const color2  = settings.secondaryColor ?? '#1B60A9'
  const c       = PREVIEW_CANDIDATE
  const secs    = settings.sections ?? []
  const enabled = (id) => secs.length === 0 || (secs.find(s => s.id === id)?.enabled !== false)

  const A4_W = 794
  const A4_H = 1123
  const scale = 0.70

  const sideLabel = {
    fontSize: 7, fontWeight: 700, color: '#fff', textTransform: 'uppercase',
    letterSpacing: '1.4px', marginBottom: 7, opacity: 0.85,
  }

  return (
    <div style={{ width: A4_W * scale, height: A4_H * scale, overflow: 'hidden', borderRadius: 8, boxShadow: '0 4px 24px rgba(0,0,0,0.18)', flexShrink: 0 }}>
      <div style={{ width: A4_W, height: A4_H, transform: `scale(${scale})`, transformOrigin: 'top left', fontFamily: "'Helvetica Neue', Arial, sans-serif", color: '#1F2937', background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Top accent bar — colour 1 left, colour 2 right */}
        <div style={{ height: 6, background: `linear-gradient(90deg, ${color1}, ${color2})`, flexShrink: 0 }} />

        {/* Header */}
        <div style={{ padding: '28px 40px 22px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0, borderBottom: `2px solid ${color2}20` }}>
          <div style={{ flex: 1, minWidth: 0, marginRight: settings.logoUrl || settings.companyName ? 20 : 0 }}>
            <div style={{ fontSize: 30, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.5px', marginBottom: 4, lineHeight: 1.1 }}>{c.name}</div>
            <div style={{ fontSize: 13, color: color2, fontWeight: 600, letterSpacing: '0.2px', marginBottom: enabled('summary') && c.summary ? 10 : 0 }}>{c.title}</div>
            {enabled('summary') && c.summary && (
              <div style={{ fontSize: 9.5, color: '#64748B', lineHeight: 1.65, maxWidth: 420, borderLeft: `3px solid ${color2}`, paddingLeft: 10 }}>{c.summary}</div>
            )}
          </div>
          {settings.logoUrl
            ? <img src={settings.logoUrl} style={{ height: 40, objectFit: 'contain', flexShrink: 0 }} alt="logo" />
            : settings.companyName
              ? <div style={{ fontSize: 14, fontWeight: 800, color: color2, flexShrink: 0 }}>{settings.companyName}</div>
              : null}
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* Sidebar — colour 1 */}
          <div style={{ width: 196, background: color1, padding: '22px 16px 22px 22px', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>

            <div style={{ width: 78, height: 78, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', border: '2px solid rgba(255,255,255,0.35)', marginBottom: 18 }} />

            {enabled('contact') && (
              <div style={{ marginBottom: 16 }}>
                <div style={sideLabel}>{t('cv.contact')}</div>
                {[[t('cv.email'), c.email], [t('cv.phone'), c.phone], [t('cv.residence'), c.address], [t('cv.born'), '15 mrt 1990']].map(([k, v]) => (
                  <div key={k} style={{ marginBottom: 5 }}>
                    <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.6)', marginBottom: 1 }}>{k}</div>
                    <div style={{ fontSize: 8.5, color: '#fff', lineHeight: 1.3, wordBreak: 'break-all' }}>{v}</div>
                  </div>
                ))}
              </div>
            )}

            {enabled('languages') && (
              <div style={{ marginBottom: 16 }}>
                <div style={sideLabel}>{t('cv.languages')}</div>
                {c.languages.map((lang, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8.5, color: '#fff', marginBottom: 4 }}>
                    <span>{lang.language}</span>
                    <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 8 }}>{lang.level}</span>
                  </div>
                ))}
              </div>
            )}

            {enabled('skills') && (
              <div style={{ marginBottom: 16 }}>
                <div style={sideLabel}>{t('cv.skills')}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {c.skills.map((v, i) => (
                    <span key={i} style={{ fontSize: 7.5, background: 'rgba(255,255,255,0.18)', color: '#fff', padding: '2px 7px', borderRadius: 99 }}>{v.name}</span>
                  ))}
                </div>
              </div>
            )}

            {enabled('certificates') && (
              <div>
                <div style={sideLabel}>{t('cv.certificates')}</div>
                {c.certs.map((cert, i) => (
                  <div key={i} style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.85)', marginBottom: 4, display: 'flex', gap: 5 }}>
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>▸</span>{cert.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Main — colour 2 */}
          <div style={{ flex: 1, padding: '22px 36px 22px 24px', overflowY: 'hidden', display: 'flex', flexDirection: 'column', gap: 16 }}>

            {enabled('experience') && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: color2, textTransform: 'uppercase', letterSpacing: '0.8px' }}>{t('cv.experience')}</div>
                  <div style={{ flex: 1, height: 1, background: `${color2}25` }} />
                </div>
                {c.experiences.map((e, i) => (
                  <div key={i} style={{ marginBottom: 12, paddingLeft: 10, borderLeft: `2px solid ${color2}30` }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#0F172A', marginBottom: 1 }}>{e.title}</div>
                    <div style={{ fontSize: 9.5, color: color2, fontWeight: 500, marginBottom: 2 }}>{e.company}</div>
                    <div style={{ fontSize: 8, color: '#94A3B8', marginBottom: e.description ? 4 : 0 }}>jan {i === 0 ? '2020' : '2017'} – {i === 0 ? 'present' : 'dec 2019'}</div>
                    {e.description && <div style={{ fontSize: 9, color: '#475569', lineHeight: 1.6 }}>{e.description}</div>}
                  </div>
                ))}
              </div>
            )}

            {enabled('education') && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: color2, textTransform: 'uppercase', letterSpacing: '0.8px' }}>{t('cv.education')}</div>
                  <div style={{ flex: 1, height: 1, background: `${color2}25` }} />
                </div>
                {c.educations.map((o, i) => (
                  <div key={i} style={{ marginBottom: 10, paddingLeft: 10, borderLeft: `2px solid ${color2}30` }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#0F172A', marginBottom: 1 }}>{o.title}</div>
                    <div style={{ fontSize: 9.5, color: color2, fontWeight: 500, marginBottom: 2 }}>{o.school}</div>
                    <div style={{ fontSize: 8, color: '#94A3B8' }}>{o.start_year} – {o.end_year}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '8px 40px', borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', flexShrink: 0, background: '#FAFAFA' }}>
          <span style={{ fontSize: 7.5, color: '#CBD5E1' }}>{t('cv.madeVia')}</span>
          <span style={{ fontSize: 7.5, color: '#CBD5E1' }}>1 / 1</span>
        </div>
      </div>
    </div>
  )
  /* eslint-enable no-restricted-syntax */
}

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

  const handleSectionToggle = (id) => {
    save({ sections: settings.sections.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s) })
  }

  const handleSectionMove = (id, dir) => {
    const arr = [...settings.sections]
    const idx = arr.findIndex(s => s.id === id)
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= arr.length) return;
    [arr[idx], arr[swapIdx]] = [arr[swapIdx], arr[idx]]
    save({ sections: arr })
  }

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
    <div style={{ padding: '28px 32px', maxWidth: 1100 }}>
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

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 40, alignItems: 'start' }}>

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

          {/* Sections */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px', background: 'var(--surface)' }}>
            <label style={labelStyle}>{t('cvTemplate.sections')}</label>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>{t('cvTemplate.sectionsHint')}</p>
            {settings.sections.map((sec, idx) => (
              <div key={sec.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0',
                borderBottom: idx < settings.sections.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <button onClick={() => handleSectionToggle(sec.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: sec.enabled ? 'var(--color-primary)' : 'color-mix(in srgb, var(--text-muted) 55%, transparent)', flexShrink: 0 }}>
                  {sec.enabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                </button>
                <span style={{ flex: 1, fontSize: 12, color: sec.enabled ? 'var(--text)' : 'var(--text-muted)', fontWeight: sec.enabled ? 500 : 400 }}>
                  {sec.label}
                </span>
                <div style={{ display: 'flex', gap: 2 }}>
                  <button onClick={() => handleSectionMove(sec.id, -1)} disabled={idx === 0}
                    style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 4, cursor: idx === 0 ? 'not-allowed' : 'pointer',
                      padding: '2px 5px', color: idx === 0 ? 'color-mix(in srgb, var(--text-muted) 55%, transparent)' : 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                    <ChevronUp size={11} />
                  </button>
                  <button onClick={() => handleSectionMove(sec.id, 1)} disabled={idx === settings.sections.length - 1}
                    style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 4, cursor: idx === settings.sections.length - 1 ? 'not-allowed' : 'pointer',
                      padding: '2px 5px', color: idx === settings.sections.length - 1 ? 'color-mix(in srgb, var(--text-muted) 55%, transparent)' : 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                    <ChevronDown size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>
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
