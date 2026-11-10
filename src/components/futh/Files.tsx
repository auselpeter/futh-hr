'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Card, CardContent,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, FileText, Filter, Download, Users2 } from 'lucide-react'
import { formatDateTime, initials } from '@/lib/formatters'
import { StatusBadge, PriorityBadge, TypeBadge } from './badges'
import FileCreate from './FileCreate'
import FileDetail from './FileDetail'
import { exportToExcel } from '@/lib/export'
import { toast } from 'sonner'

const TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'individual', label: 'Individual' },
  { value: 'department', label: 'Department' },
  { value: 'external', label: 'External' },
  { value: 'committee', label: 'Committee' },
]

type Props = {
  user: any
  initialCommitteeFilter?: string | null
}

export default function Files({ user, initialCommitteeFilter }: Props) {
  const [files, setFiles] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [designations, setDesignations] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [staffList, setStaffList] = useState<any[]>([])
  const [committees, setCommittees] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [committeeFilter, setCommitteeFilter] = useState<string | null>(initialCommitteeFilter || null)
  const [creating, setCreating] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // When the parent passes a new committee filter (from Committees page), update state
  useEffect(() => {
    if (initialCommitteeFilter !== undefined) {
      setCommitteeFilter(initialCommitteeFilter)
      setTypeFilter('committee')
    }
  }, [initialCommitteeFilter])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ tab })
      if (search) params.set('q', search)
      if (typeFilter !== 'all') params.set('type', typeFilter)
      if (committeeFilter) params.set('committeeId', committeeFilter)
      const [fileRes, userRes, dsgRes, deptRes, staffRes, comRes] = await Promise.all([
        fetch(`/api/files?${params.toString()}`, { cache: 'no-store' }),
        fetch('/api/users', { cache: 'no-store' }),
        fetch('/api/designations', { cache: 'no-store' }),
        fetch('/api/departments', { cache: 'no-store' }),
        fetch('/api/staff', { cache: 'no-store' }),
        fetch('/api/committees', { cache: 'no-store' }),
      ])
      setFiles((await fileRes.json()).files || [])
      setUsers((await userRes.json()).users || [])
      setDesignations((await dsgRes.json()).designations || [])
      setDepartments((await deptRes.json()).departments || [])
      setStaffList((await staffRes.json()).staff || [])
      setCommittees((await comRes.json()).committees || [])
    } catch {
      toast.error('Failed to load files')
    }
    setLoading(false)
  }, [tab, search, typeFilter, committeeFilter])

  useEffect(() => { load() }, [load])

  const isRegistry = ['SUPER_ADMIN', 'ADMIN', 'REGISTRY_OFFICER'].includes(user?.role)

  const handleExport = () => {
    const rows = files.map((f) => ({
      'File #': f.fileNumber,
      'Type': f.type,
      'Subject': f.subject,
      'Description': f.description,
      'Priority': f.priority,
      'Status': f.status,
      'State': f.state,
      'Created By': f.createdBy?.fullName || '',
      'Current Holder': f.currentHolder?.fullName || (f.targetDesignation?.code ? `${f.targetDesignation.code} (designation)` : ''),
      'Committee': f.committee?.name || '',
      'Department': f.department?.code || '',
      'Created At': f.createdAt ? new Date(f.createdAt).toLocaleString() : '',
      'Closed At': f.closedAt ? new Date(f.closedAt).toLocaleString() : '',
    }))
    exportToExcel('FUTH_Registry_Files', [{ name: 'Files', rows }])
    toast.success(`Exported ${rows.length} files`)
  }

  const activeCommittee = committees.find((c) => c.id === committeeFilter)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="size-6" /> Registry Files
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {files.length} files — individual, department, external & committee records
            {activeCommittee && (
              <>
                {' · '}filtered by committee{' '}
                <Badge variant="outline" className="ml-1 text-primary">
                  <Users2 className="size-3 mr-1" />
                  {activeCommittee.code} — {activeCommittee.name}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-1 h-6 text-xs"
                  onClick={() => { setCommitteeFilter(null); setTypeFilter('all') }}
                >
                  Clear filter
                </Button>
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!files.length}>
            <Download className="size-4" /> Export to Excel
          </Button>
          {isRegistry && (
            <Button onClick={() => setCreating(true)} size="sm">
              <Plus className="size-4" /> New File
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full sm:w-auto">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="pending">Pending My Action</TabsTrigger>
              <TabsTrigger value="mine">Created by Me</TabsTrigger>
              <TabsTrigger value="archived">Archived</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search file #, subject..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
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
                    <th className="text-left px-4 py-3 font-medium">File #</th>
                    <th className="text-left px-4 py-3 font-medium">Subject</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Type</th>
                    <th className="text-left px-4 py-3 font-medium">Priority</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Created By</th>
                    <th className="text-left px-4 py-3 font-medium hidden xl:table-cell">Current Holder</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {files.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">
                      <Filter className="size-6 mx-auto mb-2 text-muted-foreground/50" />
                      No files found
                    </td></tr>
                  ) : files.map((f) => (
                    <tr
                      key={f.id}
                      onClick={() => setSelectedId(f.id)}
                      className="border-b last:border-0 hover:bg-muted/50 cursor-pointer"
                    >
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{f.fileNumber}</td>
                      <td className="px-4 py-3">
                        <div className="truncate max-w-[280px] font-medium">{f.subject}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1 max-w-[280px]">{f.description}</div>
                        {f.committee && (
                          <Badge variant="outline" className="text-[10px] mt-0.5">
                            <Users2 className="size-2.5 mr-1" />
                            {f.committee.code}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell"><TypeBadge type={f.type} /></td>
                      <td className="px-4 py-3"><PriorityBadge priority={f.priority} /></td>
                      <td className="px-4 py-3"><StatusBadge status={f.status} /></td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {f.createdBy && (
                          <div className="flex items-center gap-1.5">
                            <Avatar className="size-6">
                              <AvatarFallback className="bg-primary/15 text-primary text-[10px]">
                                {initials(f.createdBy.fullName)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs">{f.createdBy.fullName}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell text-xs">
                        {f.currentHolder ? f.currentHolder.fullName :
                          f.targetDesignation ? `${f.targetDesignation.code} (designation)` : '—'}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">
                        {formatDateTime(f.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <FileCreate
        open={creating}
        onClose={() => setCreating(false)}
        users={users}
        designations={designations}
        departments={departments}
        staffList={staffList}
        committees={committees}
        onCreated={load}
      />

      <FileDetail
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
