import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit2, Save, X } from 'lucide-react'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { useFunctions } from '@/lib/useFunctions'

const iconBtn = { width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer' } as const
const inputStyle = { width: '100%', padding: '7px 10px', fontSize: 13, fontWeight: 600, borderRadius: 6,
  border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', boxSizing: 'border-box' as const, outline: 'none' }

export interface CandidateNamePatch { firstname: string; lastname: string; title: string }

/**
 * CandidateNameFunctionBlock — S32: candidate name + function, editable in place
 * right on the Sollicitatie tab (house pencil), so a recruiter doesn't have to
 * open the Kandidaat tab for a quick correction. The parent PATCHes the
 * CANDIDATE endpoint (first_name/last_name/function_title) via `onSave`; the
 * pencil is hidden entirely when the caller passes no `onSave` — the same
 * optional-callback permission gate ApplicationTab already uses for onLinkVacancy.
 *
 * GET /candidates/{id} never returns first_name/last_name separately (only the
 * computed full `name`) — so, exactly like the candidate drawer's own header
 * editor (useCandidateHeaderEdit), this seeds the two inputs by naively
 * splitting `name` on its first/last space. A compound first or last name can
 * split wrong; that is an existing, accepted limitation of that same house
 * pattern, not a new one introduced here.
 */
export default function CandidateNameFunctionBlock({ name, func, onSave }: {
  name: string; func: string; onSave?: (patch: CandidateNamePatch) => void
}) {
  const { t } = useTranslation(['applications', 'common'])
  const { functions, allowFreeEntry } = useFunctions()
  const [editing, setEditing] = useState(false)
  const [firstname, setFirstname] = useState('')
  const [lastname, setLastname] = useState('')
  const [title, setTitle] = useState('')

  // Enter edit: seed from the current display values (best-effort name split).
  const startEdit = () => {
    const parts = name.trim().split(/\s+/).filter(Boolean)
    setFirstname(parts[0] ?? '')
    setLastname(parts.length > 1 ? parts.slice(-1)[0] : '')
    setTitle(func)
    setEditing(true)
  }
  const cancelEdit = () => setEditing(false)
  const saveEdit = () => { onSave?.({ firstname, lastname, title }); setEditing(false) }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 8, minHeight: 26 }}>
        {/* In-place edit toggle: pencil → diskette + ✕, same spot (§0.3 pattern). */}
        {onSave && (editing ? (
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={saveEdit} title={t('common:save')} aria-label={t('common:save')}
              style={{ ...iconBtn, background: 'var(--color-primary)', color: '#fff', border: 'none' }}><Save size={13} /></button>
            <button onClick={cancelEdit} title={t('common:cancel')} aria-label={t('common:cancel')}
              style={{ ...iconBtn, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}><X size={13} /></button>
          </div>
        ) : (
          <button onClick={startEdit} title={t('common:edit')} aria-label={t('common:edit')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}><Edit2 size={13} /></button>
        ))}
      </div>
      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{t('drawer.candidateFields.firstName')}</div>
              <input value={firstname} onChange={e => setFirstname(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{t('drawer.candidateFields.lastName')}</div>
              <input value={lastname} onChange={e => setLastname(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{t('drawer.candidateFields.function')}</div>
            <CreatableSelect value={title} options={functions} onChange={setTitle}
              allowCreate={allowFreeEntry} placeholder={t('drawer.candidateFields.function')} />
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{t('drawer.candidateFields.name')}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{name || '—'}</div>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{t('drawer.candidateFields.function')}</div>
            <div style={{ fontSize: 13, color: 'var(--text)' }}>{func || '—'}</div>
          </div>
        </div>
      )}
    </div>
  )
}
