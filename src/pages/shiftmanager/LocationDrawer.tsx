/**
 * LocationDrawer — slide-in detail panel for one location: hero (name + customer
 * + status), the linked customer card, contact details, two stat cards and the
 * department list. Pure presentation; the location is passed in from LocationsPage.
 */
import { useTranslation } from 'react-i18next'
import { MapPin, Building2, Layers, X, Phone, Mail, ChevronRight, Plus } from 'lucide-react'
import { Avatar, StatusBadge, ac } from './locationParts'
import type { SmLocationRow } from '@/types/shiftmanager'

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
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{t('locationsPage.drawerTitle')}</span>
        <button onClick={onClose} aria-label={t('common:close')} style={{ background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', display: 'flex', padding: 4, borderRadius: 6 }}>
          <X size={16} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

        {/* Hero */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 24 }}>
          <Avatar label={loc.name} size={52} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', lineHeight: 1.35, marginBottom: 4 }}>{loc.name}</div>
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
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em',
            textTransform: 'uppercase', marginBottom: 10 }}>{t('locationsPage.drawer.customer')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: ac(loc.customer),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 800, color: 'var(--surface)', flexShrink: 0 }}>
              {loc.customer?.charAt(0)}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{loc.customer}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('locationsPage.drawer.linkedCustomer')}</div>
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
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('locationsPage.drawer.address')}</div>
                <div style={{ fontSize: 13, color: 'var(--text)' }}>{loc.address}, {loc.city}</div>
              </div>
            </div>
            {loc.phone && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--hover-bg)', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' }}>
                  <Phone size={14} color="var(--text-muted)" />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('locationsPage.drawer.phone')}</div>
                  <div style={{ fontSize: 13, color: 'var(--text)' }}>{loc.phone}</div>
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
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('locationsPage.drawer.email')}</div>
                  <div style={{ fontSize: 13, color: 'var(--text)' }}>{loc.email}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {[
            { label: t('locationsPage.drawer.departments'),  value: deps.length, icon: Layers, color: 'var(--color-primary)', bg: 'var(--color-primary-bg)' },
            { label: t('locationsPage.drawer.activeShifts'), value: loc.shifts, icon: Building2, color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: s.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <s.icon size={15} color={s.color} />
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Afdelingen */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{t('locationsPage.drawer.departments')}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--hover-bg)',
                padding: '1px 7px', borderRadius: 999 }}>{deps.length}</span>
            </div>
            <button style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--color-primary)',
              background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <Plus size={12} /> {t('locationsPage.drawer.add')}
            </button>
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
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{dep}</span>
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

      {/* Footer */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <button style={{ width: '100%', padding: '9px', fontSize: 13, fontWeight: 500,
          borderRadius: 8, border: '1px solid var(--color-primary)', background: 'var(--color-primary-bg)',
          color: 'var(--color-primary)', cursor: 'pointer' }}>
          {t('locationsPage.drawer.edit')}
        </button>
      </div>
    </div>
  )
}
