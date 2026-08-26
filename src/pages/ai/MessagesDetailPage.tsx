import MessagesTable from '@/components/reports/MessagesTable'

// MessagesDetailPage — page wrapper that renders the MessagesTable (message log).
export default function MessagesDetailPage() {
  return (
    <div className="flex flex-col h-full p-6">
      <MessagesTable />
    </div>
  )
}
