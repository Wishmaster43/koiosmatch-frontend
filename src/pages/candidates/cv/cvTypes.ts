/**
 * cvTypes — the input shapes the generated CV accepts (candidate, tenant CV
 * settings, translate fn).
 *
 * Pulled out of CandidateCvTemplate so the document file is layout only: these
 * types are the CV's public contract — proposalCv, CandidateHeaderBits and
 * useProposeForm all type their args against them — and they change for a
 * different reason (a new candidate field) than the page layout does.
 * CandidateCvTemplate re-exports them, so every existing import path still works.
 */

// The CV input is a loose candidate (mapped OR raw), with many alternate field
// names — typed permissively; the PDF reads defensively with `??` fallbacks.
export interface CvExperience { title?: string; function?: string; name?: string; company?: string; employer?: string; start_date?: string; startDate?: string; start?: string; end_date?: string; endDate?: string; end?: string; description?: string; desc?: string }
export interface CvEducation { title?: string; name?: string; school?: string; institution?: string; start_year?: string | number; startYear?: string | number; year?: string | number; end_year?: string | number; endYear?: string | number }
export interface CvLanguage { language?: string; name?: string; level?: string; spoken?: string }
export interface CvNamed { name?: string }
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
