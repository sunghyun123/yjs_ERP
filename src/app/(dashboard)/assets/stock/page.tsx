import { loadEquipment } from '@/lib/equipment/server'
import { StockClient } from '../_components/StockClient'
export default async function StockPage() {
  const { data, isAdmin } = await loadEquipment()
  return <StockClient initialData={data} isAdmin={isAdmin} />
}
