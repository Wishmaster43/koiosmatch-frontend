import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import MatchesTab from './MatchesTab'
import StatusPill from '@/components/ui/StatusPill'
import { sectionBlock } from './constants'
import type { Candidate } from '@/types/candidate'

// One application row as nested under the candidate (read defensively). The
// funnel stage (label + colour) used to live in the header chips — shown here now.
interface AppRow { logo_url?: string; vacancy?: { logo_url?: string; title?: string }; vacature?: string; title?: string; stageLabel?: string; stageColor?: string }

/** Work tab — matches + paginated applications. */
export default function WorkTab({ c }: { c: Candidate }) {
  const { t } = useTranslation('candidates')
  const soll = (c.applications ?? []) as unknown as AppRow[]
  const PER = 5
  const [page, setPage] = useState(1)
  const pages = Math.max(1, Math.ceil(soll.length / PER))
  const slice = soll.slice((page - 1) * PER, page * PER)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <MatchesTab c={c} />
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 6 }}>
          {t('sections.applications')} <span style={{ fontWeight: 400 }}>{soll.length}</span>
        </div>
        <div style={sectionBlock}>
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px', background: 'var(--bg)', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>{t('work.vacancy')}</div>
          {slice.length === 0
            ? <div style={{ padding: '20px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>{t('sections.applicationsEmpty')}</div>
            : slice.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderBottom: i < slice.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 12, color: 'var(--text)' }}>
                {(s.logo_url ?? s.vacancy?.logo_url) && <img src={s.logo_url ?? s.vacancy?.logo_url} alt="" style={{ width: 24, height: 24, borderRadius: 4, objectFit: 'contain', flexShrink: 0 }} />}
                <span style={{ fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.vacature ?? s.vacancy?.title ?? s.title ?? '-'}</span>
                {s.stageLabel && <StatusPill label={s.stageLabel} color={s.stageColor} />}
              </div>
            ))
          }
        </div>
        {soll.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
            <span>{(page - 1) * PER + 1}–{Math.min(page * PER, soll.length)} {t('work.of')} {soll.length}</span>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--bg)', cursor: page <= 1 ? 'default' : 'pointer', color: page <= 1 ? 'var(--border)' : 'var(--text-muted)' }}>‹</button>
            <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages} style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--bg)', cursor: page >= pages ? 'default' : 'pointer', color: page >= pages ? 'var(--border)' : 'var(--text-muted)' }}>›</button>
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
