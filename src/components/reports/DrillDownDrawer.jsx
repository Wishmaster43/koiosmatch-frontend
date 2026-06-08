import { X, Search, Phone, Mail, Calendar, Briefcase } from 'lucide-react'
import { useState } from 'react'

function StatusBadge({ status }) {
  const styles = {
    actief:     { bg: '#F0FDF4', color: '#16A34A' },
    nietactief: { bg: '#FFF7ED', color: '#C2410C' },
    extern:     { bg: '#EFF6FF', color: '#1D4ED8' },
    intake:     { bg: '#FAF5FF', color: '#7C3AED' },
    verwijderd: { bg: '#FEF2F2', color: '#DC2626' },
  }
  const s = styles[status?.toLowerCase()] || { bg: '#F9FAFB', color: '#6B7280' }
  return (
    <span className="rounded-full px-2 py-0.5 text-xs font-medium flex-shrink-0"
      style={{ background: s.bg, color: s.color }}>
      {status || 'onbekend'}
    </span>
  )
}

function formatDate(dateStr) {
  if (!dateStr) return null
  return new Date(dateStr).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function DrillDownDrawer({ title, subtitle, candidates = [], onClose }) {
  const [search, setSearch] = useState('')

  const filtered = candidates.filter(c => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      `${c.firstname} ${c.lastname}`.toLowerCase().includes(q) ||
      (c.position || '').toLowerCase().includes(q) ||
      (c.mobile || '').includes(q) ||
      (c.email || '').toLowerCase().includes(q)
    )
  })

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.25)' }} onClick={onClose} />

      <div className="fixed top-0 bottom-0 right-0 z-50 flex flex-col bg-white"
        style={{ width: 520, boxShadow: '-4px 0 30px rgba(0,0,0,0.12)' }}>

        {/* Header */}
        <div className="flex items-start justify-between flex-shrink-0"
          style={{ padding: '16px 20px', borderBottom: '1px solid #F3F4F6' }}>
          <div>
            <div className="font-semibold text-gray-900" style={{ fontSize: 15 }}>{title}</div>
            <div className="text-sm text-gray-400 mt-0.5">
              {candidates.length} kandidaten
              {subtitle && <span className="ml-1 text-gray-300">· {subtitle}</span>}
            </div>
          </div>
          <button onClick={onClose}
            className="flex items-center justify-center flex-shrink-0 rounded-lg"
            style={{ width: 30, height: 30, background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', marginLeft: 12 }}
            onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
            <X size={16} />
          </button>
        </div>

        {/* Zoek */}
        <div className="flex-shrink-0 px-4 py-3" style={{ borderBottom: '1px solid #F9FAFB' }}>
          <div className="flex items-center gap-2 px-3 rounded-lg"
            style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
            <Search size={13} color="#9CA3AF" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Zoek op naam, functie, mobiel of e-mail..."
              className="flex-1 py-2 text-gray-700 bg-transparent outline-none"
              style={{ border: 'none', fontSize: 12 }}
            />
          </div>
        </div>

        {/* Lijst */}
        <div className="flex-1 overflow-auto">
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-gray-300">
              Geen kandidaten gevonden
            </div>
          ) : (
            filtered.map((c, i) => {
              const initials  = `${c.firstname?.[0] || ''}${c.lastname?.[0] || ''}`.toUpperCase()
              const fullName  = `${c.firstname || ''} ${c.lastname || ''}`.trim()

              return (
                <div key={c.id || i}
                  className="px-4 py-4 transition-colors"
                  style={{ borderBottom: '1px solid #F9FAFB' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#FAFAFA')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="flex items-center justify-center flex-shrink-0 font-medium rounded-full"
                      style={{ width: 36, height: 36, background: 'var(--color-primary-bg)', color: 'var(--color-primary)', fontSize: 12 }}>
                      {initials || '?'}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      {/* Naam + status */}
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="font-medium text-gray-800 truncate" style={{ fontSize: 13 }}>
                          {fullName || 'Onbekend'}
                        </span>
                        <StatusBadge status={c.status} />
                      </div>

                      {/* Details grid */}
                      <div className="grid gap-1" style={{ gridTemplateColumns: '1fr 1fr' }}>
                        {c.position && (
                          <div className="flex items-center gap-1.5">
                            <Briefcase size={11} color="#D1D5DB" />
                            <span className="text-xs text-gray-500 truncate">{c.position}</span>
                          </div>
                        )}
                        {c.mobile && (
                          <div className="flex items-center gap-1.5">
                            <Phone size={11} color="#D1D5DB" />
                            <span className="text-xs text-gray-500">{c.mobile}</span>
                          </div>
                        )}
                        {c.email && (
                          <div className="flex items-center gap-1.5" style={{ gridColumn: c.position ? 'auto' : '1 / -1' }}>
                            <Mail size={11} color="#D1D5DB" />
                            <span className="text-xs text-gray-400 truncate">{c.email}</span>
                          </div>
                        )}
                        {c.registration_date && (
                          <div className="flex items-center gap-1.5">
                            <Calendar size={11} color="#D1D5DB" />
                            <span className="text-xs text-gray-400">
                              Geregistreerd {formatDate(c.registration_date)}
                            </span>
                          </div>
                        )}
                        {c.last_login_at && (
                          <div className="flex items-center gap-1.5">
                            <Calendar size={11} color="#D1D5DB" />
                            <span className="text-xs text-gray-400">
                              Ingelogd {formatDate(c.last_login_at)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between flex-shrink-0 px-4 py-3"
          style={{ borderTop: '1px solid #F3F4F6', background: '#FAFAFA' }}>
          <span className="text-xs text-gray-400">
            {filtered.length} van {candidates.length} getoond
          </span>
          <button onClick={onClose} className="text-xs rounded-lg px-3 py-1.5"
            style={{ background: 'none', border: '1px solid #E5E7EB', cursor: 'pointer', color: '#6B7280' }}>
            Sluiten
          </button>
        </div>
      </div>
    </>
  )
}