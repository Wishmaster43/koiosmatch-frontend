/**
 * CvProposalRepeatables — the work-history and education rows a CV proposes.
 * These are APPEND-ONLY on the backend (CvParseProposalApplier never overwrites
 * an existing row), so there is nothing to compare them against — the honest
 * framing is "these lines get added", which is what the header says.
 *
 * Dates and employers are the two things the parser gets wrong most often, so
 * every row carries the CV badge and every value is shown exactly as read — no
 * reformatting that would launder a misread into something that looks parsed.
 */
import { useTranslation } from 'react-i18next'
import SoftChip from '@/components/ui/SoftChip'
import { Caption } from '@/components/ui/typography'
import type { CvProposalEducation, CvProposalExperience } from '@/pages/applications/data/mapCvProposal'

const rowStyle = { display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' as const, fontSize: 12 }
const listTitle = { fontSize: 11, fontWeight: 600 as const, color: 'var(--text)', marginBottom: 4 }

interface CvProposalRepeatablesProps {
  experiences: CvProposalExperience[]
  educations: CvProposalEducation[]
}

// See the file's top doc above; renders nothing when the CV proposed no work-history/education rows.
export default function CvProposalRepeatables({ experiences, educations }: CvProposalRepeatablesProps) {
  const { t } = useTranslation('applications')
  if (experiences.length === 0 && educations.length === 0) return null

  // Literal CV period text — e.g. "2015 – now" when only a start date was read.
  const period = (start: string, end: string) => {
    if (!start && !end) return ''
    return `${start || '?'} – ${end || t('cvProposal.ongoing')}`
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {experiences.length > 0 && (
        <div>
          <div style={listTitle}>{t('cvProposal.experiences.title', { count: experiences.length })}</div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {experiences.map((row, index) => (
              <li key={`${row.company}-${index}`} style={rowStyle}>
                <span style={{ color: 'var(--text)', fontWeight: 500 }}>{row.company}</span>
                {row.position && <Caption>{row.position}</Caption>}
                {row.location && <Caption>{row.location}</Caption>}
                {period(row.startDate, row.endDate) && <Caption>{period(row.startDate, row.endDate)}</Caption>}
                <SoftChip label={t('cvProposal.badge')} color="var(--color-primary)" title={t('cvProposal.badgeTitle')} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {educations.length > 0 && (
        <div>
          <div style={listTitle}>{t('cvProposal.educations.title', { count: educations.length })}</div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {educations.map((row, index) => (
              <li key={`${row.degree}-${index}`} style={rowStyle}>
                <span style={{ color: 'var(--text)', fontWeight: 500 }}>{row.degree}</span>
                {row.school && <Caption>{row.school}</Caption>}
                {row.issueDate && <Caption>{row.issueDate}</Caption>}
                <SoftChip label={t('cvProposal.badge')} color="var(--color-primary)" title={t('cvProposal.badgeTitle')} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
