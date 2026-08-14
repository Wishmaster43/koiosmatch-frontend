import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ShieldCheck } from 'lucide-react'
import { useDateFormat } from '@/lib/datetime'
import KoiosAdviceBlock from '@/components/ai/KoiosAdviceBlock'
import { useApplicationAdvice } from '@/lib/useApplicationAdvice'
import { adviceInsightRows } from '@/lib/koiosAdviceInsight'
import SectionCard from '@/components/ui/SectionCard'
import SafeHtml from '@/components/ui/SafeHtml'
import { buildApplicationAdviceInsights } from '../applicationAiInsights'
import CompetitionBlock from '../CompetitionBlock'
import type { ApplicationDetail } from '@/types/application'

interface ContextSubTabProps {
  application: ApplicationDetail
}

// True when the sanitised motivation carries no markup at all. The careersite posts
// rich text, but the partner API may post PLAIN text whose newlines would otherwise
// collapse into one unbroken paragraph in the DOM. Only that case gets `pre-wrap`:
// applying it to real HTML would turn the newlines BETWEEN its <p> tags into visible
// blank lines. `<` must be followed by a letter, so "5 < 6" is still plain text.
const isPlainText = (html: string) => !/<[a-z][\s\S]*?>/i.test(html)

// V-appdetail-4: long letters get a show-more/less toggle instead of always
// rendering the full text — a plain STRING-LENGTH heuristic (no DOM measuring),
// mirrors the tag-stripped length so markup weight never trips the threshold early.
const COLLAPSE_THRESHOLD = 400
const collapsedHeight = 160

/**
 * ContextSubTab — APP-TAB-SPLIT-1, group (d): everything that is CONTEXT
 * rather than the application's own core state — competing applicants on the
 * same vacancy, the motivation letter, interview-consent evidence and the
 * Koios AI advisory (carrying the task, if any). Same original order and
 * behaviour, unchanged. DD-FE-9 (08-08 drill-down audit): the match-score
 * criteria breakdown moved OUT of here into the Status sub-tab, directly
 * under the score cell — adjusting now sits where reading is.
 */
export default function ContextSubTab({ application: a }: ContextSubTabProps) {
  const { t } = useTranslation(['applications', 'common'])
  const { formatDateTime } = useDateFormat()
  // KOIOS-ADVIES-OVERAL-1: the SAME resolver the applications table's Koios
  // column uses (the AI task) — prepended below so the two never disagree.
  const resolveAdvice = useApplicationAdvice()
  // V-appdetail-4: motivation letter expand — read-only, no persistence involved.
  const [letterExpanded, setLetterExpanded] = useState(false)
  const letterIsLong = (a.coverLetter?.replace(/<[^>]*>/g, '').length ?? 0) > COLLAPSE_THRESHOLD

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* How busy is this vacancy, and where does this candidate stand among the
          other applicants (Danny 25-07 d). */}
      <CompetitionBlock application={a} />

      {/* MOTIVATIE-ZICHTBAAR-1: the applicant's motivation letter, delivered by the
          drawer's own GET /applications/{id} (ApplicationDetailResource.cover_letter).
          The truthiness check is permanent, NOT a gate on an awaited field: only the
          public careersite apply and the partner API ever write cover_letter, and a
          vacancy with app_cover_letter = HIDDEN never stores it — so most applications
          legitimately have none and a card showing a dash would be pure noise. It also
          catches the '' the server sends for a letter that stripped to nothing.
          Untrusted public input: always through SafeHtml/DOMPurify (§7), never raw. */}
      {a.coverLetter && (
        <SectionCard title={t('motivation.title')}>
          {/* Canon (05-08): 12px prose, matching the candidate profile summary/notes convention. */}
          <div style={!letterExpanded && letterIsLong ? { maxHeight: collapsedHeight, overflow: 'hidden' } : undefined}>
            <SafeHtml html={a.coverLetter} style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5,
              whiteSpace: isPlainText(a.coverLetter) ? 'pre-wrap' : undefined }} />
          </div>
          {letterIsLong && (
            <button type="button" onClick={() => setLetterExpanded(v => !v)}
              style={{ marginTop: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                fontSize: 11, fontWeight: 600, color: 'var(--color-primary-text)' }}>
              {letterExpanded ? t('motivation.showLess') : t('motivation.showMore')}
            </button>
          )}
        </SectionCard>
      )}

      {/* INTERVIEW-CONSENT-PERSIST-1: the applicant's (AI-)interview consent tick
          from the public apply form — a calm, one-line AVG evidence row. The
          null-check is permanent null-safety, NOT a gate on an awaited backend
          field: the backend ships the timestamp today, but it is null on every
          application that did not come through the careersite. Absence therefore
          proves nothing, so we show the row only as positive evidence — never a
          "no consent" line, and never an unguarded formatDateTime(null). */}
      {a.interviewConsentGivenAt && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
          <ShieldCheck size={12} />
          <span>{t('interviewConsent.given', { date: formatDateTime(a.interviewConsentGivenAt) })}</span>
        </div>
      )}

      {/* Koios AI advisory — the table-identical AI-task advice first (KOIOS-
          ADVIES-OVERAL-1, resolved by useApplicationAdvice; [] when there is
          none), then phase progress and vacancy-link completeness (§3A
          blueprint), all in ONE AI-branded block (DUPLICATE-AI-BLOCK-1: no
          standalone "Taak" block next to it). */}
      <KoiosAdviceBlock namespace="applications"
        insights={[...adviceInsightRows(resolveAdvice(a)), ...buildApplicationAdviceInsights(a, t)]} />
    </div>
  )
}
