'use client'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { ChevronLeft, ChevronRight, Hash, Edit, ClipboardCheck, Code, LogOut } from 'lucide-react'

interface CollapsibleMainNavProps {
  userEmail: string
  onSignOut: () => void
  isCollapsed: boolean
  setIsCollapsed: (value: boolean) => void
}

export function CollapsibleMainNav({ userEmail, onSignOut, isCollapsed, setIsCollapsed }: CollapsibleMainNavProps) {
  const pathname = usePathname()

  const navItems = [
    { id: 'site-auditor', href: '/site-auditor', label: 'Site Auditor', icon: ClipboardCheck },
    { id: 'content-optimizer', href: '/content-optimizer', label: 'Content Optimizer', icon: Edit },
    { id: 'keyword-research', href: '/keyword-research', label: 'Keyword Research', icon: Hash },
    { id: 'schema-generator', href: '/schema-generator', label: 'Schema Generator', icon: Code },
  ]

  const isActive = (href: string) => {
    return pathname?.startsWith(href)
  }

  return (
    <aside
      className={`
        fixed left-0 top-0 h-screen bg-white border-r border-gray-100 flex flex-col transition-all duration-300 ease-in-out shadow-sm shadow-gray-200/50
        ${isCollapsed ? 'w-16' : 'w-64'}
      `}
    >
      {/* Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-6 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 z-10 shadow-md shadow-gray-200/50 hover:shadow-lg hover:shadow-gray-200/60"
      >
        {isCollapsed ? (
          <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
        ) : (
          <ChevronLeft className="w-3.5 h-3.5 text-gray-600" />
        )}
      </button>

      {/* Logo */}
      <div className={`p-6 border-b border-gray-100 ${isCollapsed ? 'px-3' : ''}`}>
        <Link href="/site-auditor" className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
          <Image
            src="/seargence.png"
            alt="Serchify"
            width={40}
            height={40}
            className="rounded-xl flex-shrink-0 shadow-md shadow-blue-500/30"
          />
          {!isCollapsed && (
            <div>
              <h1 className="text-xl font-bold text-gray-900">Serchify</h1>
              <p className="text-xs text-gray-500">SEO Intelligence</p>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
                ${active
                  ? 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 font-medium shadow-sm shadow-blue-100/50 border border-blue-100/50'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }
                ${isCollapsed ? 'justify-center' : ''}
              `}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-blue-600' : 'text-gray-500'}`} />
              {!isCollapsed && <span className="font-medium">{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* User Section */}
      <div className={`p-4 border-t border-gray-100 ${isCollapsed ? 'px-2' : ''}`}>
        {!isCollapsed ? (
          <>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-md shadow-purple-500/25">
                <span className="text-white font-semibold text-sm">
                  {userEmail.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {userEmail.split('@')[0]}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {userEmail}
                </p>
              </div>
            </div>
            <button
              onClick={onSignOut}
              className="w-full px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 border border-transparent hover:border-gray-200"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-md shadow-purple-500/25">
              <span className="text-white font-semibold text-sm">
                {userEmail.charAt(0).toUpperCase()}
              </span>
            </div>
            <button
              onClick={onSignOut}
              className="w-10 h-10 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-all duration-200"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
