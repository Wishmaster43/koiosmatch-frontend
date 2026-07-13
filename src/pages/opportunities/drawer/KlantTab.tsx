import { useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Building2, Edit2, Save, X } from 'lucide-react'
import DetailTableJs from '@/components/ui/DetailTable'
import CreatableSelect from '@/components/ui/CreatableSelect'
import SelectMenu from '@/components/ui/SelectMenu'
import { useCustomerCascade } from '../hooks/useCustomerCascade'
import type { Opportunity } from '@/types/opportunity'
import type { Id } from '@/types/common'

type AnyProps = Record<string, unknown>
const DetailTable = DetailTableJs as unknown as ComponentType<AnyProps>

interface KlantCustomer { id: Id; name: string }
type UpdateFn = (id: Id | undefined, patch: Record<string, unknown>) => void

// Titled card wrapper (consistent with the Details tab).
function Card({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{title}</div>
      <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>{children}</div>
    </div>
  )
}

// A labelled field wrapper for the edit-mode cascade selects.
function F({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  )
}

const iconBtn: React.CSSProperties = { width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer' }

/**
 * KlantTab — the customer this opportunity is linked to (klant → locatie → afdeling →
 * contactpersoon). Read-only by default; the pencil opens the same searchable
 * customer picker + dependent location/department/contact cascade the create modal
 * uses (useCustomerCascade), so re-pointing the deal at a different client/location
 * is a single in-place edit — no separate screen. Picking a new client resets the
 * dependent picks (cascade integrity).
 */
export default function KlantTab({ opportunity: o, customers = [], onUpdate }: {
  opportunity: Opportunity; customers?: KlantCustomer[]; onUpdate?: UpdateFn
}) {
  const { t } = useTranslation('opportunities')
  const [editing, setEditing] = useState(false)
  const [customerId,   setCustomerId]   = useState('')
  const [locationId,   setLocationId]   = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [contactId,    setContactId]    = useState('')
  const { locations, contacts } = useCustomerCascade(customerId)
  const departments = locations.find(l => String(l.id) === locationId)?.departments ?? []

  // Seed the draft from the current opportunity when edit mode opens.
  const startEdit = () => {
    setCustomerId(o.clientId != null ? String(o.clientId) : '')
    setLocationId(o.locationId != null ? String(o.locationId) : '')
    setDepartmentId(o.departmentId != null ? String(o.departmentId) : '')
    setContactId(o.contactId != null ? String(o.contactId) : '')
    setEditing(true)
  }
  const cancel = () => setEditing(false)
  const handleCustomerChange = (v: string) => {
    setCustomerId(v)
    setLocationId(''); setDepartmentId(''); setContactId('')
  }
  const handleLocationChange = (v: string) => { setLocationId(v); setDepartmentId('') }

  // Resolve the picked ids back to display names (from the cascade already
  // loaded for this customer) so the optimistic UI update shows the new labels
  // immediately, without waiting on a refetch.
  const save = () => {
    const cust = customers.find(c => String(c.id) === customerId)
    const loc  = locations.find(l => String(l.id) === locationId)
    const dep  = departments.find(d => String(d.id) === departmentId)
    const con  = contacts.find(c => String(c.id) === contactId)
    onUpdate?.(o.id, {
      clientId: customerId || null,     client: cust?.name ?? '',
      locationId: locationId || null,   location: loc?.name ?? '',
      departmentId: departmentId || null, department: dep?.name ?? '',
      contactId: contactId || null,     contact: con?.name ?? '',
    })
    setEditing(false)
  }

  const rows = [
    [t('details.client'),     o.client || '—'],
    [t('details.location'),   o.location || '—'],
    [t('details.department'), o.department || '—'],
    [t('details.contact'),    o.contact || '—'],
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text)' }}>
          <Building2 size={16} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: 14, fontWeight: 700 }}>{o.client || '—'}</span>
        </div>
        {/* In-place edit toggle: pencil → diskette + ✕, same spot (§0.3 pattern). */}
        {onUpdate && (editing ? (
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={save} title={t('common:save')} style={{ ...iconBtn, background: 'var(--color-primary)', color: '#fff', border: 'none' }}><Save size={13} /></button>
            <button onClick={cancel} title={t('common:cancel')} style={{ ...iconBtn, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}><X size={13} /></button>
          </div>
        ) : (
          <button onClick={startEdit} title={t('common:edit')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}><Edit2 size={13} /></button>
        ))}
      </div>

      <Card title={t('drawer.tabs.klant')}>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12 }}>
            <F label={t('details.client')}>
              <CreatableSelect allowCreate={false} value={customerId || null} onChange={handleCustomerChange}
                placeholder={t('common:select')} options={customers.map(c => ({ value: String(c.id), label: c.name }))} />
            </F>
            <F label={t('details.location')}>
              <SelectMenu value={locationId || null} onChange={handleLocationChange}
                placeholder={customerId ? t('common:select') : t('pickClientFirst')}
                options={locations.map(l => ({ value: String(l.id), label: l.name ?? '—' }))} />
            </F>
            <F label={t('details.department')}>
              <SelectMenu value={departmentId || null} onChange={setDepartmentId}
                placeholder={customerId ? t('common:select') : t('pickClientFirst')}
                options={departments.map(d => ({ value: String(d.id), label: d.name ?? '—' }))} />
            </F>
            <F label={t('details.contact')}>
              <SelectMenu value={contactId || null} onChange={setContactId}
                placeholder={customerId ? t('common:select') : t('pickClientFirst')}
                options={contacts.map(c => ({ value: String(c.id), label: c.name ?? '—' }))} />
            </F>
          </div>
        ) : (
          <DetailTable rows={rows} lastBorder={false} />
        )}
      </Card>
    </div>
  )
}
