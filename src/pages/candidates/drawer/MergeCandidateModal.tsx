/**
 * MergeCandidateModal — absorb a duplicate candidate into a survivor (Danny punt 4:
 * the backend merge existed, the UI never did). Step 1: search the duplicate
 * (name/number/email so lookalikes are tellable apart). Step 2: choose which of
 * the two records REMAINS; the other is absorbed and archived (soft-delete,
 * server-side C-29). Calls POST /candidates/{survivor}/merge and hands the
 * survivor id back to the page, which reopens it fresh.
 */
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { Search, GitMerge, Loader2 } from 'lucide-react'
import api, { unwrapList } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { BTN_H } from '@/config/buttonMetrics'
import type { Id } from '@/types/common'

interface LiteCandidate { id: Id; name: string; code?: string; email?: string }

// Minimal list-row shape from GET /candidates (only the fields this picker shows).
interface ApiRow { id: Id; first_name?: string; last_name?: string; name?: string; reference_number?: string; email?: string }
const rowToLite = (r: ApiRow): LiteCandidate => ({
  id: r.id,
  name: r.name ?? [r.first_name, r.last_name].filter(Boolean).join(' '),
  code: r.reference_number ?? undefined,
  email: r.email ?? undefined,
})

export default function MergeCandidateModal({ current, onClose, onMerged }: {
  current: LiteCandidate
  onClose: () => void
  onMerged: (survivorId: Id) => void
}) {
  const { t } = useTranslation('candidates')
  const queryClient = useQueryClient()
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)

  // Step 1: debounced duplicate search (excluding the open candidate itself).
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LiteCandidate[]>([])
  const [searching, setSearching] = useState(false)
  const [other, setOther] = useState<LiteCandidate | null>(null)
  // Step 2: which record remains — default: the candidate that is open now.
  const [survivorId, setSurvivorId] = useState<Id>(current.id)
  const [merging, setMerging] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (other) return // picker collapsed once a duplicate is chosen
    const q = query.trim()
    if (q.length < 2) { setResults([]); return }
    clearTimeout(debounceRef.current)
    const ctrl = new AbortController()
    debounceRef.current = setTimeout(() => {
      setSearching(true)
      api.get('/candidates', { params: { search: q, per_page: 8 }, signal: ctrl.signal })
        .then(res => setResults((unwrapList(res).rows as ApiRow[]).map(rowToLite).filter(c => String(c.id) !== String(current.id))))
        .catch(() => {})
        .finally(() => setSearching(false))
    }, 300)
    return () => { clearTimeout(debounceRef.current); ctrl.abort() }
  }, [query, other, current.id])

  // Fire the merge; the response is the merged detail but the page refetches itself.
  const confirm = async () => {
    if (!other || merging) return
    const survivor = survivorId
    const source = String(survivorId) === String(current.id) ? other.id : current.id
    setMerging(true)
    try {
      await api.post(`/candidates/${survivor}/merge`, { source_id: source })
      // List + stats caches now hold a soft-deleted source row — refetch everything.
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
      notifySuccess(t('merge.done'))
      onMerged(survivor)
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      notifyError(status === 403 ? t('merge.errForbidden') : t('merge.errFailed'))
      setMerging(false)
    }
  }

  const inputStyle: CSSProperties = { width: '100%', height: 34, padding: '0 10px 0 30px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--input-bg)', color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }

  // One selectable "which record remains" card per side.
  const survivorCard = (c: LiteCandidate, isCurrent: boolean) => {
    const active = String(survivorId) === String(c.id)
    return (
      <button type="button" key={String(c.id)} onClick={() => setSurvivorId(c.id)} aria-pressed={active}
        style={{ flex: 1, textAlign: 'left', padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
          border: `1px solid ${active ? 'var(--color-primary)' : 'var(--border)'}`,
          background: active ? 'var(--color-primary-bg)' : 'var(--surface)' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{c.name}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>{c.code ?? '—'}</div>
        {c.email && <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.email}</div>}
        <div style={{ fontSize: 10, marginTop: 4, fontWeight: active ? 600 : 400, color: active ? 'var(--color-primary)' : 'var(--text-muted)' }}>
          {active ? t('merge.stays') : (isCurrent ? t('merge.thisRecord') : t('merge.otherRecord'))}
        </div>
      </button>
    )
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={t('merge.title')} tabIndex={-1}
        onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 12, padding: 20, width: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
          <GitMerge size={15} /> {t('merge.title')}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 12 }}>{t('merge.intro', { name: current.name })}</div>

        {/* Step 1 — find the duplicate. */}
        {!other && (
          <>
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
                placeholder={t('merge.searchPlaceholder')} aria-label={t('merge.searchPlaceholder')} style={inputStyle} />
            </div>
            <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {searching && <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 6 }}>{t('merge.searching')}</div>}
              {!searching && query.trim().length >= 2 && results.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', padding: 6 }}>{t('merge.noResults')}</div>
              )}
              {results.map(c => (
                <button key={String(c.id)} type="button" onClick={() => setOther(c)}
                  style={{ textAlign: 'left', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer' }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{c.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8, fontFamily: "'JetBrains Mono', monospace" }}>{c.code ?? ''}</span>
                  {c.email && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>{c.email}</span>}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Step 2 — choose the survivor + danger summary. */}
        {other && (
          <>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              {survivorCard(current, true)}
              {survivorCard(other, false)}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-danger)', background: 'var(--color-danger-bg)', border: '1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)', borderRadius: 8, padding: '8px 10px', lineHeight: 1.5, marginBottom: 12 }}>
              {t('merge.warning', { source: String(survivorId) === String(current.id) ? other.name : current.name })}
            </div>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          {other
            ? <button type="button" onClick={() => { setOther(null); setSurvivorId(current.id) }}
                style={{ height: BTN_H, padding: '0 12px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}>
                {t('merge.back')}
              </button>
            : <span />}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={onClose}
              style={{ height: BTN_H, padding: '0 12px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}>
              {t('merge.cancel')}
            </button>
            <button type="button" onClick={confirm} disabled={!other || merging}
              style={{ display: 'flex', alignItems: 'center', gap: 6, height: BTN_H, padding: '0 14px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 8,
                background: 'var(--color-danger)', color: '#fff', cursor: !other || merging ? 'not-allowed' : 'pointer', opacity: !other || merging ? 0.5 : 1 }}>
              {merging ? <Loader2 size={13} className="animate-spin" /> : <GitMerge size={13} />} {t('merge.confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
