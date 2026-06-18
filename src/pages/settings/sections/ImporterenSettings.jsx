/** ImporterenSettings — CSV import wizard (entity type → upload → map → done). */
import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, CloudUpload, X, Users, FileText, Briefcase } from 'lucide-react'

const IMPORT_TYPES = [
  { id: 'candidates', icon: Users },
  { id: 'cvs',        icon: FileText },
  { id: 'vacancies',  icon: Briefcase },
]

export default function ImporterenSettings() {
  const { t } = useTranslation('settings')
  const [type,   setType]   = useState('candidates')
  const [step,   setStep]   = useState(1)
  const [file,   setFile]   = useState(null)
  const [drag,   setDrag]   = useState(false)
  const fileRef = useRef(null)

  const TOTAL_STEPS = 4
  const typeLabel = t(`import.types.${type}`)

  const handleDrop = (e) => {
    e.preventDefault(); setDrag(false)
    const f = e.dataTransfer.files?.[0]
    if (f) { setFile(f); setStep(2) }
  }

  const handleFile = (e) => {
    const f = e.target.files?.[0]
    if (f) { setFile(f); setStep(2) }
  }

  const reset = () => { setFile(null); setStep(1) }

  return (
    <div style={{ display: 'flex', gap: 0, minHeight: 400 }}>
      {/* Sub-nav */}
      <div style={{ width: 200, flexShrink: 0, borderRight: '1px solid #F3F4F6', paddingRight: 16, marginRight: 32 }}>
        {IMPORT_TYPES.map(it => {
          const Icon = it.icon
          const active = type === it.id
          return (
            <button key={it.id} onClick={() => { setType(it.id); reset() }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                       borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, textAlign: 'left',
                       fontWeight: active ? 600 : 400, marginBottom: 2,
                       background: active ? 'var(--color-primary-bg)' : 'transparent',
                       color: active ? 'var(--color-primary)' : '#374151' }}>
              <Icon size={14} style={{ color: active ? 'var(--color-primary)' : '#9CA3AF' }} />
              {t(`import.types.${it.id}`)}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div style={{ flex: 1 }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>{t('import.title', { type: typeLabel })}</h2>
          <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{t('import.subtitle', { type: typeLabel.toLowerCase() })}</p>
        </div>

        <div style={{ background: 'white', border: '1px solid #F3F4F6', borderRadius: 12, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{t('import.fileTitle')}</div>
              <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{t('import.step', { step, total: TOTAL_STEPS })}</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setStep(s => Math.max(1, s-1))} disabled={step === 1}
                style={{ height: 34, padding: '0 16px', fontSize: 13, border: '1px solid #E5E7EB', borderRadius: 8, background: 'white', cursor: step === 1 ? 'not-allowed' : 'pointer', color: step === 1 ? '#D1D5DB' : '#374151' }}>
                {t('common.back')}
              </button>
              <button onClick={() => { if (step === 1 && !file) { fileRef.current?.click(); return } setStep(s => Math.min(TOTAL_STEPS, s+1)) }}
                disabled={step === TOTAL_STEPS}
                style={{ height: 34, padding: '0 16px', fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 8, background: 'var(--color-primary)', color: 'white', cursor: step === TOTAL_STEPS ? 'not-allowed' : 'pointer', opacity: step === TOTAL_STEPS ? 0.5 : 1 }}>
                {t('common.next')}
              </button>
            </div>
          </div>

          {step === 1 && (
            <div
              onDragOver={e => { e.preventDefault(); setDrag(true) }}
              onDragLeave={() => setDrag(false)}
              onDrop={handleDrop}
              style={{ border: `2px dashed ${drag ? 'var(--color-primary)' : '#E5E7EB'}`, borderRadius: 10,
                       minHeight: 200, display: 'flex', flexDirection: 'column', alignItems: 'center',
                       justifyContent: 'center', gap: 12, cursor: 'pointer', background: drag ? 'var(--color-primary-bg)' : '#FAFAFA',
                       transition: 'all 0.15s' }}
              onClick={() => fileRef.current?.click()}>
              <CloudUpload size={32} style={{ color: '#9CA3AF' }} />
              <span style={{ fontSize: 13, color: '#6B7280' }}>{t('import.dropHere')}</span>
              <button onClick={e => { e.stopPropagation(); fileRef.current?.click() }}
                style={{ height: 34, padding: '0 16px', fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 8, background: 'var(--color-primary)', color: 'white', cursor: 'pointer' }}>
                {t('import.selectCsv')}
              </button>
              <input ref={fileRef} type="file" accept=".csv,.xlsx" style={{ display: 'none' }} onChange={handleFile} />
            </div>
          )}

          {step === 2 && (
            <div style={{ padding: '20px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, marginBottom: 16 }}>
                <Check size={14} style={{ color: 'var(--color-success)' }} />
                <span style={{ fontSize: 13, color: '#166534', fontWeight: 500 }}>{file?.name}</span>
                <button onClick={reset} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}><X size={13} /></button>
              </div>
              <p style={{ fontSize: 13, color: '#6B7280' }}>{t('import.fileSelected')}</p>
            </div>
          )}

          {step === 3 && (
            <div style={{ padding: '20px 0' }}>
              <p style={{ fontSize: 13, color: '#374151', marginBottom: 12 }}>{t('import.mapColumns')}</p>
              <p style={{ fontSize: 12, color: '#9CA3AF' }}>{t('import.mapColumnsHint')}</p>
            </div>
          )}

          {step === 4 && (
            <div style={{ padding: '20px 0', textAlign: 'center' }}>
              <Check size={40} style={{ color: 'var(--color-success)', margin: '0 auto 12px' }} />
              <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 6 }}>{t('import.doneTitle')}</p>
              <p style={{ fontSize: 13, color: '#9CA3AF' }}>{t('import.doneDesc')}</p>
              <button onClick={reset} style={{ marginTop: 16, height: 34, padding: '0 16px', fontSize: 13, border: '1px solid #E5E7EB', borderRadius: 8, background: 'white', cursor: 'pointer' }}>{t('import.newImport')}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
