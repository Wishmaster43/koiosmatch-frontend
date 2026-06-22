import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import api, { unwrapList } from '../../lib/api'
import { Field, TextField, SelectField, DateField, TextArea } from '../../components/forms/fields'
import { useTaskLookups } from '../../context/TaskLookupsContext'
import { useAuth } from '../../context/AuthContext'
import { useUsers } from '../../lib/queries'

const MAX_DESC = 5000

// Tolerant display name for the linked-entity option lists.
const nameOf = (r) => r.name || [r.first_name, r.last_name].filter(Boolean).join(' ') || r.title || r.email || `#${r.id}`
const userName = (u) => u.name || [u.firstname, u.lastname].filter(Boolean).join(' ') || u.email || '—'

/**
 * AddTaskModal — the "Toevoegen activiteit" dialog. All option lists come from
 * tenant lookups (type/status/priority) or live endpoints (assignee=/users,
 * candidate/customer/contact pickers) — nothing hardcoded. On save it POSTs the
 * task with its polymorphic `links[]` and hands the created row back to the page.
 */
export default function AddTaskModal({ onClose, onCreated }) {
  const { t } = useTranslation('tasks')
  const { types, statuses, priorities, defaultPriority } = useTaskLookups()
  const { data: users = [] } = useUsers()
  const { user } = useAuth()
  const ownerName = user ? userName(user) : ''

  const [form, setForm] = useState({
    type: '', title: '', assigneeId: '', status: '', due: '', priority: '', description: '',
    candidateId: '', customerId: '', contactId: '',
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  // Linked-entity option lists (loaded once; empty/404 keeps the picker empty).
  const [candidates, setCandidates] = useState([])
  const [customers,  setCustomers]  = useState([])
  const [contacts,   setContacts]   = useState([])

  // Seed sensible defaults once the lookups arrive (first status + default priority).
  useEffect(() => {
    setForm(f => ({ ...f,
      status:   f.status   || statuses[0]?.value || '',
      priority: f.priority || defaultPriority || '',
      type:     f.type     || types[0]?.value || '' }))
  }, [statuses, priorities, types, defaultPriority])

  // Load the link pickers; each is independent and tolerates a missing endpoint.
  useEffect(() => {
    const load = (url, set) => api.get(url).then(r => set(unwrapList(r).rows)).catch(() => {})
    load('/candidates', setCandidates); load('/customers', setCustomers); load('/contacts', setContacts)
  }, [])

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); if (errors[k]) setErrors(e => ({ ...e, [k]: false })) }
  const toOptions = (rows) => rows.map(r => ({ value: String(r.id), label: nameOf(r) }))

  const handleSubmit = async () => {
    const e = {}
    if (!form.title.trim()) e.title = true
    if (!form.type)         e.type  = true
    if (Object.keys(e).length) { setErrors(e); return }

    // Build the polymorphic links from the chosen entities.
    const links = [
      form.candidateId && { type: 'candidate', id: form.candidateId },
      form.customerId  && { type: 'customer',  id: form.customerId },
      form.contactId   && { type: 'contact',   id: form.contactId },
    ].filter(Boolean)

    setSaving(true)
    try {
      const body = {
        title: form.title.trim(), type: form.type, status: form.status, priority: form.priority || null,
        assignee_id: form.assigneeId || null, due_date: form.due || null,
        description: form.description || null, links,
      }
      const r = await api.post('/tasks', body)
      onCreated?.(r.data?.data ?? r.data)
    } catch { /* surfaced via the page; keep the modal open on failure */ } finally { setSaving(false) }
  }

  const assigneeOpts = [{ value: '', label: t('modal.assigneePlaceholder') }, ...users.map(u => ({ value: String(u.id), label: userName(u) }))]
  const canSubmit = form.title.trim() && form.type && !saving

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 880,
        boxShadow: '0 20px 60px rgba(0,0,0,0.22)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>

        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex',
          alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{t('modal.title')}</span>
          <button onClick={onClose} aria-label={t('modal.cancel')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Body: main form + details panel */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', minHeight: 0 }}>
          {/* Main form */}
          <div style={{ flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
            <Field label={t('modal.type')} required>
              <SelectField value={form.type} onChange={v => set('type', v)} placeholder={t('modal.typePlaceholder')}
                options={types.map(x => ({ value: x.value, label: x.label }))} style={errors.type ? { borderColor: 'var(--color-danger)' } : {}} />
            </Field>
            <Field label={t('modal.titleLabel')} required>
              <TextField value={form.title} onChange={v => set('title', v)} placeholder={t('modal.titlePlaceholder')} error={errors.title} />
            </Field>
            <Field label={t('modal.assignee')}>
              <SelectField value={form.assigneeId} onChange={v => set('assigneeId', v)} options={assigneeOpts} />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label={t('modal.status')}>
                <SelectField value={form.status} onChange={v => set('status', v)} options={statuses.map(x => ({ value: x.value, label: x.label }))} />
              </Field>
              <Field label={t('modal.priority')}>
                <SelectField value={form.priority} onChange={v => set('priority', v)} options={priorities.map(x => ({ value: x.value, label: x.label }))} />
              </Field>
            </div>
            <Field label={t('modal.due')}>
              <DateField value={form.due} onChange={v => set('due', v)} placeholder="dd-mm-jjjj" />
            </Field>
            <Field label={t('modal.description')}>
              <TextArea value={form.description} onChange={v => set('description', v.slice(0, MAX_DESC))} rows={4} placeholder={t('modal.descriptionPlaceholder')} />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{t('modal.charsLeft', { count: MAX_DESC - form.description.length })}</div>
            </Field>
          </div>

          {/* Details panel: owner (read-only) + link pickers */}
          <div style={{ width: 300, flexShrink: 0, borderLeft: '1px solid var(--border)', background: 'var(--bg)',
            padding: '20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{t('modal.detailsTitle')}</div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{t('modal.owner')}</div>
              <div style={{ fontSize: 13, color: 'var(--text)' }}>{ownerName || '—'}</div>
            </div>
            <Field label={t('modal.candidate')}>
              <SelectField value={form.candidateId} onChange={v => set('candidateId', v)} placeholder={t('modal.candidatePlaceholder')} options={toOptions(candidates)} />
            </Field>
            <Field label={t('modal.customer')}>
              <SelectField value={form.customerId} onChange={v => set('customerId', v)} placeholder={t('modal.customerPlaceholder')} options={toOptions(customers)} />
            </Field>
            <Field label={t('modal.contact')}>
              <SelectField value={form.contactId} onChange={v => set('contactId', v)} placeholder={t('modal.contactPlaceholder')} options={toOptions(contacts)} />
            </Field>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', flexShrink: 0,
          display: 'flex', justifyContent: 'flex-end', gap: 8, background: 'var(--bg)' }}>
          <button onClick={onClose}
            style={{ padding: '8px 16px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)',
              background: 'none', color: 'var(--text)', cursor: 'pointer' }}>
            {t('modal.cancel')}
          </button>
          <button onClick={handleSubmit} disabled={!canSubmit}
            style={{ padding: '8px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none',
              background: canSubmit ? 'var(--color-primary)' : '#E5E7EB', color: canSubmit ? '#fff' : '#9CA3AF',
              cursor: canSubmit ? 'pointer' : 'not-allowed' }}>
            {saving ? t('modal.saving') : t('modal.create')}
          </button>
        </div>
      </div>
    </div>
  )
}
