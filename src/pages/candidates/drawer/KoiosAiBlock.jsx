import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw } from 'lucide-react'
import { useDateFormat } from '../../../lib/datetime'
import KoiosAiMark from '../../../components/ui/KoiosAiMark'

/** AI advisory block (dummy insights for now — to be wired to the API later).
 *  Calm/neutral styling; profile-level insights only — match score lives in the
 *  application drawer, not here. */
export default function KoiosAiBlock({ c }) {
  const { t } = useTranslation('candidates')
  const { formatDate } = useDateFormat()
  const [loading, setLoading] = useState(false)

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
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', background: 'var(--surface)' }}>
      {/* Header — Koios AI mark + title + beta + refresh */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <KoiosAiMark size={26} />
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', flex: 1 }}>{t('ai.title')}</span>
        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: 'var(--color-primary-bg)', color: 'var(--color-primary)', fontWeight: 600 }}>{t('ai.beta')}</span>
        <button onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 1400) }}
          title={t('ai.refresh')} disabled={loading}
          style={{ background: 'none', border: 'none', cursor: loading ? 'default' : 'pointer', color: 'var(--text-muted)', padding: 3, display: 'flex', opacity: loading ? 0.4 : 1, borderRadius: 5 }}>
          <RefreshCw size={12} />
        </button>
      </div>
      {loading
        ? <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('ai.analyzing')}</div>
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {insights.map((ins, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: ins.color, flexShrink: 0, marginTop: 5 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{ins.type}</div>
                  <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>{ins.text}</div>
                </div>
              </div>
            ))}
          </div>
        )
      }
    </div>
  )
}
