/**
 * CandidateDetailDrawer — slide-in panel showing one candidate's full detail:
 * contact info, status, work history, and messages. Opened from CandidatesTable.
 * StatusBadge below = the colored status pill.
 */
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Phone, Mail, MapPin, Calendar, Clock, Briefcase, MessageSquare, History } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReportCandidate, GlobalRate } from '../../types/reports'

// Colored status pill (actief / nietactief / extern / ...) for the candidate.
function StatusBadge({ status }: { status?: string }) {
  const { t } = useTranslation('reports')
  const styles: Record<string, { bg: string; color: string }> = {
    actief:     { bg: 'var(--color-success-bg)', color: 'var(--color-success)' },
    nietactief: { bg: 'var(--color-warning-bg)', color: '#C2410C' },
    extern:     { bg: 'var(--color-secondary-bg)', color: '#1D4ED8' },
    intake:     { bg: '#FAF5FF', color: '#7C3AED' },
    verwijderd: { bg: 'var(--color-danger-bg)', color: 'var(--color-danger)' },
  }
  const key = (status || '').toLowerCase().replace(/\s+/g, '')
  const s = styles[key] || { bg: 'var(--hover-bg)', color: 'var(--text-muted)' }
  const label = status ? t(`candidates.status.${key}`, { defaultValue: status }) : t('candidates.unknown')
  return (
    <span style={{ background: s.bg, color: s.color, fontSize: 11, fontWeight: 600,
                   padding: '3px 10px', borderRadius: 999 }}>
      {label}
    </span>
  )
}

function InfoRow({ icon: Icon, label, value }: { icon: LucideIcon; label: ReactNode; value?: ReactNode }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3"
      style={{ padding: '8px 0', borderBottom: '1px solid var(--hover-bg)' }}>
      <div className="flex items-center justify-center flex-shrink-0 rounded-lg"
        style={{ width: 28, height: 28, background: 'var(--hover-bg)' }}>
        <Icon size={13} style={{ color: 'var(--text-muted)' }} />
      </div>
      <div className="flex-1 min-w-0">
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, wordBreak: 'break-word' }}>{value}</div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 8 }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function TagList({ items, color = 'var(--color-primary)', bg = 'var(--color-primary-bg)' }: { items?: ReactNode[]; color?: string; bg?: string }) {
  if (!items?.length) return <span style={{ fontSize: 12, color: 'var(--border)' }}>—</span>
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, i) => (
        <span key={i} style={{ fontSize: 11, fontWeight: 500, padding: '3px 8px',
                                borderRadius: 6, background: bg, color }}>
          {item}
        </span>
      ))}
    </div>
  )
}

function fmtDate(v?: string | null) {
  if (!v) return null
  const d = new Date(v)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtDateTime(v?: string | null) {
  if (!v) return null
  const d = new Date(v)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric',
                                          hour: '2-digit', minute: '2-digit' })
}

/* ── Tabs ── */
const TABS: Array<{ id: string; tKey: string; icon?: LucideIcon }> = [
  { id: 'algemeen',    tKey: 'general' },
  { id: 'conversatie', tKey: 'conversation', icon: MessageSquare },
  { id: 'history',     tKey: 'history',      icon: History },
]

function TabBar({ active, onChange }: { active: string; onChange: (id: string) => void }) {
  const { t } = useTranslation('reports')
  return (
    <div className="flex flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
      {TABS.map(tab => {
        const isActive = active === tab.id
        return (
          <button key={tab.id} onClick={() => onChange(tab.id)}
            className="inline-flex items-center gap-1.5"
            style={{
              padding: '10px 16px', fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--color-primary)' : 'var(--text-muted)',
              borderTop: 'none', borderLeft: 'none', borderRight: 'none',
              borderBottom: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
              marginBottom: -1, background: 'none',
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
            {tab.icon && <tab.icon size={13} />}
            {t(`candidateDrawer.tabs.${tab.tKey}`)}
          </button>
        )
      })}
    </div>
  )
}

function TabAlgemeen({ c, kenmerken, rates }: { c: ReportCandidate; kenmerken: ReactNode[]; rates: GlobalRate[] }) {
  const { t } = useTranslation('reports')
  return (
    <div className="flex-1 overflow-auto" style={{ padding: '20px 24px' }}>

      <Section title={t('candidateDrawer.sections.contact')}>
        <InfoRow icon={Phone}  label={t('candidateDrawer.fields.mobile')} value={c.mobile ?? c.phone} />
        <InfoRow icon={Mail}   label={t('candidateDrawer.fields.email')}  value={c.email} />
        <InfoRow icon={MapPin} label={t('candidateDrawer.fields.city')}   value={c.city} />
      </Section>

      <Section title={t('candidateDrawer.sections.timeline')}>
        <InfoRow icon={Calendar}  label={t('candidateDrawer.fields.registrationDate')} value={fmtDate(c.registration_date)} />
        <InfoRow icon={Clock}     label={t('candidateDrawer.fields.lastLogin')}        value={fmtDateTime(c.last_login_at)} />
        <InfoRow icon={Calendar}  label={t('candidateDrawer.fields.plannedShift')}     value={fmtDateTime(c.last_planned_shift)} />
        <InfoRow icon={Briefcase} label={t('candidateDrawer.fields.lastShift')}        value={fmtDateTime(c.last_worked_shift)} />
        {c.end_date_employment && (
          <InfoRow icon={Calendar} label={t('candidateDrawer.fields.endEmployment')} value={fmtDate(c.end_date_employment)} />
        )}
      </Section>

      <Section title={t('candidateDrawer.sections.stats')}>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: t('candidateDrawer.stats.worked'),        value: c.number_of_times_worked ?? '—' },
            { label: t('candidateDrawer.stats.noShows'),       value: c.no_shows ?? '—' },
            { label: t('candidateDrawer.stats.cancellations'), value: c.cancellations ?? '—' },
          ].map(stat => (
            <div key={stat.label} className="text-center rounded-xl"
              style={{ padding: '12px 8px', background: 'var(--hover-bg)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{stat.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title={t('candidateDrawer.sections.features')}>
        <TagList items={kenmerken} color="var(--color-primary)" bg="var(--color-primary-bg)" />
      </Section>

      {rates.length > 0 && (
        <Section title={t('candidateDrawer.sections.globalRole')}>
          <div className="overflow-hidden rounded-xl" style={{ border: '1px solid var(--border)' }}>
            <div style={{ padding: '10px 14px' }}>
              {rates.map((r, i) => (
                <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--hover-bg)' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                        {r.global_rate?.internal_description ?? '—'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                        {r.step_name ?? '—'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                        {r.hour_rate != null ? `€ ${Number(r.hour_rate).toFixed(2)}` : '—'}
                      </div>
                      {r.is_default_step === 1 && (
                        <span style={{ fontSize: 10, fontWeight: 500, padding: '1px 6px',
                                       borderRadius: 4, background: 'var(--color-success-bg)', color: 'var(--color-success)',
                                       display: 'inline-block', marginTop: 2 }}>
                          {t('candidateDrawer.default')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Section>
      )}

    </div>
  )
}

function TabConversatie({ c }: { c: ReportCandidate }) {
  const { t } = useTranslation('reports')
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center"
      style={{ padding: 32 }}>
      <div className="flex items-center justify-center rounded-xl"
        style={{ width: 44, height: 44, background: 'var(--border)' }}>
        <MessageSquare size={20} style={{ color: 'var(--border)' }} />
      </div>
      <div>
        <p className="font-medium text-[var(--text-muted)]" style={{ fontSize: 14 }}>{t('candidateDrawer.conversationComing')}</p>
        <p className="mt-1 text-[var(--text-muted)]" style={{ fontSize: 12 }}>
          {t('candidateDrawer.conversationDesc', { name: c.firstname ?? t('candidateDrawer.candidateFallback') })}
        </p>
      </div>
    </div>
  )
}

function TabHistory({ c }: { c: ReportCandidate }) {
  const { t } = useTranslation('reports')
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center"
      style={{ padding: 32 }}>
      <div className="flex items-center justify-center rounded-xl"
        style={{ width: 44, height: 44, background: 'var(--border)' }}>
        <History size={20} style={{ color: 'var(--border)' }} />
      </div>
      <div>
        <p className="font-medium text-[var(--text-muted)]" style={{ fontSize: 14 }}>{t('candidateDrawer.historyComing')}</p>
        <p className="mt-1 text-[var(--text-muted)]" style={{ fontSize: 12 }}>
          {t('candidateDrawer.historyDesc', { name: c.firstname ?? t('candidateDrawer.candidateFallback') })}
        </p>
      </div>
    </div>
  )
}

/* ── Main component ── */
export default function CandidateDetailDrawer({ candidate: c, onClose }: { candidate: ReportCandidate | null; onClose: () => void }) {
  const { t } = useTranslation('reports')
  const [activeTab, setActiveTab] = useState('algemeen')
  if (!c) return null

  const fullName = `${c.firstname ?? ''} ${c.lastname ?? ''}`.trim() || t('candidateDrawer.unknownName')

  const kenmerken = Array.isArray(c.features)
    ? c.features.map(f => f.name).filter(Boolean)
    : []

  const rates = Array.isArray(c.global_rate_summary) ? c.global_rate_summary : []

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.25)' }}
        onClick={onClose} />

      <div className="fixed top-0 bottom-0 right-0 z-50 flex flex-col bg-[var(--surface)]"
        style={{ width: 520, boxShadow: '-4px 0 30px rgba(0,0,0,0.12)', overflow: 'hidden' }}>

        {/* Header */}
        <div className="flex-shrink-0"
          style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center min-w-0 gap-3">
              <div className="flex items-center justify-center flex-shrink-0 font-bold rounded-xl"
                style={{ width: 44, height: 44, background: 'var(--color-primary-bg)',
                          color: 'var(--color-primary)', fontSize: 16 }}>
                {(c.firstname?.[0] ?? '?').toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="font-semibold truncate"
                  style={{ fontSize: 16, color: 'var(--text)' }}>{fullName}</div>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <StatusBadge status={c.status} />
                  {c.position && (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.position}</span>
                  )}
                </div>
              </div>
            </div>
            <button onClick={onClose}
              className="flex items-center justify-center flex-shrink-0 rounded-lg"
              style={{ width: 30, height: 30, border: '1px solid var(--border)',
                       background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}>
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <TabBar active={activeTab} onChange={setActiveTab} />

        {/* Tab content */}
        {activeTab === 'algemeen'    && <TabAlgemeen    c={c} kenmerken={kenmerken} rates={rates} />}
        {activeTab === 'conversatie' && <TabConversatie c={c} />}
        {activeTab === 'history'     && <TabHistory     c={c} />}

      </div>
    </>
  )
}