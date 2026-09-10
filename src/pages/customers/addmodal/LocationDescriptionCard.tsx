/**
 * LocationDescriptionCard — the "Omschrijving" card of AddLocationModal.
 * Adopts the shared components/forms/ModalDescriptionCard with location-specific label.
 */
import { useTranslation } from 'react-i18next'
import ModalDescriptionCard from '@/components/forms/ModalDescriptionCard'

interface LocationDescriptionCardProps {
  value: string
  onChange: (v: string) => void
}

// Location description card — adopts the shared ModalDescriptionCard.
export default function LocationDescriptionCard({ value, onChange }: LocationDescriptionCardProps) {
  const { t } = useTranslation(['customers', 'common'])
  return (
    <ModalDescriptionCard
      value={value}
      onChange={onChange}
      label={t('locations.detail.description')}
      ariaLabel={t('locations.detail.description')}
      placeholder={t('common:add')}
    />
  )
}
