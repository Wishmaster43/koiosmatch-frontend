import { X } from 'lucide-react'

export default function ReportFilterSidebar({ title = 'Filters', groups = [], onClose }) {
  return (
    <div className="flex flex-col flex-shrink-0 bg-white"
      style={{ width: 220, borderLeft: '1px solid #F3F4F6' }}>

      <div className="flex items-center justify-between flex-shrink-0 px-4"
        style={{ height: 48, borderBottom: '1px solid #F3F4F6' }}>
        <span className="font-medium text-gray-800" style={{ fontSize: 13 }}>{title}</span>
        <button onClick={onClose}
          className="flex items-center justify-center rounded-lg"
          style={{ width: 26, height: 26, background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
          <X size={14} />
        </button>
      </div>

      <div className="flex flex-col flex-1 gap-5 p-4 overflow-auto">
        {groups.map(group => (
          <div key={group.key}>
            <div className="mb-3 font-medium tracking-wide uppercase"
              style={{ fontSize: 10, color: '#9CA3AF' }}>
              {group.label}
            </div>
            <div className="flex flex-col gap-2">
              {group.options.map(opt => {
                const checked = group.selected.includes(opt.value)
                return (
                  <label key={opt.value}
                    className="flex items-center justify-between gap-2 cursor-pointer">
                    <div className="flex items-center min-w-0 gap-2">
                      <input type="checkbox" checked={checked}
                        onChange={() => group.onToggle(opt.value)}
                        style={{ accentColor: 'var(--color-primary)', width: 14, height: 14, flexShrink: 0 }} />
                      <span className="text-sm truncate"
                        style={{ color: checked ? '#111827' : '#6B7280' }}>
                        {opt.label}
                      </span>
                    </div>
                    {opt.count !== undefined && (
                      <span className="flex-shrink-0 font-mono rounded-full px-1.5"
                        style={{
                          fontSize: 10,
                          background: checked ? 'var(--color-primary-bg)' : '#F3F4F6',
                          color:      checked ? 'var(--color-primary)'    : '#9CA3AF',
                        }}>
                        {opt.count}
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}