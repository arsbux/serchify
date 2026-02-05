'use client'
import { useState, useTransition } from 'react'
import { CollapsibleMainNav } from './CollapsibleMainNav'

interface DashboardLayoutClientProps {
  children: React.ReactNode
  userEmail: string
  onSignOut: () => Promise<void>
}

export function DashboardLayoutClient({ children, userEmail, onSignOut }: DashboardLayoutClientProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleSignOut = () => {
    startTransition(async () => {
      await onSignOut()
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <CollapsibleMainNav
        userEmail={userEmail}
        onSignOut={handleSignOut}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
      />

      {/* Main Content - Dynamically offset by sidebar width */}
      <main className={`min-h-screen transition-all duration-300 ease-in-out ${isCollapsed ? 'ml-16' : 'ml-64'}`}>
        {children}
      </main>
    </div>
  )
}
