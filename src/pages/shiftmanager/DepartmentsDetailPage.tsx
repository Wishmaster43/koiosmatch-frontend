// DepartmentsDetailPage — page wrapper that renders the DepartmentsTable.
import DepartmentsTable from '@/components/reports/DepartmentsTable'

export default function DepartmentsDetailPage() {
  return (
    <div className="flex flex-col h-full p-6">
      <DepartmentsTable />
    </div>
  )
}
