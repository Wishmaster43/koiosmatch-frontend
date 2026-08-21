/**
 * CvHtmlPreview — the live A4 mock of the generated CV shown next to the CV
 * template form. It owns ONLY the document rendering (print palette, sidebar/main
 * layout, per-section content) and takes the resolved settings + the candidates
 * translate fn; it is pulled out of CvTemplateSettings so the settings screen
 * stays a thin composer and this always-light document markup lives in one place.
 */
/* eslint-disable huisstijl/no-restricted-syntax, huisstijlLegacy/no-restricted-syntax -- live HTML mirror of the PDF:
   it reproduces cvStyles' hex+alpha palette byte-for-byte (react-pdf renders no
   color-mix, and the preview must match the PDF exactly), and the colours are
   guaranteed hex data — the one context where hex-suffix tints are safe. */
import { groupCvSections } from '@/pages/candidates/shared'
import { paletteFor } from '@/pages/candidates/shared'
import { PREVIEW_CANDIDATE } from './previewCandidate'

// Live HTML mock of the PDF; `t` is the candidates translate fn (cv.* labels).
// Print palette + accent defaults/presets are fixed CV data (mirrors the always-light PDF, independent of app theme) — hexes stay literal by design.
export default function CvHtmlPreview({ settings, t }) {
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

  // Light-on-colour (sidebar) vs dark-on-white (main) content palette for a
  // movable section — reuses cvStyles.paletteFor so this live preview can never
  // drift from the real generated PDF. The sidebar sits on the tenant's OWN
  // colour (color1), so its text must be luminance-derived (readableOn inside
  // paletteFor) instead of a hardcoded white — a light/yellow brand pick would
  // otherwise render unreadable here (WCAG audit 2026-08, mirrors BRAND-TEXT-COLOR-1).
  const sidebarPalette = paletteFor('sidebar', color2, color1)
  const mainPalette    = paletteFor('main', color2)
  const sideLabel = {
    fontSize: 7, fontWeight: 700, color: sidebarPalette.text, textTransform: 'uppercase',
    letterSpacing: '1.4px', marginBottom: 7, opacity: 0.85,
  }

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
