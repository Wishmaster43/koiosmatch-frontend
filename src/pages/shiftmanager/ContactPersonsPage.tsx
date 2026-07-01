import ContactPersonsTable from '@/components/reports/ContactPersonsTable'

export default function ContactPersonsPage() {
  return (
    <div style={{ padding: 24, height: '100%', boxSizing: 'border-box', overflowY: 'auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Contactpersonen</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
          Overzicht van alle contactpersonen per klant.
        </p>
      </div>
      <ContactPersonsTable />
    </div>
  )
}
