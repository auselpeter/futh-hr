'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Card, CardContent,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Plus, Search, FolderKanban, Filter, Download } from 'lucide-react'
import { formatNaira, formatDateTime, initials } from '@/lib/formatters'
import { StatusBadge, PriorityBadge, TypeBadge } from './badges'
import RequisitionCreate from './RequisitionCreate'
import RequisitionDetail from './RequisitionDetail'
import { exportToExcel } from '@/lib/export'
import { toast } from 'sonner'

const TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'service', label: 'Service' },
  { value: 'expense', label: 'Expense' },
  { value: 'other', label: 'Other' },
]
const PRIORITIES = ['all', 'Low', 'Normal', 'High', 'Urgent', 'Critical']

export default function Requisitions({ user }: { user: any }) {
  const [requisitions, setRequisitions] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [designations, setDesignations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [creating, setCreating] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ tab })
      if (search) params.set('q', search)
      if (typeFilter !== 'all') params.set('type', typeFilter)
      if (priorityFilter !== 'all') params.set('priority', priorityFilter)
      const [reqRes, userRes, dsgRes] = await Promise.all([
        fetch(`/api/requisitions?${params.toString()}`, { cache: 'no-store' }),
        fetch('/api/users', { cache: 'no-store' }),
        fetch('/api/designations', { cache: 'no-store' }),
      ])
      const reqData = await reqRes.json()
      const userData = await userRes.json()
      const dsgData = await dsgRes.json()
      setRequisitions(reqData.requisitions || [])
      setUsers(userData.users || [])
      setDesignations(dsgData.designations || [])
    } catch {
      toast.error('Failed to load requisitions')
    }
    setLoading(false)
  }, [tab, search, typeFilter, priorityFilter])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FolderKanban className="size-6" /> Requisitions
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {requisitions.length} requisitions — service, expense and other requests
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const rows = requisitions.map((r) => ({
                'Reference': r.refNumber,
                'Type': r.type,
                'Subject': r.subject,
                'Description': r.description,
                'Comment': r.comment || '',
                'Priority': r.priority,
                'Status': r.status,
                'State': r.state,
                'Amount': r.amount ?? '',
                'Created By': r.createdBy?.fullName || '',
                'Assignee': r.assignee?.fullName || r.targetDesignation?.code || '',
                'Created At': r.createdAt ? new Date(r.createdAt).toLocaleString() : '',
                'Closed At': r.closedAt ? new Date(r.closedAt).toLocaleString() : '',
                'CMD Signed': r.cmdSignedAt ? 'Yes' : 'No',
                'DFA Signed': r.dfaSignedAt ? 'Yes' : 'No',
                'DA Signed': r.daSignedAt ? 'Yes' : 'No',
                'HOD Signed': r.hodSignedAt ? 'Yes' : 'No',
              }))
              exportToExcel('FUTH_Requisitions', [{ name: 'Requisitions', rows }])
              toast.success(`Exported ${rows.length} requisitions`)
            }}
            disabled={!requisitions.length}
          >
            <Download className="size-4" /> Export to Excel
          </Button>
          <Button onClick={() => setCreating(true)} size="sm">
            <Plus className="size-4" /> New Requisition
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full sm:w-auto">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="pending">Pending My Action</TabsTrigger>
              <TabsTrigger value="mine">Submitted by Me</TabsTrigger>
              <TabsTrigger value="closed">Closed</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search ref, subject or description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-32"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Priority" /></SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p === 'all' ? 'All Priorities' : p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 rounded" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase text-muted-foreground border-b">
                    <th className="text-left px-4 py-3 font-medium">Reference</th>
                    <th className="text-left px-4 py-3 font-medium">Subject</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Type</th>
                    <th className="text-left px-4 py-3 font-medium">Priority</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Created By</th>
                    <th className="text-left px-4 py-3 font-medium hidden xl:table-cell">Assignee</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Created</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {requisitions.length === 0 ? (
                    <tr><td colSpan={9} className="text-center py-10 text-muted-foreground">
                      <Filter className="size-6 mx-auto mb-2 text-muted-foreground/50" />
                      No requisitions found for this filter
                    </td></tr>
                  ) : requisitions.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedId(r.id)}
                      className="border-b last:border-0 hover:bg-muted/50 cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs font-semibold text-primary">{r.refNumber}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="truncate max-w-[280px] font-medium">{r.subject}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1 max-w-[280px]">
                          {r.description}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell"><TypeBadge type={r.type} /></td>
                      <td className="px-4 py-3"><PriorityBadge priority={r.priority} /></td>
                      <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {r.createdBy && (
                          <div className="flex items-center gap-1.5">
                            <Avatar className="size-6">
                              <AvatarFallback className="bg-primary/15 text-primary text-[10px]">
                                {initials(r.createdBy.fullName)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs">{r.createdBy.fullName}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell text-xs">
                        {r.assignee ? r.assignee.fullName : r.targetDesignation ? `${r.targetDesignation.code} (designation)` : '—'}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">
                        {formatDateTime(r.createdAt)}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-xs font-mono">
                        {r.amount ? formatNaira(r.amount) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <RequisitionCreate
        open={creating}
        onClose={() => setCreating(false)}
        users={users}
        designations={designations}
        onCreated={load}
      />

      <RequisitionDetail
        id={selectedId}
        currentUser={user}
        users={users}
        designations={designations}
        onClose={() => setSelectedId(null)}
        onUpdated={load}
      />
    </div>
  )
}
