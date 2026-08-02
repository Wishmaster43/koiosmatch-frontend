import { useTranslation } from 'react-i18next'
import { ShieldCheck } from 'lucide-react'
import { useDateFormat } from '@/lib/datetime'
import KoiosAdviceBlock from '@/components/ai/KoiosAdviceBlock'
import SectionCard from '@/components/ui/SectionCard'
import SafeHtml from '@/components/ui/SafeHtml'
import { buildApplicationAdviceInsights } from './applicationAiInsights'
import MatchScoreBlock from '@/components/match/MatchScoreBlock'
import type { Criterion } from '@/components/match/MatchScoreBlock'
import RejectionSummary from './RejectionSummary'
import CvBlock from './CvBlock'
import CvProposalBlock from './cvproposal/CvProposalBlock'
import ProposalsBlock from './propose/ProposalsBlock'
import ApplicationDetailsCard from './ApplicationDetailsCard'
import ApplicationStatusStrip from './ApplicationStatusStrip'
import CompetitionBlock from './CompetitionBlock'
import type { ApplicationDetail } from '@/types/application'
import type { Id } from '@/types/common'

interface ApplicationTabProps {
  application: ApplicationDetail
  onAdjustScore?: (id: Id | undefined, payload: { score: number | null; criteria: Criterion[] }) => void
  // Re-link (or unlink, null) the vacancy this application is coupled to (BE:
  // PATCH /applications/{id} vacancy_id, nullable). Klant is derived from the
  // picked option so the caller can update it optimistically before the PATCH
  // response reconciles it. Undefined hides the pencil (read-only caller).
  onLinkVacancy?: (id: Id | undefined, vacancyId: Id | null, meta?: { title?: string; client?: string }) => void
  // S7: PATCH the Bron field (PATCH /applications/{id} {source}) — shares the
  // Details block's edit mode/pencil with onLinkVacancy. Undefined hides the
  // pencil (read-only caller, mirrors onLinkVacancy).
  onUpdateSource?: (id: Id | undefined, source: string) => void
}

// True when the sanitised motivation carries no markup at all. The careersite posts
// rich text, but the partner API may post PLAIN text whose newlines would otherwise
// collapse into one unbroken paragraph in the DOM. Only that case gets `pre-wrap`:
// applying it to real HTML would turn the newlines BETWEEN its <p> tags into visible
// blank lines. `<` must be followed by a letter, so "5 < 6" is still plain text.
const isPlainText = (html: string) => !/<[a-z][\s\S]*?>/i.test(html)

/**
 * ApplicationTab — the "Sollicitatie" tab: a thin COMPOSER (Danny 25-07: the
 * screen read as empty/sparse and had a duplicate AI-branded block; both fixed
 * by pulling substance into dedicated blocks and folding the AI task into the
 * one KoiosAdviceBlock — see applicationAiInsights.ts). Order: rejection
 * outcome → status strip (phase/appointment/interview/score at a glance) →
 * the framed Details card (Bron/Klant/Locatie/Vacature/Contactpersoon) → CV →
 * competition on the same vacancy → Motivatie → interview-consent evidence →
 * Koios AI advisory (now carrying the task, if any) → match score breakdown.
 * Candidate name/function are NOT editable here (Danny 21-07): both are
 * candidate-owned data (PATCH /candidates/{id}), not the application's own
 * fields — that edit lives on the candidate record itself.
 */
export default function ApplicationTab({ application: a, onAdjustScore, onLinkVacancy, onUpdateSource }: ApplicationTabProps) {
  const { t } = useTranslation(['applications', 'common'])
  const { formatDateTime } = useDateFormat()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Rejection outcome — read-only, shown on the FIRST drill-down screen
          (Danny 25-07); the reject FORM itself moved to a footer button +
          confirm modal (RejectionModal), opened from the drawer. */}
      <RejectionSummary application={a} />

      {/* Status at a glance — phase, next appointment, interview and match
          score in one calm strip (Danny 25-07: "ik wil zoveel mogelijk
          relevante informatie kunnen zien"). */}
      <ApplicationStatusStrip application={a} />

      {/* Details — Bron/Klant/Locatie/Vacature/Contactpersoon, now framed in the
          shared SectionCard like every other block on this tab (Danny 25-07 c). */}
      <ApplicationDetailsCard application={a} onLinkVacancy={onLinkVacancy} onUpdateSource={onUpdateSource} />

      {/* S31: the linked candidate's CV at a glance — file name + upload date. */}
      <CvBlock candidateId={a.candidateId} />

      {/* CV-PARSER-2 (entry b): the CV that came in WITH this application, parsed
          into a PROPOSAL nobody wrote to the dossier — a recruiter reviews the
          per-field comparison and accepts or rejects. Hidden entirely until such
          a proposal exists (see the block's own note on its UI states). */}
      <CvProposalBlock candidateId={a.candidateId} applicationId={a.id} />

      {/* PROPOSE-STORE-1: the recorded-proposal history (recipient, cv variant,
          sent/opened/revoked state) — hidden entirely until at least one exists. */}
      <ProposalsBlock application={a} />

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
          <SafeHtml html={a.coverLetter} style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5,
            whiteSpace: isPlainText(a.coverLetter) ? 'pre-wrap' : undefined }} />
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

      {/* Koios AI advisory — the AI task (if any, DUPLICATE-AI-BLOCK-1), phase
          progress and vacancy-link completeness (§3A blueprint), all in ONE
          AI-branded block (no more standalone "Taak" block next to it). */}
      <KoiosAdviceBlock namespace="applications" insights={buildApplicationAdviceInsights(a, t)} />

      {/* Match score — overall + configured criteria breakdown. */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>{t('matchScore.title')}</div>
        <MatchScoreBlock score={a.score} criteria={a.matchCriteria as Criterion[]} summary={a.matchSummary}
          source={a.matchSource} aiScore={a.aiScore}
          onSave={onAdjustScore ? payload => onAdjustScore(a.id, payload) : undefined} />
      </div>
    </div>
  )
}
