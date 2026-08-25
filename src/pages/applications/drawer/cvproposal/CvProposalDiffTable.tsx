/**
 * CvProposalDiffTable — the whole point of this feature: per field, what the
 * dossier holds TODAY next to what the CV proposes, and what accepting would
 * actually do to it. AI misreads dates and employers, so the proposed value is
 * marked as CV-derived (soft chip, never a plain value that reads as a fact) and
 * the outcome column spells out the fill-blank-only merge before the click, not
 * after it.
 *
 * A real <table> with scoped headers so the comparison is navigable by screen
 * reader; it scrolls inside its own container rather than pushing the drawer.
 */
import { useTranslation } from 'react-i18next'
import { useDateFormat } from '@/lib/datetime'
import SoftChip from '@/components/ui/SoftChip'
import type { CvProposalDiff } from '@/pages/applications/data/mapCvProposal'

// A bare Y-M-D from the candidate contract (ContractResource::date) is a real
// date and renders DD-MM-YYYY (§3B); anything else is LITERAL CV text — "maart
// 2015" (i.e. "March 2015"), "1990" — and stays untouched, because reformatting
// it would imply a parse we never did and hide exactly the misread we want the
// recruiter to spot.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const cell = { padding: '6px 8px', fontSize: 12, verticalAlign: 'top' as const, textAlign: 'left' as const }
const headCell = { ...cell, fontSize: 10, fontWeight: 600 as const, textTransform: 'uppercase' as const,
  letterSpacing: '0.04em', color: 'var(--text-muted)', whiteSpace: 'nowrap' as const }

interface CvProposalDiffTableProps {
  diff: CvProposalDiff
}

export default function CvProposalDiffTable({ diff }: CvProposalDiffTableProps) {
  const { t } = useTranslation('applications')
  const { formatDate } = useDateFormat()

  // Render a value: real dates localised, literal CV text left exactly as read.
  const show = (value: string) => (ISO_DATE.test(value) ? formatDate(value) : value)

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <caption style={{ captionSide: 'top', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', paddingBottom: 6 }}>
          {t('cvProposal.tableCaption')}
        </caption>
        <thead>
          <tr>
            <th scope="col" style={headCell}>{t('cvProposal.columns.field')}</th>
            <th scope="col" style={headCell}>{t('cvProposal.columns.current')}</th>
            <th scope="col" style={headCell}>{t('cvProposal.columns.proposed')}</th>
            <th scope="col" style={headCell}>{t('cvProposal.columns.result')}</th>
          </tr>
        </thead>
        <tbody>
          {diff.rows.map(row => (
            <tr key={row.field} style={{ borderTop: '1px solid var(--border)' }}>
              <th scope="row" style={{ ...cell, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                {t(`cvProposal.fields.${row.field}`)}
              </th>
              {/* What the dossier holds now — italic placeholder when empty (§4). */}
              <td style={{ ...cell, color: row.current ? 'var(--text)' : 'var(--text-muted)',
                fontStyle: row.current ? 'normal' : 'italic' }}>
                {row.current ? show(row.current) : t('cvProposal.currentEmpty')}
              </td>
              {/* What the CV says — always visibly marked as AI-read, never plain. */}
              <td style={cell}>
                <span style={{ color: 'var(--text)' }}>{show(row.proposed)}</span>{' '}
                <SoftChip label={t('cvProposal.badge')} color="var(--color-primary)" title={t('cvProposal.badgeTitle')} />
              </td>
              {/* The real outcome of accepting, per field — decided, not guessed. */}
              <td style={cell}>
                <SoftChip
                  label={row.willFill ? t('cvProposal.willFill') : t('cvProposal.willKeep')}
                  color={row.willFill ? 'var(--color-success)' : 'var(--text-muted)'}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
