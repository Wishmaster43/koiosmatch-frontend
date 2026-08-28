/**
 * CandidateDetailDrawer — Shiftmanager candidate detail overlay, restyled onto
 * the native candidate-drawer visual language (Danny 24-07 "we moeten uniform
 * zijn — maak 'm hetzelfde"): a calm EntityHeader-style header (soft Avatar,
 * name + colour-coded status badge + mono reference chip, no picker wall),
 * SectionCard titled cards with label-above fields, and the shared DrawerTabs
 * underline bar. Stays a fixed-width overlay (its own positioning, not a real
 * EntityDrawer) — only the visual language is unified. Opened from
 * CandidatesTable, KpiDrillDownDrawer and CandidatesDetailPage; the
 * `candidate`/`onClose` contract is unchanged so none of those callers move.
 */
import { useState } from 'react'
import { statusOf } from '@/lib/smStatus'
import type { ReactNode } from 'react'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useTranslation } from 'react-i18next'
import { X, MessageSquare, History } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import SoftChip from '@/components/ui/SoftChip'
import ReferenceNumberChip from '@/components/ui/ReferenceNumberChip'
import SectionCard from '@/components/ui/SectionCard'
import DrawerTabs from '@/components/drawer/DrawerTabs'
import { useDateFormat } from '@/lib/datetime'
import { initialsOf } from '@/lib/initials'
import { SM_CANDIDATE_STATUS_COLORS } from '@/pages/shiftmanager/shared'
import { endDateOf, noShowCountOf, cancellationsOf, featureNamesOf } from '@/pages/shiftmanager/shared'
import type { ReportCandidate, GlobalRate } from '@/types/reports'

// Label-above field row (§4 drawer card idiom): 11px muted label, 13px value, em-dash when empty.
function Field({ label, value }: { label: ReactNode; value?: ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, wordBreak: 'break-word' }}>
        {value || <span style={{ color: 'var(--text-muted)' }}>—</span>}
      </div>
    </div>
  )
}

// Two-field row (short values paired, per §3A field-layout convention).
const twoCol = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } as const

// Empty-state placeholder for the not-yet-built Conversation/History tabs —
// icon in a muted tinted box (was invisible before: icon colour == box colour).
function ComingSoon({ icon: Icon, title, desc }: { icon: LucideIcon; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center" style={{ padding: 32 }}>
      <div className="flex items-center justify-center rounded-xl" style={{ width: 44, height: 44, background: 'var(--hover-bg)' }}>
        <Icon size={20} style={{ color: 'var(--text-muted)' }} />
      </div>
      <div>
        <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-muted)' }}>{title}</p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{desc}</p>
      </div>
    </div>
  )
}

// The "Algemeen" tab body: contact / timeline / stats / features / global-role
// cards — SectionCard everywhere (11px uppercase muted title + bordered block),
// tolerant field readers so this matches the Shiftmanager table 1:1 (§11 DRY).
function TabAlgemeen({ c }: { c: ReportCandidate }) {
  const { t } = useTranslation('reports')
  const { formatDate, formatDateTime } = useDateFormat()
  const features = featureNamesOf(c)
  const rates: GlobalRate[] = Array.isArray(c.global_rate_summary) ? c.global_rate_summary : []

  return (
    <div className="flex-1 overflow-auto flex flex-col" style={{ padding: '16px 20px', gap: 18 }}>

      <SectionCard title={t('candidateDrawer.sections.contact')}>
        <div style={twoCol}>
          <Field label={t('candidateDrawer.fields.mobile')} value={c.mobile ?? c.phone} />
          <Field label={t('candidateDrawer.fields.email')} value={c.email} />
        </div>
        <div style={{ marginTop: 12 }}>
          <Field label={t('candidateDrawer.fields.city')} value={c.city} />
        </div>
      </SectionCard>

      <SectionCard title={t('candidateDrawer.sections.timeline')}>
        <div style={twoCol}>
          <Field label={t('candidateDrawer.fields.registrationDate')} value={formatDate(c.registration_date)} />
          <Field label={t('candidateDrawer.fields.lastLogin')} value={formatDateTime(c.last_login_at)} />
        </div>
        <div style={{ ...twoCol, marginTop: 12 }}>
          <Field label={t('candidateDrawer.fields.plannedShift')} value={formatDateTime(c.last_planned_shift)} />
          <Field label={t('candidateDrawer.fields.lastShift')} value={formatDateTime(c.last_worked_shift)} />
        </div>
        <div style={{ marginTop: 12 }}>
          <Field label={t('candidateDrawer.fields.endEmployment')} value={formatDate(endDateOf(c))} />
        </div>
      </SectionCard>

      <SectionCard title={t('candidateDrawer.sections.stats')}>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: t('candidateDrawer.stats.worked'), value: c.number_of_times_worked ?? 0 },
            { label: t('candidateDrawer.stats.noShows'), value: noShowCountOf(c) },
            { label: t('candidateDrawer.stats.cancellations'), value: cancellationsOf(c) },
          ].map(stat => (
            <div key={stat.label} className="text-center rounded-lg" style={{ padding: '10px 8px', background: 'var(--hover-bg)' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', fontFamily: 'JetBrains Mono, monospace' }}>{stat.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title={t('candidateDrawer.sections.features')}>
        {features.length === 0
          ? <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
          : (
            <div className="flex flex-wrap gap-1.5">
              {features.map(name => <SoftChip key={name} label={name} color="var(--color-primary)" />)}
            </div>
          )}
      </SectionCard>

      {/* Global role/rates — only when the API actually returned rate rows (structural, not a field). */}
      {rates.length > 0 && (
        <SectionCard title={t('candidateDrawer.sections.globalRole')}>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            {rates.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                padding: '9px 12px', borderBottom: i < rates.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{r.global_rate?.internal_description ?? '—'}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{r.step_name ?? '—'}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {r.hour_rate != null ? `€ ${Number(r.hour_rate).toFixed(2)}` : '—'}
                  </div>
                  {r.is_default_step === 1 && (
                    <div style={{ marginTop: 2, display: 'inline-block' }}>
                      <SoftChip label={t('candidateDrawer.default')} color="var(--color-success)" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

    </div>
  )
}

/* ── Main component ── */
export default function CandidateDetailDrawer({ candidate: c, onClose }: { candidate: ReportCandidate | null; onClose: () => void }) {
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)
  const { t } = useTranslation('reports')
  const [activeTab, setActiveTab] = useState('algemeen')
  if (!c) return null

  // Display name, status colour/label (shared SM palette, never ad-hoc hex — §4) and
  // the reference chip (no dedicated reference_number on this row, so the SM id).
  const fullName = `${c.firstname ?? ''} ${c.lastname ?? ''}`.trim() || t('candidateDrawer.unknownName')
  const statusKey = statusOf(c)
  const statusColor = SM_CANDIDATE_STATUS_COLORS[statusKey] ?? 'var(--text-muted)'
  const statusLabel = c.status ? t(`candidates.status.${statusKey}`, { defaultValue: c.status }) : t('candidates.unknown')

  // Sub-tab config: DrawerTabs (the shared underline bar) renders icon + label per tab.
  const tabItems = [
    { id: 'algemeen', tKey: 'general', icon: undefined },
    { id: 'conversatie', tKey: 'conversation', icon: MessageSquare },
    { id: 'history', tKey: 'history', icon: History },
  ].map(tab => ({
    id: tab.id,
    label: (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        {tab.icon && <tab.icon size={13} />}
        {t(`candidateDrawer.tabs.${tab.tKey}`)}
      </span>
    ),
  }))

  return (
    <>
      <div className="fixed inset-0" style={{ background: 'rgba(0,0,0,0.25)', zIndex: 'var(--z-drawer)' }}
        onClick={onClose} />

      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={fullName} tabIndex={-1}
        className="fixed top-0 bottom-0 right-0 flex flex-col bg-[var(--surface)]"
        style={{ width: 520, zIndex: 'var(--z-drawer)', boxShadow: 'var(--shadow-drawer)', overflow: 'hidden' }}>

        {/* Header region: calm EntityHeader idiom — a top row with only close (no
            expand/label, this overlay has no expand mode), then avatar + name +
            status badge + reference, then the tab bar (§3A). */}
        <div className="flex-shrink-0" style={{ padding: '14px 16px 0', borderBottom: '1px solid var(--border)' }}>
          <div className="flex justify-end" style={{ marginBottom: 8 }}>
            <button onClick={onClose} aria-label={t('common:close')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}>
              <X size={15} />
            </button>
          </div>

          <div className="flex items-start gap-3" style={{ marginBottom: 12 }}>
            <Avatar initials={initialsOf(fullName)} size={44} soft />
            <div className="min-w-0" style={{ flex: 1 }}>
              <div className="flex flex-wrap items-center" style={{ gap: 8 }}>
                <span className="truncate" style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{fullName}</span>
                {/* Colour-coded read-only status badge — never a picker wall (§3A). */}
                <SoftChip label={statusLabel} color={statusColor} round />
                <ReferenceNumberChip value={c.id != null ? String(c.id) : null} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{c.position || '—'}</div>
            </div>
          </div>

          <DrawerTabs tabs={tabItems} active={activeTab} onChange={setActiveTab} />
        </div>

        {/* Tab content */}
        {activeTab === 'algemeen' && <TabAlgemeen c={c} />}
        {activeTab === 'conversatie' && (
          <ComingSoon icon={MessageSquare} title={t('candidateDrawer.conversationComing')}
            desc={t('candidateDrawer.conversationDesc', { name: c.firstname ?? t('candidateDrawer.candidateFallback') })} />
        )}
        {activeTab === 'history' && (
          <ComingSoon icon={History} title={t('candidateDrawer.historyComing')}
            desc={t('candidateDrawer.historyDesc', { name: c.firstname ?? t('candidateDrawer.candidateFallback') })} />
        )}

      </div>
    </>
  )
}
