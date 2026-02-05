import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardLayoutClient } from '@/components/DashboardLayoutClient'

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const handleSignOut = async () => {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  return (
    <DashboardLayoutClient
      userEmail={user.email || ''}
      onSignOut={handleSignOut}
    >
      {children}
    </DashboardLayoutClient>
  )
}
