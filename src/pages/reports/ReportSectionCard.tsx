/**
 * Shared report section-card shape — the ONE outer card, content wrapper and
 * section heading used by every report page's body (below the KPI band / tabs).
 * Composes with `ReportStateBlock` (loading/error/empty) exactly like every Family-A
 * report already did by hand; this file extracts that hand-typed shape into one
 * place, mirroring what ReportKpiBand already did for the KPI strip. Extend here to
 * change the look everywhere — never re-type the style literals per page.
 */
import type { CSSProperties, ReactNode } from 'react'

// The one card shape every report section uses: surface bg, 12px radius, 1px border.
export const reportCardStyle: CSSProperties = {
  background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)',
}

// The one section-heading shape used inside a section-card (uppercase muted label).
export const reportSectionHeadStyle: CSSProperties = {
  fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
  color: 'var(--text-muted)', margin: 0,
}

// The outer card every report body renders into — holds the ReportStateBlock and,
// on success, a ReportSectionCardBody. `overflow:hidden` clips the state block's
// own padding to the card's rounded corners.
export function ReportSectionCard({ children }: { children: ReactNode }) {
  return <div style={{ ...reportCardStyle, overflow: 'hidden' }}>{children}</div>
}

// The success-state content wrapper: padding:20 + a vertical gap:24 stack of
// ReportSection blocks — identical rhythm on every report that has one.
export function ReportSectionCardBody({ children }: { children: ReactNode }) {
  return <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 24 }}>{children}</div>
}

// One titled section inside a ReportSectionCardBody — the uppercase muted <h3> +
// body, same shape on every axis/series block across the suite. `heading` renders a
// custom node instead of the plain <h3> for the rare section with an inline control
// (IntakesReport's group-by switch) while keeping the same title style/spacing.
export function ReportSection({ title, heading, children }: { title?: ReactNode; heading?: ReactNode; children: ReactNode }) {
  return (
    <section>
      {heading ?? <h3 style={{ ...reportSectionHeadStyle, marginBottom: 10 }}>{title}</h3>}
      {children}
    </section>
  )
}
