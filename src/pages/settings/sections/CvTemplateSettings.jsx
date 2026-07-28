/**
 * CvTemplateSettings — configure the generated CV (accent colours + section
 * visibility/order) with a live A4 preview. The PDF + preview reuse the candidate
 * CV translations (candidates:cv.*); this section's own UI uses settings:cvTemplate.*.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, RotateCcw, ChevronUp, ChevronDown } from 'lucide-react'
import { pdf } from '@react-pdf/renderer'
import { CvDocument, groupCvSections } from '@/pages/candidates/CandidateCvTemplate'
import { useCvSettings, CV_MOVABLE_SECTION_IDS } from '@/lib/useCvSettings'
import { useLocale } from '@/lib/datetime'
import { loadSettings } from '../lib/settingsApi'
import { Toggle } from '../components/SettingsKit'

const PREVIEW_CANDIDATE = {
  name: 'Anouk de Vries',
  title: 'Verzorgende IG',
  email: 'anouk.devries@email.nl',
  phone: '06 12 34 56 78',
  address: 'Amsterdam',
  dob: '1990-03-15',
  nationality: 'Nederlands',
  summary: 'Enthousiaste zorgprofessional met 8 jaar ervaring in de ouderenzorg en thuiszorg. Betrouwbaar, klantgericht en flexibel inzetbaar.',
  // Sample data for the 'preferences' section — off by default, but a tenant
  // can enable + relocate it, so the preview needs something to actually show.
  preferredFunctions: ['Dagdienst', 'Avonddienst'],
  shiftType: ['Flexibel inzetbaar'],
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
  // The SAME grouping the generated PDF uses (CandidateCvTemplate.groupCvSections) —
  // so this preview and the real download can never disagree on layout.
  const groups = groupCvSections(secs)

  const A4_W = 794
  const A4_H = 1123
  const scale = 0.70

  const sideLabel = {
    fontSize: 7, fontWeight: 700, color: '#fff', textTransform: 'uppercase',
    letterSpacing: '1.4px', marginBottom: 7, opacity: 0.85,
  }
  // Light-on-colour (sidebar) vs dark-on-white (main) content palette for a
  // movable section — mirrors CandidateCvTemplate's paletteFor exactly.
  const sidebarPalette = { label: 'rgba(255,255,255,0.6)', text: '#fff', chipBg: 'rgba(255,255,255,0.18)', chipText: '#fff', bulletColor: 'rgba(255,255,255,0.5)' }
  const mainPalette    = { label: '#94A3B8', text: '#334155', chipBg: `${color2}14`, chipText: color2, bulletColor: color2 }

  // Renders one MOVABLE section's content for the given palette — same ids as
  // the PDF's renderMovableContent, plain HTML instead of react-pdf primitives.
  const renderContent = (id, palette) => {
    switch (id) {
      case 'contact':
        return [[t('cv.email'), c.email], [t('cv.phone'), c.phone], [t('cv.residence'), c.address], [t('cv.born'), '15 mrt 1990']].map(([k, v]) => (
          <div key={k} style={{ marginBottom: 5 }}>
            <div style={{ fontSize: 7, color: palette.label, marginBottom: 1 }}>{k}</div>
            <div style={{ fontSize: 8.5, color: palette.text, lineHeight: 1.3, wordBreak: 'break-all' }}>{v}</div>
          </div>
        ))
      case 'languages':
        return c.languages.map((lang, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8.5, color: palette.text, marginBottom: 4 }}>
            <span>{lang.language}</span>
            <span style={{ color: palette.label, fontSize: 8 }}>{lang.level}</span>
          </div>
        ))
      case 'skills':
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {c.skills.map((v, i) => (
              <span key={i} style={{ fontSize: 7.5, background: palette.chipBg, color: palette.chipText, padding: '2px 7px', borderRadius: 99 }}>{v.name}</span>
            ))}
          </div>
        )
      case 'certificates':
        return c.certs.map((cert, i) => (
          <div key={i} style={{ fontSize: 8.5, color: palette.text, marginBottom: 4, display: 'flex', gap: 5 }}>
            <span style={{ color: palette.bulletColor }}>▸</span>{cert.name}
          </div>
        ))
      case 'preferences': {
        const tags = [...(c.preferredFunctions ?? []), ...(c.shiftType ?? [])]
        if (tags.length === 0) return null
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {tags.map((v, i) => <span key={i} style={{ fontSize: 7.5, background: palette.chipBg, color: palette.chipText, padding: '2px 7px', borderRadius: 99 }}>{v}</span>)}
          </div>
        )
      }
      default:
        return null
    }
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

          {/* Sidebar — colour 1; which movable sections land here (+ order) is tenant-configured */}
          <div data-testid="cv-preview-sidebar" style={{ width: 196, background: color1, padding: '22px 16px 22px 22px', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>

            <div style={{ width: 78, height: 78, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', border: '2px solid rgba(255,255,255,0.35)', marginBottom: 18 }} />

            {groups.sidebar.map(id => {
              const content = renderContent(id, sidebarPalette)
              if (!content) return null
              return (
                <div key={id} style={{ marginBottom: 16 }}>
                  <div style={sideLabel}>{t(`cv.${id}`)}</div>
                  {content}
                </div>
              )
            })}
          </div>

          {/* Main — colour 2; experience/education always render here, movable
              sections a tenant relocated here use the shared content renderer */}
          <div data-testid="cv-preview-main" style={{ flex: 1, padding: '22px 36px 22px 24px', overflowY: 'hidden', display: 'flex', flexDirection: 'column', gap: 16 }}>

            {groups.main.map(id => {
              if (id === 'experience') {
                return (
                  <div key="experience">
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
                )
              }
              if (id === 'education') {
                return (
                  <div key="education">
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
                )
              }
              const content = renderContent(id, mainPalette)
              if (!content) return null
              return (
                <div key={id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: color2, textTransform: 'uppercase', letterSpacing: '0.8px' }}>{t(`cv.${id}`)}</div>
                    <div style={{ flex: 1, height: 1, background: `${color2}25` }} />
                  </div>
                  {content}
                </div>
              )
            })}
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

// Two-button region switch for a MOVABLE section (Danny 28-07: "ik wil ook de
// locatie van elke sectie kunnen bepalen") — soft-tint per §4: both options
// stay tinted, the active one gets the stronger tint + weight 600.
function RegionToggle({ value, onChange, sectionLabel, t }) {
  const options = [
    { key: 'sidebar', label: t('cvTemplate.regionSidebar') },
    { key: 'main',    label: t('cvTemplate.regionMain') },
  ]
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {options.map(o => {
        const active = value === o.key
        return (
          <button key={o.key} type="button" onClick={() => onChange(o.key)} aria-pressed={active}
            aria-label={t('cvTemplate.moveSectionToRegion', { section: sectionLabel, region: o.label })}
            style={{
              padding: '3px 9px', fontSize: 10.5, fontWeight: active ? 600 : 500, borderRadius: 999, cursor: 'pointer',
              border: `1px solid color-mix(in srgb, var(--color-primary) ${active ? 45 : 20}%, transparent)`,
              background: `color-mix(in srgb, var(--color-primary) ${active ? 14 : 6}%, transparent)`,
              color: active ? 'var(--color-primary)' : 'var(--text-muted)',
            }}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
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

  // Sidebar and main column reorder independently (they render as two separate
  // lists, §CV placement) — so "up"/"down" only swaps within sections sharing
  // the same resolved placement, never jumping a section into the other region.
  const handleSectionMove = (id, dir) => {
    const arr = [...settings.sections]
    const target = arr.find(s => s.id === id)
    if (!target) return
    const groupIdx = arr.reduce((acc, s, i) => (s.placement === target.placement ? [...acc, i] : acc), [])
    const posInGroup = groupIdx.indexOf(arr.indexOf(target))
    const swapPos = posInGroup + dir
    if (swapPos < 0 || swapPos >= groupIdx.length) return
    const i1 = groupIdx[posInGroup]
    const i2 = groupIdx[swapPos]
    ;[arr[i1], arr[i2]] = [arr[i2], arr[i1]]
    save({ sections: arr })
  }

  // Move a MOVABLE section to the other CV region (sidebar ⇄ main column,
  // Danny 28-07: "ik wil ook de locatie van elke sectie kunnen bepalen"); it
  // lands wherever its stored index puts it in the new region, adjustable
  // afterwards with the up/down arrows.
  const handleSectionPlacement = (id, placement) => {
    save({ sections: settings.sections.map(s => (s.id === id ? { ...s, placement } : s)) })
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

          {/* Sections — grouped by region (header/sidebar/main column) so the
              list visually mirrors the CV layout itself (§ CV placement). */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px', background: 'var(--surface)' }}>
            <label style={labelStyle}>{t('cvTemplate.sections')}</label>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>{t('cvTemplate.sectionsHint')}</p>
            {[
              { region: 'header',  items: settings.sections.filter(s => s.placement === 'header') },
              { region: 'sidebar', items: settings.sections.filter(s => s.placement === 'sidebar') },
              { region: 'main',    items: settings.sections.filter(s => s.placement === 'main') },
            ].map(({ region, items }) => items.length > 0 && (
              <div key={region} data-testid={`cv-section-group-${region}`} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                  {t(`cvTemplate.region${region === 'sidebar' ? 'Sidebar' : region === 'main' ? 'Main' : 'Header'}`)}
                </div>
                {items.map((sec, idx, arr) => {
                  // The section's display name is ALWAYS resolved by id through i18n
                  // (never the raw stored `label`) — a tenant may still have a blob
                  // saved with the old hardcoded English label; that string is only
                  // ever used as the i18next defaultValue fallback, never displayed
                  // directly (§5 i18n fix, "profile text" → "Profieltekst").
                  const label = tCv(`cv.${sec.id}`, { defaultValue: sec.label })
                  const movable = CV_MOVABLE_SECTION_IDS.includes(sec.id)
                  return (
                    <div key={sec.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0',
                      borderBottom: idx < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      {/* Shared house Toggle (Danny 28-07: "GEEN VINKJES MAAR TOGGLES!!!") — replaces the
                          hand-rolled ToggleLeft/ToggleRight icon button so every on/off control looks the same. */}
                      <Toggle checked={sec.enabled} ariaLabel={label} onChange={() => handleSectionToggle(sec.id)} />
                      <span style={{ flex: 1, fontSize: 12, color: sec.enabled ? 'var(--text)' : 'var(--text-muted)', fontWeight: sec.enabled ? 500 : 400 }}>
                        {label}
                      </span>
                      {movable ? (
                        <RegionToggle value={sec.placement} onChange={p => handleSectionPlacement(sec.id, p)} sectionLabel={label} t={t} />
                      ) : (
                        // Structural placement (§ CV_FIXED_PLACEMENT): no picker offered —
                        // moving it would either not exist as a region (header) or break
                        // the layout (a long list squeezed into the narrow sidebar).
                        <span title={t(sec.placement === 'header' ? 'cvTemplate.regionHeaderHint' : 'cvTemplate.regionFixedMainHint')}
                          style={{ fontSize: 10, color: 'var(--text-muted)', padding: '3px 8px' }}>
                          {t(`cvTemplate.region${sec.placement === 'header' ? 'Header' : 'Main'}`)}
                        </span>
                      )}
                      {region === 'header' ? (
                        <div style={{ width: 44 }} />
                      ) : (
                        <div style={{ display: 'flex', gap: 2 }}>
                          <button onClick={() => handleSectionMove(sec.id, -1)} disabled={idx === 0}
                            aria-label={t('cvTemplate.moveSectionUp', { section: label })}
                            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 4, cursor: idx === 0 ? 'not-allowed' : 'pointer',
                              padding: '2px 5px', color: idx === 0 ? 'color-mix(in srgb, var(--text-muted) 55%, transparent)' : 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                            <ChevronUp size={11} />
                          </button>
                          <button onClick={() => handleSectionMove(sec.id, 1)} disabled={idx === arr.length - 1}
                            aria-label={t('cvTemplate.moveSectionDown', { section: label })}
                            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 4, cursor: idx === arr.length - 1 ? 'not-allowed' : 'pointer',
                              padding: '2px 5px', color: idx === arr.length - 1 ? 'color-mix(in srgb, var(--text-muted) 55%, transparent)' : 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                            <ChevronDown size={11} />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
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
