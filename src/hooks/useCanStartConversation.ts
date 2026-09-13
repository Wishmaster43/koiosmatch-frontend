import { useAuth } from '@/context/AuthContext'

// Two gates, both hide (OPENERS-HIDE-1): POST /conversations/start sits in the
// page.whatsapp route group (communication-ai.php:77-80), and a contact thread carries
// customer data on top of that (§8 PII gate), so customers.view is required too. Shared
// by every "start conversation" trigger (customer contact, opportunity, …).
export function useCanStartConversation(): boolean {
  const auth = useAuth()
  const can = auth?.hasPermission ?? (() => false)
  return can('page.whatsapp') && can('customers.view')
}
