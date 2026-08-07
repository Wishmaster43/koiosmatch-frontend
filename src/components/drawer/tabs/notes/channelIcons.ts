/**
 * channelIcons — icon per contact-channel slug, shown on both the channel
 * PICKER (NoteComposer) and the channel CHIP (NotesTab's note list). Its own
 * file so both siblings import ONE map without NotesTab.tsx and NoteComposer.tsx
 * having to import values from each other (a value-level circular import —
 * types importing back into NotesTab.tsx are fine, erased at compile time, but
 * a shared runtime constant belongs in neither "parent").
 */
import type { ComponentType } from 'react'
import { Mail, PhoneCall, MessageCircle, Building2, Video, FileText } from 'lucide-react'

export const CHANNEL_ICON: Record<string, ComponentType<{ size?: number }>> = {
  email: Mail, phone: PhoneCall, call: PhoneCall, whatsapp: MessageCircle,
  whatsapp_private: MessageCircle, appointment: Building2, meet: Video, note: FileText,
}
