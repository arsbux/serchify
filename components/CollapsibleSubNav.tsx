'use client'
import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface SubNavItem {
  id: string
  label: string
  icon: React.ReactNode
}

interface CollapsibleSubNavProps {
  items: SubNavItem[]
  activeItem: string
  onItemClick: (id: string) => void
  title?: string
}

export function CollapsibleSubNav({ items, activeItem, onItemClick, title }: CollapsibleSubNavProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <div
      className={`
        sticky top-[110px] h-[calc(100vh-110px)] bg-white border-r border-gray-200 transition-all duration-300 ease-in-out flex-shrink-0 overflow-y-auto
        ${isCollapsed ? 'w-16' : 'w-64'}
      `}
    >
      {/* Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-6 w-6 h-6 bg-white border border-gray-300 rounded-full flex items-center justify-center hover:bg-gray-50 transition-colors z-10 shadow-sm"
      >
        {isCollapsed ? (
          <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
        ) : (
          <ChevronLeft className="w-3.5 h-3.5 text-gray-600" />
        )}
      </button>

      {/* Content */}
      <div className="p-4">
        {/* Title */}
        {!isCollapsed && title && (
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3">
              {title}
            </h3>
          </div>
        )}

        {/* Navigation Items */}
        <nav className="space-y-1">
          {items.map((item) => {
            const isActive = activeItem === item.id
            return (
              <button
                key={item.id}
                onClick={() => onItemClick(item.id)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all
                  ${isActive
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }
                  ${isCollapsed ? 'justify-center' : ''}
                `}
                title={isCollapsed ? item.label : undefined}
              >
                <span className={`flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-500'}`}>
                  {item.icon}
                </span>
                {!isCollapsed && (
                  <span className="text-sm truncate">{item.label}</span>
                )}
              </button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
