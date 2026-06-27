import { useState } from 'react'
import CandidatesDetailPage  from './CandidatesDetailPage'
import CustomersDetailPage   from './CustomersDetailPage'
import LocationsDetailPage   from './LocationsDetailPage'
import DepartmentsDetailPage from './DepartmentsDetailPage'
import ContactsDetailPage    from './ContactsDetailPage'
import OrdersTable           from '../../components/shiftmanager/OrdersTable'
import RunsDetailPage        from '../ai/RunsDetailPage'
import MessagesDetailPage    from '../ai/MessagesDetailPage'
import { useAuth }           from '../../context/AuthContext'

const BASE_TABS: Array<{ id: string; label: string; requires?: string }> = [
  { id: 'candidates',  label: 'Kandidaten' },
  { id: 'customers',   label: 'Klanten' },
  { id: 'locations',   label: 'Locaties' },
  { id: 'departments', label: 'Afdelingen' },
  { id: 'contacts',    label: 'Contactpersonen' },
  { id: 'orders',      label: 'Diensten' },
  { id: 'runs',        label: 'Uitvoeringen', requires: 'aiagents' },
  { id: 'messages',    label: 'Berichten',    requires: 'whatsapp' },
]

export default function ShiftmanagerDetailsPage() {
  const { accessiblePages, user } = useAuth() ?? {}
  const pages = accessiblePages ?? user?.accessible_pages ?? []

  const tabs = BASE_TABS.filter(t => !t.requires || pages.includes(t.requires))

  const [activeTab, setActiveTab] = useState('candidates')

  const renderTab = () => {
    switch (activeTab) {
      case 'candidates':  return <CandidatesDetailPage />
      case 'customers':   return <CustomersDetailPage />
      case 'locations':   return <LocationsDetailPage />
      case 'departments': return <DepartmentsDetailPage />
      case 'contacts':    return <ContactsDetailPage />
      case 'orders':      return <div className="flex flex-col h-full p-6"><OrdersTable /></div>
      case 'runs':        return <RunsDetailPage />
      case 'messages':    return <MessagesDetailPage />
      default:            return null
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex-shrink-0 flex items-center gap-1 px-6 pt-4 pb-0"
        style={{ borderBottom: '1px solid var(--border)' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '7px 14px',
              fontSize: 13,
              fontWeight: activeTab === tab.id ? 600 : 400,
              color: activeTab === tab.id ? 'var(--color-primary)' : 'var(--text-muted)',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--color-primary)' : '2px solid transparent',
              cursor: 'pointer',
              marginBottom: -1,
              whiteSpace: 'nowrap',
              transition: 'color 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {renderTab()}
      </div>
    </div>
  )
}
