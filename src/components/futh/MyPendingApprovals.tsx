'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  FolderKanban, FileText, Plane, TrendingUp, UserMinus, DoorOpen,
  AlertCircle, ChevronRight,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import type { ViewKey } from './Sidebar'

type PendingType = 'requisition' | 'file' | 'leave' | 'promotion' | 'termination' | 'resignation'

type PendingItem = {
  type: PendingType
  id: string
  refNumber: string
  subject: string
  status: string
  priority: string
  createdAt: string
  link: string
}

type PendingData = {
  counts: {
    requisitions: number
    files: number
    leaves: number
    promotions: number
    terminations: number
    resignations: number
  }
  total: number
  recent: PendingItem[]
}

type Props = {
  onNavigate: (v: ViewKey) => void
  onOpenItem?: (link: string) => void
}

const TYPE_CONFIG: Record<PendingType, {
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge: string
  text: string
  bg: string
  border: string
  view: ViewKey
}> = {
  requisition: {
    label: 'Requisitions',
    icon: FolderKanban,
    badge: 'bg-blue-100 text-blue-800 border-blue-200',
    text: 'text-blue-700',
    bg: 'bg-blue-50 hover:bg-blue-100',
    border: 'border-blue-200',
    view: 'requisitions',
  },
  file: {
    label: 'Files',
    icon: FileText,
    badge: 'bg-violet-100 text-violet-800 border-violet-200',
    text: 'text-violet-700',
    bg: 'bg-violet-50 hover:bg-violet-100',
    border: 'border-violet-200',
    view: 'files',
  },
  leave: {
    label: 'Leaves',
    icon: Plane,
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    text: 'text-emerald-700',
    bg: 'bg-emerald-50 hover:bg-emerald-100',
    border: 'border-emerald-200',
    view: 'leaves',
  },
  promotion: {
    label: 'Promotions',
    icon: TrendingUp,
    badge: 'bg-amber-100 text-amber-800 border-amber-200',
    text: 'text-amber-700',
    bg: 'bg-amber-50 hover:bg-amber-100',
    border: 'border-amber-200',
    view: 'promotions',
  },
  termination: {
    label: 'Terminations',
    icon: UserMinus,
    badge: 'bg-red-100 text-red-800 border-red-200',
    text: 'text-red-700',
    bg: 'bg-red-50 hover:bg-red-100',
    border: 'border-red-200',
    view: 'terminations',
  },
  resignation: {
    label: 'Resignations',
    icon: DoorOpen,
    badge: 'bg-slate-200 text-slate-800 border-slate-300',
    text: 'text-slate-700',
    bg: 'bg-slate-100 hover:bg-slate-200',
    border: 'border-slate-300',
    view: 'resignations',
  },
}

export default function MyPendingApprovals({ onNavigate, onOpenItem }: Props) {
  const [data, setData] = useState<PendingData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/dashboard/pending', { cache: 'no-store' })
      if (!res.ok) throw new Error('failed')
      const json = await res.json()
      setData(json)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    // Refresh every 60 seconds
    const t = setInterval(load, 60000)
    return () => clearInterval(t)
  }, [load])

  if (loading || !data) {
    return (
      <Card className="border-amber-200 bg-amber-50/40">
        <CardHeader className="pb-3">
          <Skeleton className="h-7 w-64" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
          </div>
        </CardContent>
      </Card>
    )
  }

  const total = data.total
  if (total === 0) {
    return (
      <Card className="border-emerald-200 bg-emerald-50/40">
        <CardContent className="p-5 flex items-center gap-3">
          <div className="size-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <AlertCircle className="size-5" />
          </div>
          <div>
            <div className="font-semibold text-emerald-900">All caught up! No pending approvals.</div>
            <div className="text-sm text-emerald-700">
              You have no items awaiting your action right now.
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const statCards: { type: PendingType; count: number }[] = [
    { type: 'requisition', count: data.counts.requisitions },
    { type: 'file', count: data.counts.files },
    { type: 'leave', count: data.counts.leaves },
    { type: 'promotion', count: data.counts.promotions },
    { type: 'termination', count: data.counts.terminations },
    { type: 'resignation', count: data.counts.resignations },
  ].filter((s) => s.count > 0)

  return (
    <Card className="border-amber-200 bg-amber-50/40 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="size-5 text-amber-600" />
              My Pending Approvals
              <Badge className="bg-amber-600 text-white hover:bg-amber-600 ml-1">
                {total} item{total === 1 ? '' : 's'}
              </Badge>
            </CardTitle>
            <CardDescription className="mt-1">
              Items across the institution currently awaiting your action
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={load}
            className="text-amber-700 hover:text-amber-900 hover:bg-amber-100"
          >
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stat cards grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {statCards.map(({ type, count }) => {
            const cfg = TYPE_CONFIG[type]
            const Icon = cfg.icon
            return (
              <button
                key={type}
                onClick={() => onNavigate(cfg.view)}
                className={`text-left rounded-lg border ${cfg.border} ${cfg.bg} transition px-3 py-3 flex flex-col gap-1`}
              >
                <div className="flex items-center justify-between">
                  <Icon className={`size-4 ${cfg.text}`} />
                  <span className={`text-2xl font-bold ${cfg.text}`}>{count}</span>
                </div>
                <div className="text-xs text-muted-foreground font-medium">{cfg.label}</div>
              </button>
            )
          })}
        </div>

        {/* Recent items list */}
        {data.recent.length > 0 && (
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2 px-1">
              Most recent pending items ({data.recent.length})
            </div>
            <div className="rounded-lg border border-amber-200 bg-white overflow-hidden">
              <div className="max-h-80 overflow-y-auto scroll-thin">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-amber-50/95 backdrop-blur z-10">
                    <tr className="text-xs uppercase text-muted-foreground border-b">
                      <th className="text-left px-3 py-2 font-medium">Type</th>
                      <th className="text-left px-3 py-2 font-medium">Ref</th>
                      <th className="text-left px-3 py-2 font-medium">Subject / Staff</th>
                      <th className="text-left px-3 py-2 font-medium">Status</th>
                      <th className="text-left px-3 py-2 font-medium">Created</th>
                      <th className="text-right px-3 py-2 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent.map((item) => {
                      const cfg = TYPE_CONFIG[item.type]
                      const Icon = cfg.icon
                      return (
                        <tr
                          key={`${item.type}-${item.id}`}
                          className="border-b last:border-0 hover:bg-muted/40"
                        >
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.badge}`}>
                              <Icon className="size-3" />
                              {cfg.label.replace(/s$/, '')}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">{item.refNumber}</td>
                          <td className="px-3 py-2 max-w-[260px] truncate">{item.subject}</td>
                          <td className="px-3 py-2">
                            <Badge variant="outline" className="text-xs">{item.status}</Badge>
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                            {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 gap-1"
                              onClick={() => onOpenItem ? onOpenItem(item.link) : onNavigate(cfg.view)}
                            >
                              Open
                              <ChevronRight className="size-3" />
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
