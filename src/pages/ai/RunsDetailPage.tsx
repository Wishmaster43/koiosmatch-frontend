// RunsDetailPage — page wrapper that renders the RunsTable (workflow run history).
import RunsTable from '@/components/reports/RunsTable'

export default function RunsDetailPage() {
  return (
    <div className="flex flex-col h-full p-6">
      <RunsTable />
    </div>
  )
}
