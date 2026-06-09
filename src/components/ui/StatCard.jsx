export default function StatCard({ label, value, sub, color = '#534AB7', bg = '#EEF2FF', icon: Icon }) {
  return (
    <div className="flex flex-col gap-3 p-5 bg-white rounded-xl"
      style={{ border: '1px solid #F3F4F6' }}>
      <div className="flex items-center justify-between">
        {Icon && (
          <div className="flex items-center justify-center flex-shrink-0 rounded-lg"
            style={{ width: 36, height: 36, background: bg }}>
            <Icon size={16} color={color} />
          </div>
        )}
      </div>
      <div>
        <div className="mb-1 font-semibold leading-none"
          style={{ fontSize: 26, color: '#111827', letterSpacing: '-0.5px' }}>
          {value}
        </div>
        <div style={{ fontSize: 13, color: '#9CA3AF' }}>{label}</div>
        {sub && (
          <div style={{ fontSize: 11, color: '#C4B5FD', marginTop: 3, fontWeight: 500 }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  )
}