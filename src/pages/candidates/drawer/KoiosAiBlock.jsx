import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles, RefreshCw } from 'lucide-react'
import { useDateFormat } from '../../../lib/datetime'

/** AI advisory block (dummy insights for now — to be wired to the API later). */
export default function KoiosAiBlock({ c }) {
  const { t } = useTranslation('candidates')
  const { formatDate } = useDateFormat()
  const [loading, setLoading] = useState(false)

  const coreFields = [c.email, c.phone, c.dob, c.address, c.gender, c.nationality, c.summary]
  const filledPct  = Math.round((coreFields.filter(Boolean).length / coreFields.length) * 100)

  const insights = [
    {
      type: t('ai.completeness'),
      color: filledPct >= 80 ? 'var(--color-success)' : 'var(--color-warning)',
      text: filledPct >= 80 ? t('ai.completeGood') : t('ai.completePartial', { pct: filledPct }),
    },
    {
      type: t('ai.matchLabel'),
      color: 'var(--color-primary)',
      text: t('ai.matchText'),
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
    <div style={{ border: '1px solid #C4B5FD', borderRadius: 10, padding: '14px 16px', background: 'linear-gradient(135deg, #F5F3FF 0%, var(--color-primary-bg) 100%)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{ width: 26, height: 26, borderRadius: 7, background: 'linear-gradient(135deg, var(--color-primary), #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Sparkles size={13} color="white" />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary)', flex: 1 }}>{t('ai.title')}</span>
        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: '#DDD6FE', color: '#6D28D9', fontWeight: 600 }}>{t('ai.beta')}</span>
        <button onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 1400) }}
          title={t('ai.refresh')} disabled={loading}
          style={{ background: 'none', border: 'none', cursor: loading ? 'default' : 'pointer', color: 'var(--color-primary)', padding: 3, display: 'flex', opacity: loading ? 0.4 : 1, borderRadius: 5 }}>
          <RefreshCw size={12} />
        </button>
      </div>
      {loading
        ? <div style={{ fontSize: 12, color: 'var(--color-primary)', fontStyle: 'italic' }}>{t('ai.analyzing')}</div>
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {insights.map((ins, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: 'rgba(255,255,255,0.55)', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: ins.color, flexShrink: 0, marginTop: 5 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: ins.color, marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{ins.type}</div>
                  <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.5 }}>{ins.text}</div>
                </div>
              </div>
            ))}
          </div>
        )
      }
    </div>
  )
}
