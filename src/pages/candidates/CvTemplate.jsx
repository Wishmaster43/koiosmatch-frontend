import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'

const MONTHS_NL = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']

function fmtDate(d) {
  if (!d) return ''
  const dt = new Date(d)
  if (isNaN(dt)) return String(d)
  return `${MONTHS_NL[dt.getMonth()]} ${dt.getFullYear()}`
}

function makeStyles(color) {
  const accent    = color
  const accentBg  = color + '12'
  const accentLine = color + '28'

  return StyleSheet.create({
    page: {
      fontFamily: 'Helvetica',
      backgroundColor: '#FFFFFF',
      fontSize: 10,
      color: '#1F2937',
    },
    accentBar: { height: 5, backgroundColor: accent },
    header: {
      paddingTop: 22,
      paddingBottom: 18,
      paddingLeft: 38,
      paddingRight: 38,
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      borderBottomWidth: 1,
      borderBottomColor: accentLine,
      borderBottomStyle: 'solid',
    },
    headerName: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: '#111827', marginBottom: 3 },
    headerTitle: { fontSize: 11, color: accent, fontFamily: 'Helvetica-Bold', letterSpacing: 0.3 },
    headerRight: { alignItems: 'flex-end', justifyContent: 'center' },
    logo: { width: 90, height: 34, objectFit: 'contain' },
    companyText: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: accent },
    body: { flexDirection: 'row', flex: 1 },
    sidebar: {
      width: 168,
      backgroundColor: accentBg,
      paddingTop: 18,
      paddingBottom: 18,
      paddingLeft: 20,
      paddingRight: 14,
    },
    main: {
      flex: 1,
      paddingTop: 18,
      paddingBottom: 18,
      paddingLeft: 22,
      paddingRight: 34,
    },
    photo: {
      width: 72,
      height: 72,
      borderRadius: 36,
      marginBottom: 14,
      objectFit: 'cover',
    },
    photoPlaceholder: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: color + '30',
      marginBottom: 14,
    },
    sideLabel: {
      fontSize: 7,
      fontFamily: 'Helvetica-Bold',
      color: accent,
      textTransform: 'uppercase',
      letterSpacing: 1.2,
      marginBottom: 5,
      marginTop: 12,
    },
    sideLabelFirst: {
      fontSize: 7,
      fontFamily: 'Helvetica-Bold',
      color: accent,
      textTransform: 'uppercase',
      letterSpacing: 1.2,
      marginBottom: 5,
    },
    contactRow: { flexDirection: 'row', marginBottom: 3 },
    contactKey: { fontSize: 8, color: '#6B7280', width: 46 },
    contactVal: { fontSize: 8, color: '#1F2937', flex: 1 },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap' },
    tag: {
      fontSize: 8,
      color: accent,
      backgroundColor: color + '18',
      paddingTop: 2,
      paddingBottom: 2,
      paddingLeft: 5,
      paddingRight: 5,
      borderRadius: 3,
      marginRight: 3,
      marginBottom: 3,
    },
    sideText: { fontSize: 8.5, color: '#374151', marginBottom: 3 },
    mainLabel: {
      fontSize: 10,
      fontFamily: 'Helvetica-Bold',
      color: accent,
      marginBottom: 7,
      paddingBottom: 4,
      borderBottomWidth: 1,
      borderBottomColor: accentLine,
      borderBottomStyle: 'solid',
    },
    mainBlock: { marginBottom: 14 },
    entryTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#111827', marginBottom: 2 },
    entryOrg: { fontSize: 9, color: accent, marginBottom: 2 },
    entryDate: { fontSize: 8, color: '#9CA3AF', marginBottom: 3 },
    entryDesc: { fontSize: 9, color: '#4B5563', lineHeight: 1.5 },
    bodyText: { fontSize: 9, color: '#374151', lineHeight: 1.55 },
    entryBlock: { marginBottom: 9 },
    footer: {
      position: 'absolute',
      bottom: 18,
      left: 38,
      right: 38,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    footerText: { fontSize: 7, color: '#9CA3AF' },
  })
}

function SideSection({ label, first, S, children }) {
  return (
    <View>
      <Text style={first ? S.sideLabelFirst : S.sideLabel}>{label}</Text>
      {children}
    </View>
  )
}

function MainSection({ label, S, children }) {
  return (
    <View style={S.mainBlock}>
      <Text style={S.mainLabel}>{label}</Text>
      {children}
    </View>
  )
}

export function CvDocument({ c, settings = {} }) {
  const color = settings.primaryColor ?? '#6366F1'
  const S = makeStyles(color)

  const secs    = settings.sections ?? []
  const enabled = (id) => secs.length === 0 || (secs.find(s => s.id === id)?.enabled !== false)

  const name = c?.name ?? [c?.voornaam, c?.tussenvoegsel, c?.achternaam].filter(Boolean).join(' ') ?? 'Naam'
  const title = c?.title ?? c?.functie ?? ''

  const contact = [
    c?.email       && ['E-mail',        c.email],
    c?.phone       && ['Tel.',          c.phone],
    c?.telefoon    && !c?.phone && ['Tel.', c.telefoon],
    c?.address     && ['Woonplaats',    c.address],
    c?.dob         && ['Geboren',       fmtDate(c.dob)],
    c?.nationality && ['Nationaliteit', c.nationality],
  ].filter(Boolean)

  const ervaring     = c?.ervaring     ?? []
  const opleiding    = c?.opleiding    ?? []
  const talen        = c?.talen        ?? []
  const vaardigheden = c?.vaardigheden ?? []
  const certs        = c?.certs        ?? c?.certificaten ?? []

  const photoSrc = c?.photoUrl ?? c?.photo_url ?? c?.photo ?? null
  const logoSrc  = settings.logoUrl ?? null

  return (
    <Document>
      <Page size="A4" style={S.page}>

        {/* Top accent bar */}
        <View style={S.accentBar} />

        {/* Header */}
        <View style={S.header}>
          <View>
            <Text style={S.headerName}>{name}</Text>
            {title ? <Text style={S.headerTitle}>{title}</Text> : null}
          </View>
          <View style={S.headerRight}>
            {logoSrc ? (
              <Image src={logoSrc} style={S.logo} />
            ) : settings.companyName ? (
              <Text style={S.companyText}>{settings.companyName}</Text>
            ) : null}
          </View>
        </View>

        {/* Body */}
        <View style={S.body}>

          {/* ── Sidebar ── */}
          <View style={S.sidebar}>
            {photoSrc ? (
              <Image src={photoSrc} style={S.photo} />
            ) : (
              <View style={S.photoPlaceholder} />
            )}

            {enabled('contact') && contact.length > 0 && (
              <SideSection label="Contact" first S={S}>
                {contact.map(([k, v]) => (
                  <View key={k} style={S.contactRow}>
                    <Text style={S.contactKey}>{k}</Text>
                    <Text style={S.contactVal}>{v}</Text>
                  </View>
                ))}
              </SideSection>
            )}

            {enabled('talen') && talen.length > 0 && (
              <SideSection label="Talen" S={S}>
                {talen.map((t, i) => {
                  const naam  = t?.taal ?? t?.name ?? t?.naam ?? String(t)
                  const niv   = t?.niveau ?? t?.level ?? ''
                  return (
                    <View key={i} style={S.contactRow}>
                      <Text style={S.contactVal}>{naam}</Text>
                      {niv ? <Text style={{ ...S.contactKey, textAlign: 'right' }}>{niv}</Text> : null}
                    </View>
                  )
                })}
              </SideSection>
            )}

            {enabled('vaardigheden') && vaardigheden.length > 0 && (
              <SideSection label="Vaardigheden" S={S}>
                <View style={S.tagRow}>
                  {vaardigheden.map((v, i) => (
                    <Text key={i} style={S.tag}>{v?.naam ?? v?.name ?? String(v)}</Text>
                  ))}
                </View>
              </SideSection>
            )}

            {enabled('certificaten') && certs.length > 0 && (
              <SideSection label="Certificaten" S={S}>
                {certs.map((c, i) => (
                  <Text key={i} style={S.sideText}>• {c?.naam ?? c?.name ?? String(c)}</Text>
                ))}
              </SideSection>
            )}
          </View>

          {/* ── Main ── */}
          <View style={S.main}>

            {enabled('samenvatting') && c?.summary && (
              <MainSection label="Over mij" S={S}>
                <Text style={S.bodyText}>{c.summary}</Text>
              </MainSection>
            )}

            {enabled('ervaring') && ervaring.length > 0 && (
              <MainSection label="Werkervaring" S={S}>
                {ervaring.map((e, i) => {
                  const func  = e?.functie ?? e?.title ?? e?.naam ?? e?.name ?? ''
                  const org   = e?.werkgever ?? e?.company ?? e?.bedrijf ?? e?.employer ?? ''
                  const van   = e?.start_datum ?? e?.startDate ?? e?.van ?? e?.start ?? ''
                  const tot   = e?.eind_datum  ?? e?.endDate   ?? e?.tot  ?? e?.end   ?? ''
                  const desc  = e?.beschrijving ?? e?.description ?? ''
                  return (
                    <View key={i} style={S.entryBlock}>
                      {func ? <Text style={S.entryTitle}>{func}</Text> : null}
                      {org  ? <Text style={S.entryOrg}>{org}</Text>   : null}
                      {van  ? (
                        <Text style={S.entryDate}>{fmtDate(van)} – {tot ? fmtDate(tot) : 'heden'}</Text>
                      ) : null}
                      {desc ? <Text style={S.entryDesc}>{desc}</Text> : null}
                    </View>
                  )
                })}
              </MainSection>
            )}

            {enabled('opleiding') && opleiding.length > 0 && (
              <MainSection label="Opleiding" S={S}>
                {opleiding.map((o, i) => {
                  const naam    = o?.opleiding ?? o?.name ?? o?.naam ?? o?.title ?? ''
                  const school  = o?.instelling ?? o?.school ?? o?.institution ?? ''
                  const van     = o?.start_jaar ?? o?.startYear ?? o?.jaar ?? o?.van ?? ''
                  const tot     = o?.eind_jaar  ?? o?.endYear   ?? o?.tot  ?? ''
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

            {enabled('voorkeuren') && (c?.functies_voorkeur?.length > 0 || c?.diensttype?.length > 0) && (
              <MainSection label="Voorkeuren" S={S}>
                {c?.functies_voorkeur?.length > 0 && (
                  <View style={{ marginBottom: 6 }}>
                    <Text style={{ ...S.bodyText, fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>Functies</Text>
                    <View style={S.tagRow}>
                      {c.functies_voorkeur.map((f, i) => <Text key={i} style={S.tag}>{f}</Text>)}
                    </View>
                  </View>
                )}
                {c?.diensttype?.length > 0 && (
                  <View>
                    <Text style={{ ...S.bodyText, fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>Diensttype</Text>
                    <View style={S.tagRow}>
                      {c.diensttype.map((d, i) => <Text key={i} style={S.tag}>{d}</Text>)}
                    </View>
                  </View>
                )}
              </MainSection>
            )}
          </View>
        </View>

        {/* Footer */}
        <View style={S.footer} fixed>
          <Text style={S.footerText}>
            {settings.companyName ? `Opgemaakt door ${settings.companyName}` : 'Opgemaakt via KoiosMatch'}
          </Text>
          <Text style={S.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>

      </Page>
    </Document>
  )
}
