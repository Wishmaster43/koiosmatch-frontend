import {
  Users, MessageCircle, UserCheck, Clock, CalendarX,
  TrendingUp, TrendingDown
} from 'lucide-react'

const KPI_DATA = [
  {
    label: 'Ingeplande kandidaten',
    value: '312',
    delta: +8,
    icon: UserCheck,
    iconBg: '#EEF2FF',
    iconColor: '#534AB7',
  },
  {
    label: 'Berichten deze maand',
    value: '1.847',
    delta: +23,
    icon: MessageCircle,
    iconBg: '#ECFDF5',
    iconColor: '#059669',
  },
  {
    label: 'Actieve kandidaten',
    value: '441',
    delta: -3,
    icon: Users,
    iconBg: '#EFF6FF',
    iconColor: '#2563EB',
  },
  {
    label: 'Open uur',
    value: '684',
    delta: +41,
    icon: Clock,
    iconBg: '#FFFBEB',
    iconColor: '#D97706',
  },
  {
    label: 'Open diensten',
    value: '23',
    delta: -5,
    icon: CalendarX,
    iconBg: '#FFF1F2',
    iconColor: '#E11D48',
  },
]

function KpiCard({ label, value, delta, icon: Icon, iconBg, iconColor }) {
  const isPositive = delta > 0
  const isNeutral  = delta === 0

  return (
    <div
      className="flex flex-col gap-4 p-5 bg-white rounded-xl"
      style={{ border: '1px solid #F3F4F6' }}
    >
      {/* Boven: icon + delta */}
      <div className="flex items-start justify-between">
        <div
          className="flex items-center justify-center flex-shrink-0 rounded-lg"
          style={{ width: 40, height: 40, background: iconBg }}
        >
          <Icon size={18} color={iconColor} />
        </div>

        {!isNeutral && (
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-full"
            style={{
              background: isPositive ? '#F0FDF4' : '#FFF1F2',
              color: isPositive ? '#16A34A' : '#E11D48',
            }}
          >
            {isPositive
              ? <TrendingUp size={12} />
              : <TrendingDown size={12} />
            }
            <span style={{ fontSize: 11, fontWeight: 600 }}>
              {isPositive ? '+' : ''}{delta}%
            </span>
          </div>
        )}
      </div>

      {/* Waarde */}
      <div>
        <div
          className="mb-1 font-semibold leading-none"
          style={{ fontSize: 28, color: '#111827', letterSpacing: '-0.5px' }}
        >
          {value}
        </div>
        <div style={{ fontSize: 13, color: '#9CA3AF', fontWeight: 400 }}>
          {label}
        </div>
      </div>

      {/* Vorige maand vergelijking */}
      <div
        className="pt-3 text-xs"
        style={{ borderTop: '1px solid #F9FAFB', color: '#D1D5DB' }}
      >
        <span style={{ color: isPositive ? '#16A34A' : isNeutral ? '#9CA3AF' : '#E11D48', fontWeight: 500 }}>
          {isPositive ? `+${delta}%` : isNeutral ? '0%' : `${delta}%`}
        </span>
        <span style={{ color: '#D1D5DB' }}> t.o.v. vorige maand</span>
      </div>
    </div>
  )
}

export default function Dashboard() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="font-semibold text-gray-900" style={{ fontSize: 18 }}>
          Dashboard
        </h2>
        <p className="text-sm text-gray-400 mt-0.5">
          Overzicht van vandaag
        </p>
      </div>

      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}
      >
        {KPI_DATA.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>
    </div>
  )
}