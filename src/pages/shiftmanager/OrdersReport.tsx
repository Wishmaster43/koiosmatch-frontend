// OrdersReport — page wrapper that renders the OrdersTable (shifts/orders report).
import OrdersTable from '@/components/shiftmanager/OrdersTable'

// Thin page wrapper around the shared OrdersTable (see the file comment above).
export default function OrdersReport() {
  return (
    <div className="flex flex-col h-full p-6">
      <OrdersTable />
    </div>
  )
}
