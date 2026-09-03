/**
 * Re-export the shared RetentionConsentBlock for the candidate drawer.
 * The candidate's CommunicationTab wires it with namespace='candidates'
 * and viewPermission='candidates.delete' — mirror this at every call site.
 */
import SharedRetentionConsentBlock from '@/components/drawer/RetentionConsentBlock'

export default function RetentionConsentBlock(props: React.ComponentProps<typeof SharedRetentionConsentBlock>) {
  return <SharedRetentionConsentBlock {...props} />
}
