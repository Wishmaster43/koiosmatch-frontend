import { useTranslation } from 'react-i18next'
import { Caption } from '@/components/ui/typography'
import Spinner from '@/components/ui/Spinner'

// The queued-start notice: waiting (spinner), still waiting after the poll cap, or refused by the queue.
export default function QueuedInterviewNotice({ state }: { state: 'queued' | 'capped' | 'skipped' }) {
  const { t } = useTranslation('applications')
  return (
    <Caption as="div" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {state === 'queued' && <Spinner size={14} />}
      {t(`interview.start.${state === 'queued' ? 'queued' : state === 'capped' ? 'queuedStillWaiting' : 'queuedSkipped'}`)}
    </Caption>
  )
}
