/**
 * LocationDrawer — slide-in detail panel for one location: hero (name + customer
 * + status), the linked customer card, contact details, two stat cards and the
 * department list. Pure presentation; the location is passed in from LocationsPage.
 */
import { useTranslation } from 'react-i18next'
import { MapPin, Building2, Layers, X, Phone, Mail, ChevronRight } from 'lucide-react'
import { PageTitle, Caption, BodyText, GroupLabel, SectionTitle } from '@/components/ui/typography'
import Button from '@/components/ui/Button'
import { Avatar, StatusBadge, ac } from './locationParts'
import type { SmLocationRow } from '@/types/shiftmanager'
import ChangelogPopover from '@/components/drawer/ChangelogPopover'
import EntityChangelog from '@/components/drawer/EntityChangelog'
import CopyIconButton from '@/components/ui/CopyIconButton'

// The read-only location detail slide-in; renders nothing without a location.
export default function LocationDrawer({ loc, onClose }: { loc: SmLocationRow | null; onClose: () => void }) {
  const { t } = useTranslation('shiftmanager')
  if (!loc) return null
  const deps = loc.departments ?? []

  return (
    <div style={{ width: 380, flexShrink: 0, borderLeft: '1px solid var(--border)',
      background: 'var(--surface)', display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <PageTitle as="span">{t('locationsPage.drawerTitle')}</PageTitle>
        {/* §3A(d): record history is a changelog icon-popover in the title row, never a tab. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {loc.id !== undefined && (
            <ChangelogPopover><EntityChangelog subjectType="Location" subjectId={loc.id} /></ChangelogPopover>
          )}
          <Button variant="ghost" iconOnly onClick={onClose} aria-label={t('common:close')}>
            <X size={16} />
          </Button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

        {/* Hero */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 24 }}>
          <Avatar label={loc.name} size={52} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <PageTitle as="div" style={{ lineHeight: 1.35, marginBottom: 4 }}>{loc.name}</PageTitle>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Building2 size={12} color="var(--text-muted)" />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{loc.customer}</span>
            </div>
          </div>
          <StatusBadge status={loc.status} />
        </div>

        {/* Klant koppeling */}
        <div style={{ background: 'var(--hover-bg)', borderRadius: 10, padding: '14px 16px', marginBottom: 20,
          border: '1px solid var(--border)' }}>
          <GroupLabel style={{ marginBottom: 10 }}>{t('locationsPage.drawer.customer')}</GroupLabel>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: ac(loc.customer),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 800, color: 'var(--surface)', flexShrink: 0 }}>
              {loc.customer?.charAt(0)}
            </div>
            <div>
              <BodyText style={{ fontWeight: 600 }}>{loc.customer}</BodyText>
              <Caption>{t('locationsPage.drawer.linkedCustomer')}</Caption>
            </div>
            <ChevronRight size={14} color="var(--text-muted)" style={{ marginLeft: 'auto' }} />
          </div>
        </div>

        {/* Contact details */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>{t('locationsPage.drawer.contactDetails')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--hover-bg)', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' }}>
                <MapPin size={14} color="var(--text-muted)" />
              </div>
              <div>
                <Caption>{t('locationsPage.drawer.address')}</Caption>
                {/* ADRES-KOPIEER canon: every address display carries the shared copy button. */}
                <BodyText style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{loc.address}, {loc.city}</span>
                  <CopyIconButton value={`${loc.address}, ${loc.city}`} label={t('common:copyAddress.copy')} copiedLabel={t('common:copyAddress.copied')} />
                </BodyText>
              </div>
            </div>
            {loc.phone && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--hover-bg)', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' }}>
                  <Phone size={14} color="var(--text-muted)" />
                </div>
                <div>
                  <Caption>{t('locationsPage.drawer.phone')}</Caption>
                  <BodyText>{loc.phone}</BodyText>
                </div>
              </div>
            )}
            {loc.email && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--hover-bg)', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' }}>
                  <Mail size={14} color="var(--text-muted)" />
                </div>
                <div>
                  <Caption>{t('locationsPage.drawer.email')}</Caption>
                  <BodyText>{loc.email}</BodyText>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {[
            { label: t('locationsPage.drawer.departments'),  value: deps.length, icon: Layers, color: 'var(--color-primary-text)', bg: 'var(--color-primary-bg)' },
            { label: t('locationsPage.drawer.activeShifts'), value: loc.shifts, icon: Building2, color: 'var(--color-success-text)', bg: 'var(--color-success-bg)' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: s.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <s.icon size={15} color={s.color} />
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{s.value}</div>
                <Caption as="div" style={{ marginTop: 2 }}>{s.label}</Caption>
              </div>
            </div>
          ))}
        </div>

        {/* Afdelingen — read-only list (this is a ShiftManager mirror, §3B: no
            add/edit control here, /sm_locations has no write route to back one). */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <SectionTitle as="span">{t('locationsPage.drawer.departments')}</SectionTitle>
            <Caption as="span" style={{ background: 'var(--hover-bg)',
              padding: '1px 7px', borderRadius: 999 }}>{deps.length}</Caption>
          </div>
          {deps.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {deps.map((dep, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                  background: 'var(--hover-bg)', borderRadius: 8, border: '1px solid var(--border)',
                  cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--color-primary-bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--hover-bg)'}>
                  <Layers size={13} color="var(--text-muted)" />
                  <BodyText as="span" style={{ flex: 1 }}>{dep}</BodyText>
                  <ChevronRight size={13} color="var(--text-muted)" />
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13,
              background: 'var(--hover-bg)', borderRadius: 8, border: '1px dashed var(--border)' }}>
              {t('locationsPage.drawer.noDepartments')}
            </div>
          )}
        </div>
      </div>
      {/* No footer edit action (§3/§3B): /sm_locations is a read-only ShiftManager
          mirror with no write route — the old "Edit" button never persisted anything. */}
    </div>
  )
}
