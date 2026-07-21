import { useTranslation } from 'react-i18next'
import { MessageCircle, CheckCircle2, FileText } from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import InterviewStatusCard from './InterviewStatusCard'
import type { ApplicationDetail } from '@/types/application'

type TranscriptMsg = ApplicationDetail['interviews'][number]['transcript'][number]

// A single transcript message (recruiter = out, candidate = in).
function Message({ msg }: { msg: TranscriptMsg }) {
  const isOut = msg.side === 'out'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, background: 'var(--bg)',
      border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Avatar initials={(msg.author?.[0] ?? '?').toUpperCase()} size={22} color={isOut ? 'var(--color-primary)' : undefined} />
        <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{msg.author}</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{msg.time}</span>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.45, paddingLeft: 30 }}>{msg.text}</div>
    </div>
  )
}

/**
 * InterviewsTab — the AI/WhatsApp interview(s) for an application: header,
 * summary and the full transcript. Empty state when there are none.
 */
export default function InterviewsTab({ application: a }: { application: ApplicationDetail }) {
  const { t } = useTranslation('applications')
  const interviews = a.interviews ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* INTERVIEW-VISIBILITY-1 (speculative): the live session's agent/turn/step/
          duration, distinct from the transcripts below (that's the per-run
          history; this is "where things stand right now"). Always rendered —
          shows its own honest placeholder when there is no session at all. */}
      <InterviewStatusCard interview={a.interview} />

      {!interviews.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 64, textAlign: 'center', color: 'var(--text-muted)' }}>
          <span style={{ width: 56, height: 56, borderRadius: '50%', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <FileText size={22} style={{ opacity: 0.6 }} />
          </span>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{t('interview.empty')}</div>
        </div>
      ) : interviews.map(iv => (
        <div key={iv.id} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Header — WhatsApp affordance in the success token (F6: mirrors ProfileTab's
              waDigits() hover colour) rather than the brand's literal hex green. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-success)', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <MessageCircle size={20} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{t('interview.title')}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{iv.date} · {iv.time}</div>
            </div>
            {iv.status === 'done' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500,
                padding: '3px 10px', borderRadius: 99, background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
                <CheckCircle2 size={12} /> {t('interview.done')}
              </span>
            )}
          </div>

          {/* Summary */}
          {iv.summary && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>{t('interview.summary')}</div>
              <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.55, margin: 0 }}>{iv.summary}</p>
            </div>
          )}

          {/* Transcript */}
          {iv.transcript.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>{t('interview.transcript')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {iv.transcript.map((m, i) => <Message key={i} msg={m} />)}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
