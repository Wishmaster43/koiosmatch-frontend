// CustomersDetailPage — page wrapper that renders the CustomersTable.
import CustomersTable from '@/components/reports/CustomersTable'

// Thin route page: renders the shared shiftmanager customers table full-height inside the page padding.
export default function CustomersDetailPage() {
  return (
    <div className="flex flex-col h-full p-6">
      <CustomersTable />
    </div>
  )
}
