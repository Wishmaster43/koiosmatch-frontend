/**
 * CandidateCvTemplate — the generated candidate CV document (A4, @react-pdf).
 *
 * This file owns the PAGE: brand colours in, candidate normalised into slices,
 * and the header / sidebar / main / footer layout assembled from the section
 * components in ./cv. Styles, input types, labels and the individual sections
 * live in ./cv so this stays the layout only; the types and groupCvSections are
 * re-exported here because this module is the CV's public entry point.
 */
import { Document, Page, View, Text, Image } from '@react-pdf/renderer'
import { resolveCvSectionPlacement, CV_DEFAULT_SECTIONS } from '@/lib/useCvSettings'
import { makeStyles, paletteFor } from './cv/cvStyles'
import { fmtDate, makeCvLabeller } from './cv/cvLabels'
import { SideSection, MainSection } from './cv/CvSectionShells'
import { renderMovableContent } from './cv/cvMovableContent'
import { CvEducationSection, CvExperienceSection } from './cv/CvEntrySections'
import type { CvCandidate, CvSettings, TranslateFn } from './cv/cvTypes'

// Re-exported so existing importers (proposalCv, CandidateHeaderBits,
// useProposeForm) keep typing against this module rather than reaching into ./cv.
export type { CvCandidate, CvSettings, TranslateFn }

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

export function CvDocument({ c, settings = {}, locale = 'nl-NL', t, redactContact = false }: CvDocumentProps) {
  // Fallback brand colours (mirror --color-primary/--color-info) for tenants with
  // no CV theme configured — react-pdf cannot resolve var(--color-*) CSS tokens.
  /* eslint-disable no-restricted-syntax -- PDF fallback colours; react-pdf cannot resolve var(--color-*) tokens */
  const color  = settings.primaryColor   ?? '#19A5CA'
  const color2 = settings.secondaryColor ?? '#1B60A9'
  /* eslint-enable no-restricted-syntax */
  const S = makeStyles(color, color2)
  const fmt = (d?: string | number | null) => fmtDate(d, locale)
  const L = makeCvLabeller(t)

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
  const photoSrc     = c?.photoUrl ?? c?.photo_url ?? c?.photo ?? null
  const logoSrc      = settings.logoUrl ?? null

  // The slices every movable section draws from, gathered once so the same
  // normalised data feeds the sidebar and the main column.
  const movableData = {
    contact,
    languages: c?.languages ?? [],
    skills:    c?.skills    ?? [],
    certs:     c?.certs     ?? c?.certifications ?? [],
    preferredFunctions: c?.preferredFunctions ?? [],
    shiftType:          c?.shiftType          ?? [],
  }

  // Which movable sections render in which region, in the tenant's stored
  // order (§ CV section placement) — the same function the settings screen's
  // live preview calls, so the two can never disagree.
  const groups = groupCvSections(secs)
  const sidebarPalette = paletteFor('sidebar', color2)
  const mainPalette    = paletteFor('main', color2)

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
              const content = renderMovableContent(id, sidebarPalette, S, movableData)
              if (!content) return null
              return <SideSection key={id} label={L(id)} first={idx === 0} S={S}>{content}</SideSection>
            })}
          </View>

          {/* Main — experience/education always render here (pinned, entry-card layout);
              movable sections a tenant relocated here use the shared content renderer. */}
          <View style={S.main}>
            {groups.main.map(id => {
              if (id === 'experience') return <CvExperienceSection key="experience" entries={experiences} S={S} L={L} fmt={fmt} />
              if (id === 'education')  return <CvEducationSection  key="education"  entries={educations}  S={S} L={L} />
              const content = renderMovableContent(id, mainPalette, S, movableData)
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
