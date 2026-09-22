import { loadEquipment } from '@/lib/equipment/server'
import { EquipmentClient } from './_components/EquipmentClient'

export default async function AssetsPage() {
  const { data, isAdmin } = await loadEquipment()
  return <EquipmentClient initialData={data} isAdmin={isAdmin} />
}
