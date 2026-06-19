import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useCandidateCount } from '../../lib/queries'
import { useRightPanel } from '../../context/RightPanelContext'
import { Users, Building2, FileText, Briefcase, TrendingUp, CheckCircle, AlertCircle, MessageCircle, CalendarDays } from 'lucide-react'

const RECENT_CANDIDATES = [
  { name: 'Ismail Eddahchouri',    initials: 'IE', status: 'Beschikbaar',     statusColor: 'var(--color-success)', role: 'Verzorgende IG',   time: '22:00' },
  { name: 'Merel Van Muijlwijk',   initials: 'MV', status: 'Beschikbaar',     statusColor: 'var(--color-success)', role: 'Helpende',         time: '16:36' },
  { name: 'Raginie Rasoelbaks',    initials: 'RR', status: 'In procedure',    statusColor: 'var(--color-warning)', role: 'Verpleegkundige',  time: '16:02' },
  { name: 'Elif Akagündüz',        initials: 'EA', status: 'Beschikbaar',     statusColor: 'var(--color-success)', role: 'Gastvrouw',        time: '14:00' },
  { name: 'Rubina Rosella Milan',  initials: 'RM', status: 'Intake gepland',  statusColor: 'var(--color-secondary)', role: 'Verzorgende',      time: '11:18' },
]

const RECENT_APPLICATIONS = [
  { candidate: 'Ismail Eddahchouri',   vacancy: 'Verzorgende IG — Papendrecht',  status: 'In behandeling', statusColor: 'var(--color-warning)', time: '12 jun' },
  { candidate: 'Merel Van Muijlwijk',  vacancy: 'Helpende — Utrecht',            status: 'Afgewezen',      statusColor: 'var(--color-danger)', time: '11 jun' },
  { candidate: 'Figen Ooijevaar',      vacancy: 'Zorgmedewerker — Den Haag',     status: 'Nieuw',          statusColor: 'var(--color-primary)', time: '11 jun' },
  { candidate: 'Priscilla Benjamin',   vacancy: 'Verpleegkundige — Tilburg',      status: 'Aangenomen',     statusColor: 'var(--color-success)', time: '10 jun' },
]

const RECENT_LEADS = [
  { name: 'Zorgcentrum De Eik',      contact: 'Linda Brouwer',  status: 'Warm',    statusColor: 'var(--color-warning)', time: '12 jun' },
  { name: 'Thuiszorg Noord-Holland', contact: 'Peter van Dam',  status: 'Nieuw',   statusColor: 'var(--color-primary)', time: '11 jun' },
  { name: 'Verpleeghuis Zonnehoek',  contact: 'Anke Smits',     status: 'Contact', statusColor: 'var(--color-secondary)', time: '10 jun' },
]

const RUNS = [
  { name: 'Kandidaten Matching Agent', time: '08:00', ok: true,  n: 23  },
  { name: 'No Response Checker',       time: '09:00', ok: true,  n: 12  },
  { name: 'Shift Reminder',            time: '10:00', ok: false, err: 'API timeout' },
  { name: 'Wekelijkse Rapportage',     time: '07:00', ok: true,  n: 441 },
]

const CONVERSATIONS = [
  { name: 'Jan de Vries', msg: 'Ik kan morgen om 09:00 starten',  time: '08:45' },
  { name: 'Sofia Ahmed',  msg: 'Is de planning aangepast?',        time: '08:30' },
  { name: 'Mark Jansen',  msg: 'Bedankt voor de update!',          time: '07:58' },
  { name: 'Lisa Wong',    msg: 'Ik ben beschikbaar volgende week', time: '07:40' },
]

function KpiCard({ label, value, sub, color, bg, Icon, onClick }) {
  return (
    <div onClick={onClick}
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
        padding: '16px', cursor: onClick ? 'pointer' : 'default', flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={15} color={color} />
        </div>
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 11, color: sub?.startsWith('+') ? 'var(--color-success)' : sub?.startsWith('-') ? 'var(--color-danger)' : 'var(--text-muted)' }}>{sub}</div>
    </div>
  )
}

function Block({ title, action, onAction, children }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{title}</span>
        {action && <span style={{ fontSize: 12, color: 'var(--color-primary)', cursor: 'pointer' }} onClick={onAction}>{action} →</span>}
      </div>
      {children}
    </div>
  )
}

function Avatar({ initials, size = 28 }) {
  const colors = ['var(--color-primary)','var(--color-secondary)','var(--color-success)','var(--color-warning)','var(--color-danger)','#8B5CF6','#EC4899']
  const color  = colors[initials.charCodeAt(0) % colors.length]
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: color, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
      fontSize: size * 0.36, fontWeight: 700 }}>
      {initials}
    </div>
  )
}

function StatusBadge({ label, color }) {
  return <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 99,
    background: color + '20', color, whiteSpace: 'nowrap' }}>{label}</span>
}

const VESTIGINGEN = ['Yesway zorg B.V.', 'Yesway works B.V.', 'Yesway flex B.V.', 'Yesway recruitment B.V.']
const PERIODES    = ['Vandaag', 'Deze week', 'Deze maand', 'Dit kwartaal', 'Dit jaar']

export default function Dashboard({ onNavigate }) {
  const { accessiblePages = [] } = useAuth()
  const hasWhatsApp = accessiblePages.includes('whatsapp')
  const hasAiAgents = accessiblePages.includes('aiagents')

  // Live total — same source as the Candidates table (/candidates meta.total).
  const { data: candidateTotal, isLoading: countLoading } = useCandidateCount()
  const candidateTotalLabel = countLoading
    ? '…'
    : (candidateTotal ?? 0).toLocaleString('nl-NL')

  const [selPeriode,   setSelPeriode]   = useState([])
  const [selVestiging, setSelVestiging] = useState([])
  const [selStatus,    setSelStatus]    = useState([])
  const { registerFilters, unregisterFilters } = useRightPanel()

  const filterGroups = useMemo(() => [
    {
      key: 'periode', label: 'Periode',
      selected: selPeriode,
      options: PERIODES.map(p => ({ value: p, label: p })),
      onToggle: v => setSelPeriode(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]),
    },
    {
      key: 'vestiging', label: 'Vestiging',
      selected: selVestiging,
      options: VESTIGINGEN.map(v => ({ value: v, label: v })),
      onToggle: v => setSelVestiging(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]),
    },
    {
      key: 'kandidaatstatus', label: 'Kandidaatstatus',
      selected: selStatus,
      options: ['Beschikbaar','Nieuw kandidaat','In procedure','Intake gepland','Niet beschikbaar'].map(s => ({ value: s, label: s })),
      onToggle: v => setSelStatus(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]),
    },
  ], [selPeriode, selVestiging, selStatus])

  useEffect(() => {
    registerFilters('dashboard', filterGroups)
    return () => unregisterFilters('dashboard')
  }, [filterGroups, registerFilters, unregisterFilters])

  return (
    <div style={{ padding: 24, overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>


      {/* KPI rij — ATS */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <KpiCard label="Totaal kandidaten"         value={candidateTotalLabel} sub="In het ATS"  color="var(--color-primary)" bg="var(--color-primary-bg)" Icon={Users}      onClick={() => onNavigate?.('candidates')} />
          <KpiCard label="Nieuwe kandidaten"         value="34"    sub="+12% vorige maand" color="var(--color-success)" bg="var(--color-success-bg)" Icon={TrendingUp}  onClick={() => onNavigate?.('candidates')} />
          <KpiCard label="Openstaande sollicitaties" value="18"    sub="5 nieuw vandaag"   color="var(--color-warning)" bg="var(--color-warning-bg)" Icon={FileText}    onClick={() => onNavigate?.('applications')} />
          <KpiCard label="Actieve vacatures"         value="9"     sub="3 urgent"          color="var(--color-danger)" bg="var(--color-danger-bg)" Icon={Briefcase}   onClick={() => onNavigate?.('vacancies')} />
        </div>
      </div>

      {/* KPI rij — CRM */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <KpiCard label="Actieve klanten"     value="47"    sub="+3 deze maand"  color="var(--color-secondary)" bg="var(--color-secondary-bg)" Icon={Building2}    onClick={() => onNavigate?.('customers')} />
          <KpiCard label="Leads in pipeline"   value="12"    sub="4 warm"         color="#8B5CF6" bg="#F3E8FF" Icon={TrendingUp}   />
          <KpiCard label="Geplande diensten"   value="138"   sub="Deze week"      color="var(--color-success)" bg="var(--color-success-bg)" Icon={CalendarDays} onClick={() => onNavigate?.('planning')} />
          {hasWhatsApp && <KpiCard label="Berichten verstuurd" value="1.847" sub="Deze maand" color="var(--color-info)" bg="var(--color-info-bg)" Icon={MessageCircle} onClick={() => onNavigate?.('whatsapp')} />}
        </div>
      </div>

      {/* Blokken rij 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <Block title="Recente kandidaten" action="Alle kandidaten" onAction={() => onNavigate?.('candidates')}>
          {RECENT_CANDIDATES.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
              borderBottom: i < RECENT_CANDIDATES.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <Avatar initials={c.initials} size={28} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{c.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.role}</div>
              </div>
              <StatusBadge label={c.status} color={c.statusColor} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{c.time}</span>
            </div>
          ))}
        </Block>

        <Block title="Recente sollicitaties" action="Alle sollicitaties" onAction={() => onNavigate?.('applications')}>
          {RECENT_APPLICATIONS.map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
              borderBottom: i < RECENT_APPLICATIONS.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{a.candidate}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.vacancy}</div>
              </div>
              <StatusBadge label={a.status} color={a.statusColor} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{a.time}</span>
            </div>
          ))}
        </Block>
      </div>

      {/* Blokken rij 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: hasAiAgents || hasWhatsApp ? '1fr 1fr 1fr' : '1fr', gap: 16, marginBottom: 16 }}>
        <Block title="Leads in pipeline" action="Alle klanten" onAction={() => onNavigate?.('customers')}>
          {RECENT_LEADS.map((l, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
              borderBottom: i < RECENT_LEADS.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{l.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{l.contact}</div>
              </div>
              <StatusBadge label={l.status} color={l.statusColor} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{l.time}</span>
            </div>
          ))}
        </Block>

        {hasAiAgents && (
          <Block title="Recente uitvoeringen" action="Alles" onAction={() => onNavigate?.('details.runs')}>
            {RUNS.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
                borderBottom: i < RUNS.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  background: r.ok ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {r.ok ? <CheckCircle size={13} color="var(--color-success)" /> : <AlertCircle size={13} color="var(--color-danger)" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.ok ? `${r.n} verwerkt` : r.err}</div>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{r.time}</span>
              </div>
            ))}
          </Block>
        )}

        {hasWhatsApp && (
          <Block title="Recente conversaties" action="Alles" onAction={() => onNavigate?.('details.messages')}>
            {CONVERSATIONS.map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
                borderBottom: i < CONVERSATIONS.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <Avatar initials={c.name.split(' ').map(n=>n[0]).join('')} size={28} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.msg}</div>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{c.time}</span>
              </div>
            ))}
          </Block>
        )}
      </div>
    </div>
  )
}
