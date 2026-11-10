'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  ShieldCheck, Inbox, AlertTriangle, FileText,
  Check, X, Clock, ArrowRight, Mail,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { formatNaira, formatDateTime, timeAgo, initials } from '@/lib/formatters'
import { StatusBadge, PriorityBadge, TypeBadge } from './badges'
import { toast } from 'sonner'
import type { ViewKey } from './Sidebar'

type Props = {
  user: any
  onNavigate: (v: ViewKey) => void
  onOpenRequisition: (id: string) => void
  onOpenMail: (id: string) => void
  onQuickAction: (action: 'new-requisition' | 'new-file' | 'compose-mail', payload?: any) => void
}

export default function CMDDashboard({ user, onNavigate, onOpenRequisition, onOpenMail, onQuickAction }: Props) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/dashboard', { cache: 'no-store' })
      setData(await res.json())
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const act = async (reqId: string, action: string, closePermanently = false) => {
    try {
      const res = await fetch(`/api/requisitions/${reqId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, closePermanently, remarks: 'CMD action from dashboard' }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || 'Action failed')
      } else {
        toast.success(`Requisition ${action}${closePermanently ? ' & closed' : ''} successfully`)
        load()
      }
    } catch (e: any) {
      toast.error('Network error')
    }
  }

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
        </div>
        <Skeleton className="h-96 rounded-lg" />
      </div>
    )
  }

  const stats = data.stats
  const queue = data.cmd?.queue || []
  const mailPreview = data.cmd?.mailPreview || []
  const charts = data.charts

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#14532d] to-[#15803d] rounded-xl p-6 text-white shadow-md">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <div className="size-14 bg-white/15 rounded-lg flex items-center justify-center backdrop-blur">
              <ShieldCheck className="size-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">CMD Executive Dashboard</h1>
              <p className="text-white/80 text-sm mt-1">
                Dr. {user?.fullName?.replace(/^Dr\.?\s*/, '') || user?.fullName} — Chief Medical Director, FUTH LAFIA
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => onQuickAction('compose-mail')} size="sm">
              <Mail className="size-4" /> Compose
            </Button>
            <Button variant="outline" onClick={() => onNavigate('cmd-mail')} size="sm" className="bg-white/10 text-white border-white/30 hover:bg-white/20 hover:text-white">
              <Inbox className="size-4" /> Inbox ({stats.unreadMail})
            </Button>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <ExecCard
          label="Awaiting Your Approval"
          value={queue.length}
          icon={ShieldCheck}
          color="text-amber-700"
          bg="bg-amber-50"
          subtext={`${stats.urgentReqsForMe} urgent/critical`}
        />
        <ExecCard
          label="Unread Mail"
          value={stats.unreadMail}
          icon={Inbox}
          color="text-blue-700"
          bg="bg-blue-50"
          onClick={() => onNavigate('cmd-mail')}
        />
        <ExecCard
          label="Files Needing Action"
          value={stats.pendingFilesForMe}
          icon={FileText}
          color="text-violet-700"
          bg="bg-violet-50"
          onClick={() => onNavigate('files')}
        />
        <ExecCard
          label="Total Open Requisitions"
          value={stats.pendingReqsAll}
          icon={AlertTriangle}
          color="text-emerald-700"
          bg="bg-emerald-50"
        />
      </div>

      {/* Approval queue */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="size-4" /> CMD Approval Queue
            </CardTitle>
            <CardDescription>Requisitions routed to your desk awaiting decision</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onNavigate('requisitions')}>
            View all requisitions
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase text-muted-foreground border-b">
                  <th className="text-left px-4 py-2 font-medium">Ref</th>
                  <th className="text-left px-4 py-2 font-medium">Subject</th>
                  <th className="text-left px-4 py-2 font-medium hidden md:table-cell">Type</th>
                  <th className="text-left px-4 py-2 font-medium">Priority</th>
                  <th className="text-left px-4 py-2 font-medium hidden lg:table-cell">From</th>
                  <th className="text-left px-4 py-2 font-medium hidden md:table-cell">Amount</th>
                  <th className="text-right px-4 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {queue.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-muted-foreground">
                      <Check className="size-8 mx-auto text-green-500 mb-2" />
                      <div className="text-sm">No pending approvals. You're all caught up!</div>
                    </td>
                  </tr>
                ) : queue.map((r: any) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => onOpenRequisition(r.id)}
                        className="font-mono text-xs text-primary hover:underline"
                      >
                        {r.refNumber}
                      </button>
                    </td>
                    <td className="px-4 py-3 max-w-[260px]">
                      <button onClick={() => onOpenRequisition(r.id)} className="text-left hover:text-primary">
                        <div className="truncate font-medium">{r.subject}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1">{r.description}</div>
                      </button>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell"><TypeBadge type={r.type} /></td>
                    <td className="px-4 py-3"><PriorityBadge priority={r.priority} /></td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs">
                      {r.createdBy?.fullName}
                      {r.createdBy?.designation && (
                        <div className="text-muted-foreground">{r.createdBy.designation.code}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {r.amount ? (
                        <span className="font-mono text-xs font-semibold">
                          {formatNaira(r.amount)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={() => act(r.id, 'approve', true)}
                          title="Approve & Close"
                        >
                          <Check className="size-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => act(r.id, 'reject', true)}
                          title="Reject & Close"
                        >
                          <X className="size-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          onClick={() => onOpenRequisition(r.id)}
                          title="Open detail"
                        >
                          <ArrowRight className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Mini mail preview */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="size-4" /> Mail Inbox Preview
              </CardTitle>
              <CardDescription>Latest 5 messages</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('cmd-mail')}>
              Open inbox
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {mailPreview.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">No mail yet</div>
              ) : mailPreview.map((m: any) => (
                <button
                  key={m.id}
                  onClick={() => onOpenMail(m.id)}
                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-muted/50 text-left"
                >
                  <Avatar className="size-9">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {initials(m.from?.fullName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium truncate">{m.from?.fullName}</div>
                      <div className="text-[10px] text-muted-foreground flex-shrink-0">
                        {timeAgo(m.createdAt)}
                      </div>
                    </div>
                    <div className="text-sm truncate">{m.subject}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{m.body}</div>
                    {!m.isRead && <span className="inline-block mt-1 size-1.5 rounded-full bg-destructive" />}
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Trend chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Requisition Volume Trend</CardTitle>
            <CardDescription>Last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={charts.monthlyTrend} margin={{ left: -16, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#15803d" radius={[6, 6, 0, 0]} name="Requisitions" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function ExecCard({
  label, value, subtext, icon: Icon, color, bg, onClick,
}: {
  label: string
  value: number | string
  subtext?: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  bg: string
  onClick?: () => void
}) {
  return (
    <Card className={`${onClick ? 'cursor-pointer hover:shadow-md transition' : ''}`} onClick={onClick}>
      <CardContent className="p-4 lg:p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-2xl lg:text-3xl font-bold mt-1">{value}</div>
            {subtext && <div className="text-[11px] text-muted-foreground mt-1">{subtext}</div>}
          </div>
          <div className={`size-10 rounded-lg ${bg} ${color} flex items-center justify-center`}>
            <Icon className="size-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
