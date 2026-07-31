import { redirect } from 'next/navigation'
import { getDashboardAccess } from '@/lib/auth/dashboard-access'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const access = await getDashboardAccess()

  if (access.entry?.role !== 'admin') {
    redirect('/')
  }

  return children
}
