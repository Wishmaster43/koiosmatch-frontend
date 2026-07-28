/**
 * CvEntrySections — the two PINNED main-column sections that render as dated
 * entry cards: work experience and education.
 *
 * Pulled out of CandidateCvTemplate because, unlike the movable sections, these
 * carry their own layout AND their own field-alias tolerance (mapped vs. raw
 * candidates spell start/end and org differently) — that alias knowledge is why
 * they were the bulkiest part of the document and it changes for its own reason.
 * Each renders null when it has no entries, matching the previous inline
 * "skip the whole section when empty" behaviour.
 */
import { View, Text } from '@react-pdf/renderer'
import { MainSection } from './CvSectionShells'
import type { CvEducation, CvExperience } from './cvTypes'
import type { CvStyles } from './cvStyles'
import type { CvDateFn, CvLabelFn } from './cvLabels'

// Work experience — newest-first order is decided upstream; dates run through the
// document's locale-bound formatter and an open end date reads as "present".
export function CvExperienceSection({ entries, S, L, fmt }: { entries: CvExperience[]; S: CvStyles; L: CvLabelFn; fmt: CvDateFn }) {
  if (entries.length === 0) return null
  return (
    <MainSection label={L('experience')} S={S}>
      {entries.map((e, i) => {
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

// Education — years only (no month/locale formatting), so this section needs no
// date formatter; an open end year simply prints the start year alone.
export function CvEducationSection({ entries, S, L }: { entries: CvEducation[]; S: CvStyles; L: CvLabelFn }) {
  if (entries.length === 0) return null
  return (
    <MainSection label={L('education')} S={S}>
      {entries.map((o, i) => {
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
