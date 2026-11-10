'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  Users, Building2, FolderKanban, FileText, Plus, MailPlus,
  TrendingUp, Inbox, AlertTriangle, CheckCircle2, Activity,
} from 'lucide-react'
import { formatNaira, formatNairaCompact, formatDateTime, timeAgo, initials } from '@/lib/formatters'
import { StatusBadge, PriorityBadge, TypeBadge } from './badges'
import MyPendingApprovals from './MyPendingApprovals'
import type { ViewKey } from './Sidebar'

const PIE_COLORS = ['#15803d', '#0ea5e9', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

type Props = {
  user: any
  onNavigate: (v: ViewKey) => void
  onQuickAction: (action: 'new-requisition' | 'new-file' | 'compose-mail', payload?: any) => void
}

export default function Dashboard({ user, onNavigate, onQuickAction }: Props) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/dashboard', { cache: 'no-store' })
      const json = await res.json()
      setData(json)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
        </div>
        <div className="grid lg:grid-cols-3 gap-4">
          <Skeleton className="h-72 rounded-lg" />
          <Skeleton className="h-72 rounded-lg" />
          <Skeleton className="h-72 rounded-lg" />
        </div>
      </div>
    )
  }

  const stats = data.stats
  const charts = data.charts
  const recent = data.recent
  const isRegistry = ['SUPER_ADMIN', 'ADMIN', 'REGISTRY_OFFICER'].includes(user?.role)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Welcome back, {user?.fullName?.split(' ').slice(-1)[0]} 👋</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Here's your institutional overview for FUTH LAFIA today.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => onQuickAction('new-requisition')} size="sm">
            <Plus className="size-4" /> New Requisition
          </Button>
          {isRegistry && (
            <Button onClick={() => onQuickAction('new-file')} size="sm" variant="outline">
              <Plus className="size-4" /> New File
            </Button>
          )}
          <Button onClick={() => onQuickAction('compose-mail')} size="sm" variant="outline">
            <MailPlus className="size-4" /> Compose Mail
          </Button>
        </div>
      </div>

      {/* === My Pending Approvals widget (top, full-width) === */}
      <MyPendingApprovals onNavigate={onNavigate} />

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Staff"
          value={stats.totalStaff}
          icon={Users}
          color="text-emerald-700"
          bg="bg-emerald-50"
        />
        <StatCard
          label="Departments"
          value={stats.totalDepartments}
          icon={Building2}
          color="text-blue-700"
          bg="bg-blue-50"
        />
        <StatCard
          label="Pending Requisitions"
          value={stats.pendingReqsForMe}
          subtext={`of ${stats.pendingReqsAll} total`}
          icon={FolderKanban}
          color="text-amber-700"
          bg="bg-amber-50"
          onClick={() => onNavigate('requisitions')}
        />
        <StatCard
          label="Pending Files"
          value={stats.pendingFilesForMe}
          subtext={`of ${stats.pendingFilesAll} total`}
          icon={FileText}
          color="text-violet-700"
          bg="bg-violet-50"
          onClick={() => onNavigate('files')}
        />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="size-4" /> Requisition Trend (6 months)
            </CardTitle>
            <CardDescription>Monthly requisition submissions across the institution</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={charts.monthlyTrend} margin={{ left: -16, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#15803d"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#15803d' }}
                  name="Requisitions"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Requisitions by Type</CardTitle>
            <CardDescription>Distribution across all requisitions</CardDescription>
          </CardHeader>
          <CardContent>
            {charts.reqsByType.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-12">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={charts.reqsByType}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={3}
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {charts.reqsByType.map((_: any, i: number) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="size-4" /> Staff Distribution by Department
          </CardTitle>
          <CardDescription>Top departments by staff count</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={charts.staffByDepartment} margin={{ left: -16, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="code" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                formatter={(v: any) => [`${v} staff`, 'Count']}
                labelFormatter={(l: any, payload: any) => {
                  const item = payload?.[0]?.payload
                  return item ? `${item.name}` : l
                }}
              />
              <Bar dataKey="count" fill="#15803d" name="Staff count" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Recent tables */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <FolderKanban className="size-4" /> Recent Requisitions
              </CardTitle>
              <CardDescription>Latest 5 submissions</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('requisitions')}>
              View all
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase text-muted-foreground border-b">
                    <th className="text-left px-4 py-2 font-medium">Ref</th>
                    <th className="text-left px-4 py-2 font-medium">Subject</th>
                    <th className="text-left px-4 py-2 font-medium">Priority</th>
                    <th className="text-left px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.requisitions.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-6 text-muted-foreground">No requisitions yet</td></tr>
                  ) : recent.requisitions.map((r: any) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/50 cursor-pointer" onClick={() => onNavigate('requisitions')}>
                      <td className="px-4 py-2 font-mono text-xs">{r.refNumber}</td>
                      <td className="px-4 py-2 max-w-[200px] truncate">{r.subject}</td>
                      <td className="px-4 py-2"><PriorityBadge priority={r.priority} /></td>
                      <td className="px-4 py-2"><StatusBadge status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="size-4" /> Recent Files
              </CardTitle>
              <CardDescription>Latest 5 registry files</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('files')}>
              View all
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase text-muted-foreground border-b">
                    <th className="text-left px-4 py-2 font-medium">File #</th>
                    <th className="text-left px-4 py-2 font-medium">Subject</th>
                    <th className="text-left px-4 py-2 font-medium">Type</th>
                    <th className="text-left px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.files.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-6 text-muted-foreground">No files yet</td></tr>
                  ) : recent.files.map((f: any) => (
                    <tr key={f.id} className="border-b last:border-0 hover:bg-muted/50 cursor-pointer" onClick={() => onNavigate('files')}>
                      <td className="px-4 py-2 font-mono text-xs">{f.fileNumber}</td>
                      <td className="px-4 py-2 max-w-[200px] truncate">{f.subject}</td>
                      <td className="px-4 py-2"><TypeBadge type={f.type} /></td>
                      <td className="px-4 py-2"><StatusBadge status={f.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatCard({
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
    <Card
      className={`overflow-hidden ${onClick ? 'cursor-pointer hover:shadow-md transition' : ''}`}
      onClick={onClick}
    >
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
