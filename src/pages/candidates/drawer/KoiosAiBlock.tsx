import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw, ChevronDown } from 'lucide-react'
import { useDateFormat } from '@/lib/datetime'
import KoiosAiMark from '@/components/ui/KoiosAiMark'
import type { Candidate } from '@/types/candidate'

/** AI advisory block (dummy insights for now — to be wired to the API later).
 *  Heading (icon + title) sits OUTSIDE the block in the same grey style as the
 *  other sections; insights are collapsible (closed by default). Profile-level
 *  insights only — match score lives in the application drawer, not here. */
export default function KoiosAiBlock({ c }: { c: Candidate }) {
  const { t } = useTranslation('candidates')
  const { formatDate } = useDateFormat()
  const [loading, setLoading] = useState(false)
  // Which insight is expanded (null = all collapsed, the default).
  const [openIdx, setOpenIdx] = useState<number | null>(null)

  const coreFields = [c.email, c.phone, c.dob, c.address, c.gender, c.nationality, c.summary]
  const filledPct  = Math.round((coreFields.filter(Boolean).length / coreFields.length) * 100)

  // Profile-level insights only (completeness + engagement).
  const insights = [
    {
      type: t('ai.completeness'),
      color: filledPct >= 80 ? 'var(--color-success)' : 'var(--color-warning)',
      text: filledPct >= 80 ? t('ai.completeGood') : t('ai.completePartial', { pct: filledPct }),
    },
    {
      type: t('ai.engagementLabel'),
      color: 'var(--color-secondary)',
      text: c.lastContactDate
        ? t('ai.engagementContacted', { date: formatDate(c.lastContactDate) })
        : t('ai.engagementNone'),
    },
  ]

  return (
    <div>
      {/* Heading outside the block — icon + grey title (like the other sections) + beta + refresh */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <KoiosAiMark size={16} />
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', flex: 1 }}>{t('ai.title')}</span>
        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: 'var(--color-primary-bg)', color: 'var(--color-primary)', fontWeight: 600 }}>{t('ai.beta')}</span>
        <button onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 1400) }}
          title={t('ai.refresh')} disabled={loading}
          style={{ background: 'none', border: 'none', cursor: loading ? 'default' : 'pointer', color: 'var(--text-muted)', padding: 3, display: 'flex', opacity: loading ? 0.4 : 1, borderRadius: 5 }}>
          <RefreshCw size={12} />
        </button>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px', background: 'var(--surface)' }}>
        {loading
          ? <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('ai.analyzing')}</div>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {insights.map((ins, i) => {
                const open = openIdx === i
                return (
                  <div key={i} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
                    {/* Collapsed by default: title + chevron; click reveals the text. */}
                    <button onClick={() => setOpenIdx(open ? null : i)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', background: 'none', border: 'none', cursor: 'pointer' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: ins.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', flex: 1, textAlign: 'left' }}>{ins.type}</span>
                      <ChevronDown size={13} style={{ color: 'var(--text-muted)', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                    </button>
                    {open && <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5, padding: '0 10px 8px 24px' }}>{ins.text}</div>}
                  </div>
                )
              })}
            </div>
          )}
      </div>
    </div>
  )
}
