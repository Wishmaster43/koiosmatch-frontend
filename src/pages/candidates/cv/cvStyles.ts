/**
 * cvStyles — every colour and measurement of the generated CV, as react-pdf
 * style values: the document StyleSheet plus the per-region content palette.
 *
 * Pulled out of CandidateCvTemplate because it is a large static style config
 * parameterised by nothing but the tenant's two brand colours — it has no
 * knowledge of the candidate and changes only when the CV's look changes. It
 * also keeps all the "react-pdf renders outside the CSS cascade, so design
 * tokens cannot resolve" hex exemptions in one auditable place (§4).
 */
import { StyleSheet } from '@react-pdf/renderer'
import { readableOn } from '@/hooks/useTenantTheme'
import { hexToRgba } from './cvPalette'
import type { Palette } from './cvPalette'

// Re-exported so the PDF-side importers keep one entry point for styles and palette.
export { paletteFor } from './cvPalette'
export type { Palette }

/* eslint-disable huisstijl/no-restricted-syntax -- react-pdf renders NO CSS
   color-mix (its own style engine), so lib/tint's formula cannot work here;
   the colours are guaranteed hex (tenant theme resolved before PDF render),
   which is the ONE context where hex+alpha concat is safe by construction. */

export function makeStyles(color: string, color2: string) {
  // PDF document colours: @react-pdf/renderer renders this StyleSheet outside the
  // DOM/CSS cascade (it produces an actual PDF file), so var(--color-*) tokens
  // cannot resolve here — these are fixed document-style constants, not UI hex.
  /* eslint-disable no-restricted-syntax -- PDF StyleSheet colours; react-pdf renders outside the CSS cascade so design tokens cannot resolve here */
  // BRAND-TEXT-COLOR-1: the sidebar's own background IS the tenant accent colour
  // (`color`), so its text must not stay a hardcoded white — a light brand (e.g.
  // yellow) would render unreadable. Reuse the same luminance-based helper
  // useTenantTheme uses to derive --color-on-accent for the DOM.
  const onAccent = readableOn(color)
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

    sideLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: onAccent, textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 7, opacity: 0.85 },
    sideLabelFirst: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: onAccent, textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 7, opacity: 0.85 },

    contactGroup: { marginBottom: 5 },
    contactSubLabel: { fontSize: 7, color: hexToRgba(onAccent, 0.6), marginBottom: 1 },
    contactVal: { fontSize: 8.5, color: onAccent },

    langRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    langName: { fontSize: 8.5, color: onAccent },
    langLevel: { fontSize: 8, color: hexToRgba(onAccent, 0.6) },

    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
    tag: { fontSize: 7.5, color: onAccent, backgroundColor: hexToRgba(onAccent, 0.18), paddingTop: 2, paddingBottom: 2, paddingLeft: 6, paddingRight: 6, borderRadius: 99, marginRight: 3, marginBottom: 3 },

    certRow: { flexDirection: 'row', marginBottom: 4, gap: 5 },
    certBullet: { fontSize: 8.5, color: hexToRgba(onAccent, 0.5) },
    certText: { fontSize: 8.5, color: hexToRgba(onAccent, 0.85), flex: 1 },

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

export type CvStyles = ReturnType<typeof makeStyles>
