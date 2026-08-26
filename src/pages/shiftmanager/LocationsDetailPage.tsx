// LocationsDetailPage — page wrapper that renders the LocationsTable.
import LocationsTable from '@/components/reports/LocationsTable'

// Thin route wrapper around LocationsTable (see file-top comment above).
export default function LocationsDetailPage() {
  return (
    <div className="flex flex-col h-full p-6">
      <LocationsTable />
    </div>
  )
}
