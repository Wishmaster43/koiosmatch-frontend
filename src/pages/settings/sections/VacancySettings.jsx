import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2 } from 'lucide-react'
import api from '../../../lib/api'
import StatusListEditor from './StatusListEditor'

export default function VacancySettings() {
  const { t } = useTranslation('settings')
  const [customFields, setCustomFields] = useState([])
  const [newField,     setNewField]     = useState('')
  const [addingField,  setAddingField]  = useState(false)

  const addField = async () => {
    if (!newField.trim()) return
    setAddingField(true)
    try {
      const res = await api.post('/vacancy-custom-fields', { name: newField.trim() })
      setCustomFields(p => [...p, res.data])
      setNewField('')
    } catch { /* noop */ } finally { setAddingField(false) }
  }

  useEffect(() => {
    api.get('/vacancy-custom-fields').then(r => setCustomFields(r.data?.data ?? r.data ?? [])).catch(() => {})
  }, [])

  return (
    <div>
      <StatusListEditor title={t('vacancy.title')} subtitle={t('vacancy.subtitle')} endpoint="/vacancy-statuses" addLabel={t('vacancy.add')} withColor />

      <div style={{ marginTop: 32, maxWidth: 640 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 4 }}>{t('vacancy.customFields')}</h3>
        <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 14 }}>{t('vacancy.customFieldsHint')}</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {customFields.map((f, i) => (
            <div key={f.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'white', border: '1px solid #F3F4F6', borderRadius: 8 }}>
              <span style={{ flex: 1, fontSize: 13, color: '#111827' }}>{f.name}</span>
              <button onClick={async () => { await api.delete(`/vacancy-custom-fields/${f.id}`); setCustomFields(p => p.filter(x => x.id !== f.id)) }}
                style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FEF2F2', border: 'none', borderRadius: 6, cursor: 'pointer', color: 'var(--color-danger)' }}>
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={addField} disabled={addingField}
            style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #D1D5DB', borderRadius: 6, background: 'white', cursor: 'pointer', color: '#9CA3AF' }}>
            <Plus size={14} />
          </button>
          <input value={newField} onChange={e => setNewField(e.target.value)} placeholder={t('vacancy.fieldPlaceholder')}
            onKeyDown={e => e.key === 'Enter' && addField()}
            style={{ height: 32, padding: '0 10px', fontSize: 13, border: '1px solid #E5E7EB', borderRadius: 7, outline: 'none', color: '#111827' }} />
        </div>
      </div>
    </div>
  )
}
