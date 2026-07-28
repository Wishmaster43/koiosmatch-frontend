import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import type { ReactNode } from 'react'
import { resolveCvSectionPlacement, CV_DEFAULT_SECTIONS } from '@/lib/useCvSettings'

// Locale-aware "mmm yyyy". The drawer passes the active language's locale so a
// generated CV matches the user's language; falls back to Dutch.
function fmtDate(d?: string | number | null, locale = 'nl-NL'): string {
  if (!d) return ''
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return String(d)
  return dt.toLocaleDateString(locale, { month: 'short', year: 'numeric' })
}

function makeStyles(color: string, color2: string) {
  // PDF document colours: @react-pdf/renderer renders this StyleSheet outside the
  // DOM/CSS cascade (it produces an actual PDF file), so var(--color-*) tokens
  // cannot resolve here — these are fixed document-style constants, not UI hex.
  /* eslint-disable no-restricted-syntax -- PDF StyleSheet colours; react-pdf renders outside the CSS cascade so design tokens cannot resolve here */
  return StyleSheet.create({
    page: { fontFamily: 'Helvetica', backgroundColor: '#FFFFFF', fontSize: 10, color: '#1F2937' },

    accentBar: { height: 6, backgroundColor: color },

    header: {
      paddingTop: 26, paddingBottom: 20, paddingLeft: 40, paddingRight: 40,
      borderBottomWidth: 2, borderBottomColor: color2 + '20', borderBottomStyle: 'solid',
    },
    headerLeft: { flex: 1 },
    headerName: { fontSize: 24, fontFamily: 'Helvetica-Bold', color: '#0F172A', marginBottom: 4, letterSpacing: -0.5 },
    headerTitle: { fontSize: 11, color: color2, fontFamily: 'Helvetica-Bold', marginBottom: 8 },
    headerSummary: {
      fontSize: 9, color: '#64748B', lineHeight: 1.6,
      borderLeftWidth: 3, borderLeftColor: color2, borderLeftStyle: 'solid',
      paddingLeft: 8,
    },

    body: { flexDirection: 'row', flex: 1 },

    sidebar: { width: 176, backgroundColor: color, paddingTop: 20, paddingBottom: 20, paddingLeft: 18, paddingRight: 14 },

    photo: { width: 72, height: 72, borderRadius: 36, marginBottom: 16, objectFit: 'cover' },
    photoPlaceholder: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.2)', marginBottom: 16, borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)', borderStyle: 'solid' },

    sideLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#fff', textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 7, opacity: 0.85 },
    sideLabelFirst: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#fff', textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 7, opacity: 0.85 },

    contactGroup: { marginBottom: 5 },
    contactSubLabel: { fontSize: 7, color: 'rgba(255,255,255,0.6)', marginBottom: 1 },
    contactVal: { fontSize: 8.5, color: '#fff' },

    langRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    langName: { fontSize: 8.5, color: '#fff' },
    langLevel: { fontSize: 8, color: 'rgba(255,255,255,0.6)' },

    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
    tag: { fontSize: 7.5, color: '#fff', backgroundColor: 'rgba(255,255,255,0.18)', paddingTop: 2, paddingBottom: 2, paddingLeft: 6, paddingRight: 6, borderRadius: 99, marginRight: 3, marginBottom: 3 },

    certRow: { flexDirection: 'row', marginBottom: 4, gap: 5 },
    certBullet: { fontSize: 8.5, color: 'rgba(255,255,255,0.5)' },
    certText: { fontSize: 8.5, color: 'rgba(255,255,255,0.85)', flex: 1 },

    sideBlock: { marginBottom: 14 },

    main: { flex: 1, paddingTop: 20, paddingBottom: 20, paddingLeft: 22, paddingRight: 36 },

    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
    sectionTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: color2, textTransform: 'uppercase', letterSpacing: 0.8 },
    sectionLine: { flex: 1, height: 1, backgroundColor: color2 + '30' },

    mainBlock: { marginBottom: 14 },
    entryBlock: { marginBottom: 11, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: color2 + '35', borderLeftStyle: 'solid' },
    entryTitle: { fontSize: 10.5, fontFamily: 'Helvetica-Bold', color: '#0F172A', marginBottom: 1 },
    entryOrg: { fontSize: 9.5, color: color2, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
    entryDate: { fontSize: 8, color: '#94A3B8', marginBottom: 3 },
    entryDesc: { fontSize: 9, color: '#475569', lineHeight: 1.6 },

    footer: { position: 'absolute', bottom: 16, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#F1F5F9', borderTopStyle: 'solid', paddingTop: 6 },
    footerText: { fontSize: 7.5, color: '#CBD5E1' },
  })
  /* eslint-enable no-restricted-syntax */
}

type CvStyles = ReturnType<typeof makeStyles>
type ChildNode = ReactNode

function SideSection({ label, first, S, children }: { label: ChildNode; first?: boolean; S: CvStyles; children?: ChildNode }) {
  return (
    <View style={S.sideBlock}>
      <Text style={first ? S.sideLabelFirst : S.sideLabel}>{label}</Text>
      {children}
    </View>
  )
}

function MainSection({ label, S, children }: { label: ChildNode; S: CvStyles; children?: ChildNode }) {
  return (
    <View style={S.mainBlock}>
      <View style={S.sectionHeader}>
        <Text style={S.sectionTitle}>{label}</Text>
        <View style={S.sectionLine} />
      </View>
      {children}
    </View>
  )
}

// Dutch fallback for the section labels — used when no `t` is supplied (the PDF is
// rendered outside the React tree, so the caller passes its translate fn in).
const CV_NL: Record<string, string> = {
  contact: 'Contact', languages: 'Talen', skills: 'Vaardigheden', certificates: 'Certificaten',
  experience: 'Werkervaring', education: 'Opleiding', preferences: 'Voorkeuren',
  email: 'E-mail', phone: 'Tel.', residence: 'Woonplaats', born: 'Geboren', nationality: 'Nationaliteit',
  present: 'heden', nameFallback: 'Naam', madeBy: 'Opgemaakt door {{company}}', madeVia: 'Opgemaakt via KoiosMatch',
}

// Minimal {{var}} interpolation for the Dutch fallback (i18next handles it when `t` is set).
const interp = (str: string, opts: Record<string, unknown> = {}) => str.replace(/\{\{(\w+)\}\}/g, (_, k) => String(opts[k] ?? ''))

// The CV input is a loose candidate (mapped OR raw), with many alternate field
// names — typed permissively; the PDF reads defensively with `??` fallbacks.
interface CvExperience { title?: string; function?: string; name?: string; company?: string; employer?: string; start_date?: string; startDate?: string; start?: string; end_date?: string; endDate?: string; end?: string; description?: string; desc?: string }
interface CvEducation { title?: string; name?: string; school?: string; institution?: string; start_year?: string | number; startYear?: string | number; year?: string | number; end_year?: string | number; endYear?: string | number }
interface CvLanguage { language?: string; name?: string; level?: string; spoken?: string }
interface CvNamed { name?: string }
export interface CvCandidate {
  name?: string; firstName?: string; middleName?: string; lastName?: string
  title?: string; function?: string
  email?: string; phone?: string; address?: string; dob?: string; nationality?: string; summary?: string
  experiences?: CvExperience[]; educations?: CvEducation[]
  languages?: CvLanguage[]; skills?: CvNamed[]; certs?: CvNamed[]; certifications?: CvNamed[]
  photoUrl?: string; photo_url?: string; photo?: string
  preferredFunctions?: string[]; shiftType?: string[]
  [k: string]: unknown
}
// Exported so the proposal-CV helper (src/lib/proposalCv.tsx) can type its args
// against the same shapes without redeclaring them.
export interface CvSettings {
  primaryColor?: string; secondaryColor?: string
  // `placement` (sidebar/main) is optional so a legacy stored section (saved
  // before per-section placement existed) still type-checks — groupCvSections
  // backfills it to today's default at render time (migration safety).
  sections?: Array<{ id: string; enabled?: boolean; placement?: string }>
  logoUrl?: string | null; companyName?: string
}
export type TranslateFn = (key: string, opts?: Record<string, unknown>) => string

interface CvDocumentProps {
  c?: CvCandidate
  settings?: CvSettings
  locale?: string
  t?: TranslateFn
  // Application-proposal CV variant (Danny 25-07): when true, omit phone, e-mail,
  // home address and date of birth from the sidebar contact block. Name, photo,
  // function, summary, experience, education, skills and languages stay untouched —
  // the customer sees who they get but reaches them only through the agency.
  redactContact?: boolean
}

/**
 * Groups a tenant's configured sections into the two CV regions (sidebar/main),
 * preserving stored order and resolving placement the same way for every id —
 * this is the ONE function both the generated PDF (below) and the settings
 * screen's live preview call, so they can never disagree on layout (CvTemplateSettings
 * imports it from here rather than re-deriving its own copy).
 */
export function groupCvSections(
  sections: Array<{ id: string; enabled?: boolean; placement?: string }>,
): { sidebar: string[]; main: string[] } {
  // No configuration at all (very old callers) => show every default section,
  // matching the pre-placement "show everything" fallback.
  const base = sections.length > 0 ? sections : CV_DEFAULT_SECTIONS
  const isEnabled = (id: string) => sections.length === 0 || (sections.find(s => s.id === id)?.enabled !== false)
  const ordered = base.map(s => ({ id: s.id, placement: resolveCvSectionPlacement(s) }))
  return {
    sidebar: ordered.filter(s => s.placement === 'sidebar' && isEnabled(s.id)).map(s => s.id),
    main:    ordered.filter(s => s.placement === 'main'    && isEnabled(s.id)).map(s => s.id),
  }
}

// Colour palette for a MOVABLE section's content, keyed by the region it lands
// in: the sidebar sits on the solid accent-colour background (light text/chips),
// the main column is plain white — chips there use the house soft-chip
// convention (§4: tinted background, coloured text) so a tenant-relocated
// section always stays legible regardless of which region it ends up in.
interface Palette { label: string; text: string; chipBg: string; chipText: string; bulletColor: string }
function paletteFor(region: 'sidebar' | 'main', color2: string): Palette {
  /* eslint-disable no-restricted-syntax -- PDF palette colours; react-pdf cannot resolve var(--color-*) tokens (mirrors makeStyles above) */
  return region === 'sidebar'
    ? { label: 'rgba(255,255,255,0.6)', text: '#fff', chipBg: 'rgba(255,255,255,0.18)', chipText: '#fff', bulletColor: 'rgba(255,255,255,0.5)' }
    : { label: '#94A3B8', text: '#334155', chipBg: `${color2}14`, chipText: color2, bulletColor: color2 }
  /* eslint-enable no-restricted-syntax */
}

// Contact key/value rows — shared by whichever region the section lands in.
function renderContactRows(contact: Array<[string, string]>, palette: Palette, S: CvStyles) {
  return contact.map(([k, v]) => (
    <View key={k} style={S.contactGroup}>
      <Text style={[S.contactSubLabel, { color: palette.label }]}>{k}</Text>
      <Text style={[S.contactVal, { color: palette.text }]}>{v}</Text>
    </View>
  ))
}

// Language + level rows — shared by whichever region the section lands in.
function renderLanguageRows(languages: CvLanguage[], palette: Palette, S: CvStyles) {
  return languages.map((lang, i) => {
    const langName = lang?.language ?? lang?.name ?? String(lang)
    const level = lang?.level ?? lang?.spoken ?? ''
    return (
      <View key={i} style={S.langRow}>
        <Text style={[S.langName, { color: palette.text }]}>{langName}</Text>
        {level ? <Text style={[S.langLevel, { color: palette.label }]}>{level}</Text> : null}
      </View>
    )
  })
}

// Certificate bullet rows — shared by whichever region the section lands in.
function renderCertificateRows(certs: CvNamed[], palette: Palette, S: CvStyles) {
  return certs.map((cert, i) => (
    <View key={i} style={S.certRow}>
      <Text style={[S.certBullet, { color: palette.bulletColor }]}>▸</Text>
      <Text style={[S.certText, { color: palette.text }]}>{cert?.name ?? String(cert)}</Text>
    </View>
  ))
}

export function CvDocument({ c, settings = {}, locale = 'nl-NL', t, redactContact = false }: CvDocumentProps) {
  // Fallback brand colours (mirror --color-primary/--color-info) for tenants with
  // no CV theme configured — react-pdf cannot resolve var(--color-*) CSS tokens.
  /* eslint-disable no-restricted-syntax -- PDF fallback colours; react-pdf cannot resolve var(--color-*) tokens */
  const color  = settings.primaryColor   ?? '#19A5CA'
  const color2 = settings.secondaryColor ?? '#1B60A9'
  /* eslint-enable no-restricted-syntax */
  const S = makeStyles(color, color2)
  const fmt = (d?: string | number | null) => fmtDate(d, locale)
  const L = (k: string, opts?: Record<string, unknown>): string => (t ? t(`cv.${k}`, opts) : interp(CV_NL[k] ?? k, opts))

  const secs    = settings.sections ?? []
  const enabled = (id: string) => secs.length === 0 || (secs.find(s => s.id === id)?.enabled !== false)

  const name  = c?.name ?? [c?.firstName, c?.middleName, c?.lastName].filter(Boolean).join(' ') ?? L('nameFallback')
  const title = c?.title ?? c?.function ?? ''

  // Contact block: the proposal variant drops phone/e-mail/address/dob (the four
  // fields Danny named) while nationality — not a reach-out channel — stays; the
  // SideSection above only renders when this list is non-empty, so an all-redacted
  // candidate simply skips the block instead of showing an empty label/separator.
  const contact = [
    !redactContact && c?.email && [L('email'), c.email],
    !redactContact && c?.phone && [L('phone'), c.phone],
    !redactContact && c?.address && [L('residence'), c.address],
    !redactContact && c?.dob && [L('born'), fmt(c.dob)],
    c?.nationality && [L('nationality'), c.nationality],
  ].filter(Boolean) as Array<[string, string]>

  const experiences  = c?.experiences  ?? []
  const educations   = c?.educations   ?? []
  const languages    = c?.languages    ?? []
  const skills       = c?.skills       ?? []
  const certs        = c?.certs        ?? c?.certifications ?? []
  const photoSrc     = c?.photoUrl ?? c?.photo_url ?? c?.photo ?? null
  const logoSrc      = settings.logoUrl ?? null

  // Which movable sections render in which region, in the tenant's stored
  // order (§ CV section placement) — the same function the settings screen's
  // live preview calls, so the two can never disagree.
  const groups = groupCvSections(secs)
  const sidebarPalette = paletteFor('sidebar', color2)
  const mainPalette    = paletteFor('main', color2)

  // Renders one MOVABLE section's inner content (rows/chips), independent of
  // which region it lands in — the palette supplies light/dark colours so the
  // same content stays legible whether it sits on the tinted sidebar or the
  // white main column. `experience`/`education` are handled separately below
  // (they are pinned to the main column and use the entry-card layout).
  const renderMovableContent = (id: string, palette: Palette): ChildNode | null => {
    switch (id) {
      case 'contact':
        return contact.length > 0 ? renderContactRows(contact, palette, S) : null
      case 'languages':
        return languages.length > 0 ? renderLanguageRows(languages, palette, S) : null
      case 'skills':
        return skills.length > 0 ? (
          <View style={S.tagRow}>
            {skills.map((v, i) => (
              <Text key={i} style={[S.tag, { backgroundColor: palette.chipBg, color: palette.chipText }]}>{v?.name ?? String(v)}</Text>
            ))}
          </View>
        ) : null
      case 'certificates':
        return certs.length > 0 ? renderCertificateRows(certs, palette, S) : null
      case 'preferences': {
        const funcs = c?.preferredFunctions ?? []
        const shifts = c?.shiftType ?? []
        if (funcs.length === 0 && shifts.length === 0) return null
        return (
          <>
            {funcs.length > 0 && (
              <View style={{ marginBottom: 6 }}>
                <View style={S.tagRow}>
                  {funcs.map((f, i) => <Text key={i} style={[S.tag, { backgroundColor: palette.chipBg, color: palette.chipText }]}>{f}</Text>)}
                </View>
              </View>
            )}
            {shifts.length > 0 && (
              <View style={S.tagRow}>
                {shifts.map((d, i) => <Text key={i} style={[S.tag, { backgroundColor: palette.chipBg, color: palette.chipText }]}>{d}</Text>)}
              </View>
            )}
          </>
        )
      }
      default:
        return null
    }
  }

  return (
    <Document>
      <Page size="A4" style={S.page}>

        <View style={S.accentBar} />

        {/* Header */}
        <View style={{ ...S.header, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View style={S.headerLeft}>
            <Text style={S.headerName}>{name}</Text>
            {title ? <Text style={S.headerTitle}>{title}</Text> : null}
            {enabled('summary') && c?.summary
              ? <Text style={S.headerSummary}>{c.summary}</Text>
              : null}
          </View>
          {logoSrc
            ? <Image src={logoSrc} style={{ width: 90, height: 34, objectFit: 'contain' }} />
            : settings.companyName
              ? <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: color2 }}>{settings.companyName}</Text>
              : null}
        </View>

        {/* Body */}
        <View style={S.body}>

          {/* Sidebar — order + which movable sections land here is tenant-configured (§ CV placement) */}
          <View style={S.sidebar}>
            {photoSrc
              ? <Image src={photoSrc} style={S.photo} />
              : <View style={S.photoPlaceholder} />}

            {groups.sidebar.map((id, idx) => {
              const content = renderMovableContent(id, sidebarPalette)
              if (!content) return null
              return <SideSection key={id} label={L(id)} first={idx === 0} S={S}>{content}</SideSection>
            })}
          </View>

          {/* Main — experience/education always render here (pinned, entry-card layout);
              movable sections a tenant relocated here use the shared content renderer. */}
          <View style={S.main}>
            {groups.main.map(id => {
              if (id === 'experience') {
                if (experiences.length === 0) return null
                return (
                  <MainSection key="experience" label={L('experience')} S={S}>
                    {experiences.map((e, i) => {
                      const func = e?.title ?? e?.function ?? e?.name ?? ''
                      const org  = e?.company ?? e?.employer ?? ''
                      const van  = e?.start_date ?? e?.startDate ?? e?.start ?? ''
                      const tot  = e?.end_date   ?? e?.endDate   ?? e?.end   ?? ''
                      const desc = e?.description ?? e?.desc ?? ''
                      return (
                        <View key={i} style={S.entryBlock}>
                          {func ? <Text style={S.entryTitle}>{func}</Text> : null}
                          {org  ? <Text style={S.entryOrg}>{org}</Text>   : null}
                          {van  ? <Text style={S.entryDate}>{fmt(van)} – {tot ? fmt(tot) : L('present')}</Text> : null}
                          {desc ? <Text style={S.entryDesc}>{desc}</Text> : null}
                        </View>
                      )
                    })}
                  </MainSection>
                )
              }
              if (id === 'education') {
                if (educations.length === 0) return null
                return (
                  <MainSection key="education" label={L('education')} S={S}>
                    {educations.map((o, i) => {
                      const naam   = o?.title ?? o?.name ?? ''
                      const school = o?.school ?? o?.institution ?? ''
                      const van    = o?.start_year ?? o?.startYear ?? o?.year ?? ''
                      const tot    = o?.end_year   ?? o?.endYear   ?? ''
                      return (
                        <View key={i} style={S.entryBlock}>
                          {naam   ? <Text style={S.entryTitle}>{naam}</Text>   : null}
                          {school ? <Text style={S.entryOrg}>{school}</Text>   : null}
                          {van    ? <Text style={S.entryDate}>{String(van)}{tot ? ` – ${tot}` : ''}</Text> : null}
                        </View>
                      )
                    })}
                  </MainSection>
                )
              }
              const content = renderMovableContent(id, mainPalette)
              if (!content) return null
              return <MainSection key={id} label={L(id)} S={S}>{content}</MainSection>
            })}
          </View>
        </View>

        {/* Footer */}
        <View style={S.footer} fixed>
          <Text style={S.footerText}>
            {settings.companyName ? L('madeBy', { company: settings.companyName }) : L('madeVia')}
          </Text>
          <Text style={S.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>

      </Page>
    </Document>
  )
}
