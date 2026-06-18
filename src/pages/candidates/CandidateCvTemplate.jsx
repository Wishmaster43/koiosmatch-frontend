import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'

// Locale-aware "mmm yyyy". The drawer passes the active language's locale so a
// generated CV matches the user's language; falls back to Dutch.
function fmtDate(d, locale = 'nl-NL') {
  if (!d) return ''
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return String(d)
  return dt.toLocaleDateString(locale, { month: 'short', year: 'numeric' })
}

function makeStyles(color, color2) {
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
}

function SideSection({ label, first, S, children }) {
  return (
    <View style={S.sideBlock}>
      <Text style={first ? S.sideLabelFirst : S.sideLabel}>{label}</Text>
      {children}
    </View>
  )
}

function MainSection({ label, S, children }) {
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
const CV_NL = {
  contact: 'Contact', languages: 'Talen', skills: 'Vaardigheden', certificates: 'Certificaten',
  experience: 'Werkervaring', education: 'Opleiding', preferences: 'Voorkeuren',
  email: 'E-mail', phone: 'Tel.', residence: 'Woonplaats', born: 'Geboren', nationality: 'Nationaliteit',
  present: 'heden', nameFallback: 'Naam', madeBy: 'Opgemaakt door {{company}}', madeVia: 'Opgemaakt via KoiosMatch',
}

// Minimal {{var}} interpolation for the Dutch fallback (i18next handles it when `t` is set).
const interp = (str, opts = {}) => str.replace(/\{\{(\w+)\}\}/g, (_, k) => opts[k] ?? '')

export function CvDocument({ c, settings = {}, locale = 'nl-NL', t }) {
  const color  = settings.primaryColor   ?? '#19A5CA'
  const color2 = settings.secondaryColor ?? '#1B60A9'
  const S = makeStyles(color, color2)
  const fmt = (d) => fmtDate(d, locale)
  const L = (k, opts) => (t ? t(`cv.${k}`, opts) : interp(CV_NL[k] ?? k, opts))

  const secs    = settings.sections ?? []
  const enabled = (id) => secs.length === 0 || (secs.find(s => s.id === id)?.enabled !== false)

  const name  = c?.name ?? [c?.firstName, c?.middleName, c?.lastName].filter(Boolean).join(' ') ?? L('nameFallback')
  const title = c?.title ?? c?.function ?? ''

  const contact = [
    c?.email       && [L('email'),       c.email],
    c?.phone       && [L('phone'),       c.phone],
    c?.address     && [L('residence'),   c.address],
    c?.dob         && [L('born'),        fmt(c.dob)],
    c?.nationality && [L('nationality'), c.nationality],
  ].filter(Boolean)

  const experiences  = c?.experiences  ?? []
  const educations   = c?.educations   ?? []
  const languages    = c?.languages    ?? []
  const skills       = c?.skills       ?? []
  const certs        = c?.certs        ?? c?.certifications ?? []
  const photoSrc     = c?.photoUrl ?? c?.photo_url ?? c?.photo ?? null
  const logoSrc      = settings.logoUrl ?? null

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

          {/* Sidebar */}
          <View style={S.sidebar}>
            {photoSrc
              ? <Image src={photoSrc} style={S.photo} />
              : <View style={S.photoPlaceholder} />}

            {enabled('contact') && contact.length > 0 && (
              <SideSection label={L('contact')} first S={S}>
                {contact.map(([k, v]) => (
                  <View key={k} style={S.contactGroup}>
                    <Text style={S.contactSubLabel}>{k}</Text>
                    <Text style={S.contactVal}>{v}</Text>
                  </View>
                ))}
              </SideSection>
            )}

            {enabled('languages') && languages.length > 0 && (
              <SideSection label={L('languages')} S={S}>
                {languages.map((lang, i) => {
                  const langName = lang?.language ?? lang?.name ?? String(lang)
                  const level    = lang?.level ?? lang?.spoken ?? ''
                  return (
                    <View key={i} style={S.langRow}>
                      <Text style={S.langName}>{langName}</Text>
                      {level ? <Text style={S.langLevel}>{level}</Text> : null}
                    </View>
                  )
                })}
              </SideSection>
            )}

            {enabled('skills') && skills.length > 0 && (
              <SideSection label={L('skills')} S={S}>
                <View style={S.tagRow}>
                  {skills.map((v, i) => (
                    <Text key={i} style={S.tag}>{v?.name ?? String(v)}</Text>
                  ))}
                </View>
              </SideSection>
            )}

            {enabled('certificates') && certs.length > 0 && (
              <SideSection label={L('certificates')} S={S}>
                {certs.map((cert, i) => (
                  <View key={i} style={S.certRow}>
                    <Text style={S.certBullet}>▸</Text>
                    <Text style={S.certText}>{cert?.name ?? String(cert)}</Text>
                  </View>
                ))}
              </SideSection>
            )}
          </View>

          {/* Main */}
          <View style={S.main}>

            {enabled('experience') && experiences.length > 0 && (
              <MainSection label={L('experience')} S={S}>
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
            )}

            {enabled('education') && educations.length > 0 && (
              <MainSection label={L('education')} S={S}>
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
            )}

            {enabled('preferences') && (c?.preferredFunctions?.length > 0 || c?.shiftType?.length > 0) && (
              <MainSection label={L('preferences')} S={S}>
                {c?.preferredFunctions?.length > 0 && (
                  <View style={{ marginBottom: 6 }}>
                    <View style={S.tagRow}>
                      {c.preferredFunctions.map((f, i) => <Text key={i} style={S.tag}>{f}</Text>)}
                    </View>
                  </View>
                )}
                {c?.shiftType?.length > 0 && (
                  <View style={S.tagRow}>
                    {c.shiftType.map((d, i) => <Text key={i} style={S.tag}>{d}</Text>)}
                  </View>
                )}
              </MainSection>
            )}
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
