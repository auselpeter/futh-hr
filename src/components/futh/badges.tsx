'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const statusColor: Record<string, string> = {
  Submitted: 'bg-blue-100 text-blue-700 border-blue-200',
  'In Review': 'bg-amber-100 text-amber-700 border-amber-200',
  Approved: 'bg-green-100 text-green-700 border-green-200',
  Rejected: 'bg-red-100 text-red-700 border-red-200',
  Returned: 'bg-orange-100 text-orange-700 border-orange-200',
  Closed: 'bg-gray-200 text-gray-700 border-gray-300',
  Draft: 'bg-gray-100 text-gray-600 border-gray-200',
  'In Transit': 'bg-amber-100 text-amber-700 border-amber-200',
  Received: 'bg-sky-100 text-sky-700 border-sky-200',
  Completed: 'bg-green-100 text-green-700 border-green-200',
  Archived: 'bg-violet-100 text-violet-700 border-violet-200',
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn('font-medium border', statusColor[status] || statusColor.Draft, className)}>
      {status}
    </Badge>
  )
}

const priorityColor: Record<string, string> = {
  Low: 'bg-gray-100 text-gray-700 border-gray-200',
  Normal: 'bg-blue-100 text-blue-700 border-blue-200',
  High: 'bg-amber-100 text-amber-700 border-amber-200',
  Urgent: 'bg-orange-100 text-orange-700 border-orange-200',
  Critical: 'bg-red-100 text-red-700 border-red-200',
}

export function PriorityBadge({ priority, className }: { priority: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn('font-medium border', priorityColor[priority] || priorityColor.Normal, className)}>
      {priority}
    </Badge>
  )
}

export const typeColor: Record<string, string> = {
  service: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  expense: 'bg-amber-100 text-amber-700 border-amber-200',
  other: 'bg-violet-100 text-violet-700 border-violet-200',
  individual: 'bg-blue-100 text-blue-700 border-blue-200',
  department: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  external: 'bg-pink-100 text-pink-700 border-pink-200',
}

export function TypeBadge({ type, className }: { type: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn('font-medium border capitalize', typeColor[type] || typeColor.other, className)}>
      {type}
    </Badge>
  )
}

// Sidebar nav icon helper for nav key
export function getViewTitle(key: string): string {
  const map: Record<string, string> = {
    dashboard: 'Dashboard',
    'cmd-dashboard': 'CMD Dashboard',
    'cmd-mail': 'CMD Mail',
    requisitions: 'Requisitions',
    files: 'Registry Files',
    designations: 'Designations',
    staff: 'Staff Directory',
    mail: 'Mail',
    settings: 'Settings',
  }
  return map[key] || key
}
