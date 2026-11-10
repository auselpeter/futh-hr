'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Card, CardContent,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import {
  FolderKanban, Plus, Search, Loader2, Download, Calendar, Users, Target, CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDate, formatNaira, formatNairaCompact, initials } from '@/lib/formatters'
import StaffSearch from './StaffSearch'
import { exportToExcel } from '@/lib/export'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

const statusColor: Record<string, string> = {
  Planned: 'bg-gray-100 text-gray-700',
  'In Progress': 'bg-blue-100 text-blue-700',
  On_Hold: 'bg-amber-100 text-amber-700',
  Completed: 'bg-green-100 text-green-700',
  Cancelled: 'bg-red-100 text-red-700',
}

const priorityColor: Record<string, string> = {
  Low: 'bg-gray-100 text-gray-700',
  Normal: 'bg-blue-100 text-blue-700',
  High: 'bg-amber-100 text-amber-700',
  Urgent: 'bg-red-100 text-red-700',
  Critical: 'bg-red-200 text-red-900',
}

type Project = {
  id: string
  code: string
  title: string
  description: string | null
  type: string
  category: string | null
  priority: string
  sponsorId: string | null
  departmentId: string | null
  startDate: string
  endDate: string | null
  budget: number | null
  spent: number
  currency: string
  fundingSource: string | null
  progress: number
  status: string
  department?: { id: string; code: string; name: string } | null
  members?: any[]
  milestones?: any[]
  _count?: { members: number; milestones: number }
}

type Props = { user: any }

const emptyForm = () => ({
  title: '',
  description: '',
  type: 'institutional',
  category: '',
  priority: 'Normal',
  departmentId: 'none',
  startDate: '',
  endDate: '',
  budget: '',
  currency: 'NGN',
  fundingSource: '',
})

export default function Projects({ user }: Props) {
  const [projects, setProjects] = useState<Project[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [staff, setStaff] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [creating, setCreating] = useState(false)
  const [detail, setDetail] = useState<Project | null>(null)
  const [form, setForm] = useState<any>(emptyForm())
  const [saving, setSaving] = useState(false)

  const role = user?.activeRole || user?.role
  const canCreate = ['SUPER_ADMIN', 'ADMIN', 'CMD', 'CMA', 'AD', 'DFA', 'HOD', 'HOU'].includes(role)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [pRes, dRes, sRes] = await Promise.all([
        fetch('/api/projects', { cache: 'no-store' }),
        fetch('/api/departments', { cache: 'no-store' }),
        fetch('/api/staff', { cache: 'no-store' }),
      ])
      const pData = await pRes.json()
      const dData = await dRes.json()
      const sData = await sRes.json()
      setProjects(pData.projects || [])
      setDepartments(dData.departments || [])
      setStaff(sData.staff || [])
    } catch {
      toast.error('Failed to load projects')
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = projects.filter((p) => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false
    if (priorityFilter !== 'all' && p.priority !== priorityFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        (p.code || '').toLowerCase().includes(q) ||
        (p.title || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
      )
    }
    return true
  })

  const save = async () => {
    if (!form.title || !form.startDate) {
      toast.error('Title and start date are required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        departmentId: form.departmentId === 'none' ? null : form.departmentId,
        budget: form.budget ? Number(form.budget) : null,
        endDate: form.endDate || null,
      }
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) toast.error(data.error || 'Failed to create project')
      else {
        toast.success(`Project created: ${data.project?.code}`)
        setCreating(false)
        setForm(emptyForm())
        load()
      }
    } catch {
      toast.error('Network error')
    }
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FolderKanban className="size-6" /> Projects
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {projects.length} institutional projects · {projects.filter((p) => p.status === 'In Progress').length} active
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!filtered.length}
            onClick={() => {
              const rows = filtered.map((p) => ({
                Code: p.code,
                Title: p.title,
                Type: p.type,
                Priority: p.priority,
                Department: p.department?.name || '',
                Start: formatDate(p.startDate),
                End: formatDate(p.endDate),
                Budget: p.budget || 0,
                Spent: p.spent || 0,
                Progress: p.progress,
                Status: p.status,
              }))
              exportToExcel('FUTH_Projects', [{ name: 'Projects', rows }])
              toast.success(`Exported ${rows.length} projects`)
            }}
          >
            <Download className="size-4" /> Export
          </Button>
          {canCreate && (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="size-4" /> New Project
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input placeholder="Search by code, title..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="Planned">Planned</SelectItem>
              <SelectItem value="In Progress">In Progress</SelectItem>
              <SelectItem value="On Hold">On Hold</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
              <SelectItem value="Cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="Low">Low</SelectItem>
              <SelectItem value="Normal">Normal</SelectItem>
              <SelectItem value="High">High</SelectItem>
              <SelectItem value="Urgent">Urgent</SelectItem>
              <SelectItem value="Critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No projects found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase text-muted-foreground border-b">
                    <th className="text-left px-4 py-3">Code</th>
                    <th className="text-left px-4 py-3">Title</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">Department</th>
                    <th className="text-left px-4 py-3 hidden lg:table-cell">Priority</th>
                    <th className="text-center px-4 py-3">Progress</th>
                    <th className="text-right px-4 py-3 hidden md:table-cell">Budget</th>
                    <th className="text-center px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/50 cursor-pointer" onClick={() => setDetail(p)}>
                      <td className="px-4 py-3 font-mono text-xs">{p.code}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{p.title}</div>
                        <div className="text-[10px] text-muted-foreground">{p.type}</div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs">{p.department?.name || '—'}</td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className={`text-[10px] px-2 py-0.5 rounded ${priorityColor[p.priority] || 'bg-gray-100'}`}>{p.priority}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 min-w-[120px]">
                          <Progress value={p.progress} className="h-2 flex-1" />
                          <span className="text-[10px] font-mono w-8">{p.progress}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right hidden md:table-cell text-xs">{p.budget ? formatNairaCompact(p.budget) : '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] px-2 py-0.5 rounded ${statusColor[p.status] || 'bg-gray-100'}`}>{p.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={creating} onOpenChange={(o) => { if (!o) setCreating(false) }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
            <DialogDescription>Create an institutional project with members and milestones</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Title *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="ICT Infrastructure Modernisation" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="institutional">Institutional</SelectItem>
                    <SelectItem value="clinical">Clinical</SelectItem>
                    <SelectItem value="research">Research</SelectItem>
                    <SelectItem value="infrastructure">Infrastructure</SelectItem>
                    <SelectItem value="training">Training</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Normal">Normal</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Urgent">Urgent</SelectItem>
                    <SelectItem value="Critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Department</Label>
                <Select value={form.departmentId} onValueChange={(v) => setForm({ ...form, departmentId: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Category</Label>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="IT, Construction, etc." />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Start Date *</Label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div>
                <Label>End Date</Label>
                <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
              <div>
                <Label>Currency</Label>
                <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NGN">NGN (₦)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Budget</Label>
                <Input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
              </div>
              <div>
                <Label>Funding Source</Label>
                <Input value={form.fundingSource} onChange={(e) => setForm({ ...form, fundingSource: e.target.value })} placeholder="Internal, FG, Donor" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />} Create Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProjectDetailSheet item={detail} onClose={() => setDetail(null)} staff={staff} />
    </div>
  )
}

function ProjectDetailSheet({ item, onClose, staff }: { item: Project | null; onClose: () => void; staff: any[] }) {
  const [current, setCurrent] = useState<Project | null>(null)
  const [loading, setLoading] = useState(false)
  const [memberStaffId, setMemberStaffId] = useState('')
  const [memberRole, setMemberRole] = useState('Member')
  const [milestoneTitle, setMilestoneTitle] = useState('')
  const [milestoneDue, setMilestoneDue] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (item) {
      setCurrent(item)
      setLoading(true)
      fetch(`/api/projects/${item.id}`, { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => { if (d.project) setCurrent(d.project) })
        .catch(() => {})
        .finally(() => setLoading(false))
    } else {
      setCurrent(null)
    }
  }, [item])

  if (!current) {
    return (
      <Sheet open={!!item} onOpenChange={(o) => { if (!o) onClose() }}>
        <SheetContent side="right" className="w-full sm:max-w-2xl" />
      </Sheet>
    )
  }

  const addMember = async () => {
    if (!memberStaffId) return toast.error('Select a staff member first')
    setSubmitting(true)
    try {
      const res = await fetch(`/api/projects/${current.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: memberStaffId, role: memberRole }),
      })
      const data = await res.json()
      if (!res.ok) toast.error(data.error || 'Failed')
      else {
        toast.success('Member added')
        setMemberStaffId('')
        setMemberRole('Member')
        const d = await fetch(`/api/projects/${current.id}`, { cache: 'no-store' }).then((r) => r.json())
        if (d.project) setCurrent(d.project)
      }
    } catch {
      toast.error('Network error')
    }
    setSubmitting(false)
  }

  const addMilestone = async () => {
    if (!milestoneTitle || !milestoneDue) return toast.error('Title and due date are required')
    setSubmitting(true)
    try {
      const res = await fetch(`/api/projects/${current.id}/milestones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: milestoneTitle, dueDate: milestoneDue }),
      })
      const data = await res.json()
      if (!res.ok) toast.error(data.error || 'Failed')
      else {
        toast.success('Milestone added')
        setMilestoneTitle('')
        setMilestoneDue('')
        const d = await fetch(`/api/projects/${current.id}`, { cache: 'no-store' }).then((r) => r.json())
        if (d.project) setCurrent(d.project)
      }
    } catch {
      toast.error('Network error')
    }
    setSubmitting(false)
  }

  const setProgress = async (val: number) => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/projects/${current.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progress: val }),
      })
      if (!res.ok) toast.error('Failed to update progress')
      else { setCurrent({ ...current, progress: val }); toast.success('Progress updated') }
    } catch {
      toast.error('Network error')
    }
    setSubmitting(false)
  }

  return (
    <Sheet open={!!item} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 overflow-y-auto">
        <SheetHeader className="bg-gradient-to-br from-[#14532d] to-[#15803d] text-white p-6">
          <SheetTitle className="text-white">{current.title}</SheetTitle>
          <SheetDescription className="text-white/80">
            {current.code} · {current.type} · {current.priority} priority
          </SheetDescription>
        </SheetHeader>
        <div className="p-6 space-y-5">
          {loading && <Skeleton className="h-6 w-32" />}

          <div className="grid grid-cols-3 gap-3">
            <StatCard icon={<Calendar className="size-4" />} label="Start" value={formatDate(current.startDate)} />
            <StatCard icon={<Target className="size-4" />} label="End" value={formatDate(current.endDate)} />
            <StatCard icon={<Users className="size-4" />} label="Members" value={current._count?.members || current.members?.length || 0} />
          </div>

          <Section title="Description">
            <p className="text-sm text-muted-foreground">{current.description || '—'}</p>
          </Section>

          <Section title="Budget & Progress">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm">
                <div className="text-muted-foreground text-xs">Budget: {current.budget ? formatNaira(current.budget) : '—'}</div>
                <div className="text-muted-foreground text-xs">Spent: {current.spent ? formatNaira(current.spent) : '₦0'}</div>
              </div>
              <div className="text-2xl font-bold">{current.progress}%</div>
            </div>
            <Progress value={current.progress} className="h-3" />
            <div className="flex gap-2 mt-3 flex-wrap">
              {[0, 25, 50, 75, 100].map((v) => (
                <Button
                  key={v}
                  size="sm"
                  variant={current.progress === v ? 'default' : 'outline'}
                  disabled={submitting}
                  onClick={() => setProgress(v)}
                >
                  {v}%
                </Button>
              ))}
            </div>
          </Section>

          <Section title={`Members (${current.members?.length || 0})`}>
            <div className="space-y-2 mb-3">
              {(current.members || []).map((m: any) => (
                <div key={m.id} className="flex items-center gap-2 text-sm border rounded p-2">
                  <Avatar className="size-6">
                    <AvatarFallback className="bg-primary/15 text-primary text-[9px]">{initials(m.staff?.fullName || '?')}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="font-medium">{m.staff?.fullName || '—'}</div>
                    <div className="text-[10px] text-muted-foreground">{m.staff?.staffId}</div>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{m.role}</Badge>
                </div>
              ))}
              {(current.members || []).length === 0 && <div className="text-xs text-muted-foreground">No members yet</div>}
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <StaffSearch  value={memberStaffId} onChange={setMemberStaffId} placeholder="Search staff to add..." />
              </div>
              <Input value={memberRole} onChange={(e) => setMemberRole(e.target.value)} placeholder="Role" className="w-32" />
              <Button size="sm" onClick={addMember} disabled={submitting}>
                {submitting ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-4" />} Add
              </Button>
            </div>
          </Section>

          <Section title={`Milestones (${current.milestones?.length || 0})`}>
            <div className="space-y-2 mb-3">
              {(current.milestones || []).map((m: any) => (
                <div key={m.id} className="flex items-center gap-2 text-sm border rounded p-2">
                  <CheckCircle2 className={`size-4 ${m.status === 'Completed' ? 'text-green-600' : 'text-muted-foreground'}`} />
                  <div className="flex-1">
                    <div className="font-medium">{m.title}</div>
                    <div className="text-[10px] text-muted-foreground">Due: {formatDate(m.dueDate)}</div>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{m.status}</Badge>
                </div>
              ))}
              {(current.milestones || []).length === 0 && <div className="text-xs text-muted-foreground">No milestones yet</div>}
            </div>
            <div className="flex gap-2">
              <Input value={milestoneTitle} onChange={(e) => setMilestoneTitle(e.target.value)} placeholder="Milestone title..." className="flex-1" />
              <Input type="date" value={milestoneDue} onChange={(e) => setMilestoneDue(e.target.value)} className="w-44" />
              <Button size="sm" onClick={addMilestone} disabled={submitting}>
                {submitting ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-4" />} Add
              </Button>
            </div>
          </Section>
        </div>
        <SheetFooter className="px-6 pb-6">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-primary">{title}</h3>
      <div className="space-y-2 text-sm">{children}</div>
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded border p-3">
      <div className="size-6 rounded bg-primary/10 text-primary flex items-center justify-center mb-1">{icon}</div>
      <div className="text-[10px] text-muted-foreground uppercase">{label}</div>
      <div className="text-xs font-semibold">{value}</div>
    </div>
  )
}
