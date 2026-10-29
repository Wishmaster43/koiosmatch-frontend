/**
 * cvSections — pdf-free home of groupCvSections, the ONE function both the generated PDF and
 * the settings screen's live preview call, so they can never disagree on layout. Lives apart
 * from CandidateCvTemplate so importing it never pulls the @react-pdf engine into a chunk.
 */
import { resolveCvSectionPlacement, CV_DEFAULT_SECTIONS } from '@/lib/useCvSettings'

// Groups a tenant's configured sections into the sidebar/main regions, preserving stored order.
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
