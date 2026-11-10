'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Card, CardContent,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
  GraduationCap, Plus, Search, Loader2, Download, Printer, Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDate, initials } from '@/lib/formatters'
import StaffSearch from './StaffSearch'
import { exportToExcel } from '@/lib/export'
import { printHTML, printHeader, htmlEscape, row, signatureBox } from '@/lib/print'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

const statusColor: Record<string, string> = {
  Open: 'bg-blue-100 text-blue-700',
  Ongoing: 'bg-amber-100 text-amber-700',
  Completed: 'bg-green-100 text-green-700',
  Cancelled: 'bg-red-100 text-red-700',
}

type Training = {
  id: string
  code: string
  title: string
  description: string | null
  type: string
  category: string | null
  provider: string | null
  facilitator: string | null
  location: string | null
  mode: string
  startDate: string
  endDate: string
  durationHours: number | null
  cost: number | null
  maxParticipants: number | null
  status: string
  department?: { id: string; code: string; name: string } | null
  enrollments?: any[]
  _count?: { enrollments: number }
}

type Props = { user: any }

const emptyForm = () => ({
  title: '',
  description: '',
  type: 'workshop',
  category: '',
  provider: '',
  facilitator: '',
  location: '',
  mode: 'physical',
  startDate: '',
  endDate: '',
  durationHours: '',
  cost: '',
  maxParticipants: '',
  departmentId: 'none',
})

export default function Trainings({ user }: Props) {
  const [trainings, setTrainings] = useState<Training[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [staff, setStaff] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [creating, setCreating] = useState(false)
  const [detail, setDetail] = useState<Training | null>(null)
  const [form, setForm] = useState<any>(emptyForm())
  const [saving, setSaving] = useState(false)

  const role = user?.activeRole || user?.role
  const canCreate = ['SUPER_ADMIN', 'ADMIN', 'CMD', 'CMA', 'AD', 'DFA', 'HOD', 'HOU', 'APPRAISAL_OFFICER'].includes(role)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [tRes, dRes, sRes] = await Promise.all([
        fetch('/api/trainings', { cache: 'no-store' }),
        fetch('/api/departments', { cache: 'no-store' }),
        fetch('/api/staff', { cache: 'no-store' }),
      ])
      const tData = await tRes.json()
      const dData = await dRes.json()
      const sData = await sRes.json()
      setTrainings(tData.trainings || [])
      setDepartments(dData.departments || [])
      setStaff(sData.staff || [])
    } catch {
      toast.error('Failed to load trainings')
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = trainings.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        (t.code || '').toLowerCase().includes(q) ||
        (t.title || '').toLowerCase().includes(q) ||
        (t.provider || '').toLowerCase().includes(q)
      )
    }
    return true
  })

  const save = async () => {
    if (!form.title || !form.startDate || !form.endDate) {
      toast.error('Title and dates are required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        departmentId: form.departmentId === 'none' ? null : form.departmentId,
        durationHours: form.durationHours ? Number(form.durationHours) : null,
        cost: form.cost ? Number(form.cost) : null,
        maxParticipants: form.maxParticipants ? Number(form.maxParticipants) : null,
      }
      const res = await fetch('/api/trainings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) toast.error(data.error || 'Failed to create training')
      else {
        toast.success(`Training created: ${data.training?.code}`)
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
            <GraduationCap className="size-6" /> Trainings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {trainings.length} training programs · {trainings.filter((t) => t.status === 'Open').length} open for enrollment
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!filtered.length}
            onClick={() => {
              const rows = filtered.map((t) => ({
                Code: t.code,
                Title: t.title,
                Type: t.type,
                Provider: t.provider || '',
                Start: formatDate(t.startDate),
                End: formatDate(t.endDate),
                Hours: t.durationHours || 0,
                Cost: t.cost || 0,
                Enrolled: t._count?.enrollments || 0,
                Max: t.maxParticipants || 0,
                Status: t.status,
              }))
              exportToExcel('FUTH_Trainings', [{ name: 'Trainings', rows }])
              toast.success(`Exported ${rows.length} trainings`)
            }}
          >
            <Download className="size-4" /> Export
          </Button>
          {canCreate && (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="size-4" /> New Training
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input placeholder="Search by code, title, provider..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="Open">Open</SelectItem>
              <SelectItem value="Ongoing">Ongoing</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
              <SelectItem value="Cancelled">Cancelled</SelectItem>
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
            <div className="text-center py-12 text-muted-foreground">No trainings found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase text-muted-foreground border-b">
                    <th className="text-left px-4 py-3">Code</th>
                    <th className="text-left px-4 py-3">Title</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">Type</th>
                    <th className="text-left px-4 py-3 hidden lg:table-cell">Provider</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">Dates</th>
                    <th className="text-center px-4 py-3">Enrolled</th>
                    <th className="text-center px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => (
                    <tr key={t.id} className="border-b last:border-0 hover:bg-muted/50 cursor-pointer" onClick={() => setDetail(t)}>
                      <td className="px-4 py-3 font-mono text-xs">{t.code}</td>
                      <td className="px-4 py-3 font-medium">{t.title}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs">{t.type}</td>
                      <td className="px-4 py-3 hidden lg:table-cell text-xs">{t.provider || '—'}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs">{formatDate(t.startDate)} → {formatDate(t.endDate)}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="outline" className="text-[10px]">
                          {t._count?.enrollments || 0}{t.maxParticipants ? ` / ${t.maxParticipants}` : ''}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] px-2 py-0.5 rounded ${statusColor[t.status] || 'bg-gray-100'}`}>{t.status}</span>
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
            <DialogTitle>New Training Program</DialogTitle>
            <DialogDescription>Create a training program for staff enrollment</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Title *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="ICD-10 Coding Workshop" />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="workshop">Workshop</SelectItem>
                    <SelectItem value="seminar">Seminar</SelectItem>
                    <SelectItem value="course">Course</SelectItem>
                    <SelectItem value="conference">Conference</SelectItem>
                    <SelectItem value="certification">Certification</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Mode</Label>
                <Select value={form.mode} onValueChange={(v) => setForm({ ...form, mode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="physical">Physical</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Department</Label>
                <Select value={form.departmentId} onValueChange={(v) => setForm({ ...form, departmentId: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Provider</Label><Input value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} /></div>
              <div><Label>Facilitator</Label><Input value={form.facilitator} onChange={(e) => setForm({ ...form, facilitator: e.target.value })} /></div>
              <div><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
              <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
              <div><Label>Start Date *</Label><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
              <div><Label>End Date *</Label><Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
              <div><Label>Duration (hours)</Label><Input type="number" value={form.durationHours} onChange={(e) => setForm({ ...form, durationHours: e.target.value })} /></div>
              <div><Label>Max Participants</Label><Input type="number" value={form.maxParticipants} onChange={(e) => setForm({ ...form, maxParticipants: e.target.value })} /></div>
              <div><Label>Cost (₦)</Label><Input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />} Create Training
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TrainingDetailSheet item={detail} onClose={() => setDetail(null)} staff={staff} />
    </div>
  )
}

function TrainingDetailSheet({ item, onClose, staff }: { item: Training | null; onClose: () => void; staff: any[] }) {
  const [current, setCurrent] = useState<Training | null>(null)
  const [loading, setLoading] = useState(false)
  const [enrollStaffId, setEnrollStaffId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (item) {
      setCurrent(item)
      setLoading(true)
      fetch(`/api/trainings/${item.id}`, { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => { if (d.training) setCurrent(d.training) })
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

  const enroll = async () => {
    if (!enrollStaffId) return toast.error('Select a staff member')
    setSubmitting(true)
    try {
      const res = await fetch(`/api/trainings/${current.id}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: enrollStaffId }),
      })
      const data = await res.json()
      if (!res.ok) toast.error(data.error || 'Failed to enroll')
      else {
        toast.success('Staff enrolled')
        setEnrollStaffId('')
        const d = await fetch(`/api/trainings/${current.id}`, { cache: 'no-store' }).then((r) => r.json())
        if (d.training) setCurrent(d.training)
      }
    } catch {
      toast.error('Network error')
    }
    setSubmitting(false)
  }

  const printCertificate = async (enr: any) => {
    const institution = 'FEDERAL UNIVERSITY TEACHING HOSPITAL'
    const subLine = 'Office of Training & Capacity Building · Certificate of Participation'
    const html =
      printHeader(institution, subLine, current.code, 'Certificate of Participation') +
      `
      <div style="text-align: center; padding: 40px 20px; border: 4px double #14532d; margin: 30px 0; background: #fafafa;">
        <div style="font-size: 28px; color: #14532d; font-weight: bold; margin-bottom: 10px;">Certificate of Participation</div>
        <div style="font-size: 14px; color: #666; margin-bottom: 30px;">This is to certify that</div>
        <div style="font-size: 24px; font-weight: bold; color: #15803d; margin-bottom: 10px; text-decoration: underline;">${htmlEscape(enr.staff?.fullName)}</div>
        <div style="font-size: 14px; color: #666;">Staff ID: ${htmlEscape(enr.staff?.staffId || '—')}</div>
        <div style="font-size: 14px; color: #666; margin-top: 20px;">has successfully participated in</div>
        <div style="font-size: 20px; font-weight: bold; margin: 10px 0;">${htmlEscape(current.title)}</div>
        <div style="font-size: 12px; color: #666;">held from ${formatDate(current.startDate)} to ${formatDate(current.endDate)}</div>
        ${current.durationHours ? `<div style="font-size: 12px; color: #666;">Duration: ${current.durationHours} hours</div>` : ''}
        ${current.provider ? `<div style="font-size: 12px; color: #666;">Conducted by: ${htmlEscape(current.provider)}</div>` : ''}
      </div>
      <div>
        ${signatureBox('Facilitator', current.facilitator, null, null)}
        ${signatureBox('Training Coordinator', null, null, null)}
      </div>
      `
    await printHTML(html, `Certificate — ${enr.staff?.fullName} — ${current.code}`)
  }

  return (
    <Sheet open={!!item} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 overflow-y-auto">
        <SheetHeader className="bg-gradient-to-br from-[#14532d] to-[#15803d] text-white p-6">
          <SheetTitle className="text-white">{current.title}</SheetTitle>
          <SheetDescription className="text-white/80">
            {current.code} · {current.type} · {current.status}
          </SheetDescription>
        </SheetHeader>
        <div className="p-6 space-y-5">
          {loading && <Skeleton className="h-6 w-32" />}

          <Section title="Programme Details">
            <Row label="Code" value={current.code} />
            <Row label="Type" value={current.type} />
            <Row label="Mode" value={current.mode} />
            <Row label="Category" value={current.category || '—'} />
            <Row label="Provider" value={current.provider || '—'} />
            <Row label="Facilitator" value={current.facilitator || '—'} />
            <Row label="Location" value={current.location || '—'} />
            <Row label="Start Date" value={formatDate(current.startDate)} />
            <Row label="End Date" value={formatDate(current.endDate)} />
            <Row label="Duration (hours)" value={current.durationHours || '—'} />
            <Row label="Max Participants" value={current.maxParticipants || 'Unlimited'} />
            <Row label="Department" value={current.department?.name || '—'} />
          </Section>

          <Section title="Description">
            <p className="text-sm text-muted-foreground">{current.description || '—'}</p>
          </Section>

          <Section title={`Enrollments (${current.enrollments?.length || 0})`}>
            <div className="space-y-2 mb-3">
              {(current.enrollments || []).map((enr: any) => (
                <div key={enr.id} className="flex items-center gap-2 text-sm border rounded p-2">
                  <Avatar className="size-6">
                    <AvatarFallback className="bg-primary/15 text-primary text-[9px]">{initials(enr.staff?.fullName || '?')}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="font-medium">{enr.staff?.fullName || '—'}</div>
                    <div className="text-[10px] text-muted-foreground">{enr.staff?.staffId}</div>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{enr.status}</Badge>
                  <Button size="sm" variant="ghost" onClick={() => printCertificate(enr)} title="Print certificate">
                    <Printer className="size-3" />
                  </Button>
                </div>
              ))}
              {(current.enrollments || []).length === 0 && <div className="text-xs text-muted-foreground">No enrollments yet</div>}
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <StaffSearch
                  staff={staff}
                  value={enrollStaffId}
                  onChange={setEnrollStaffId}
                  filter={(s) => !(current.enrollments || []).some((e: any) => e.staffId === s.id)}
                  placeholder="Search staff to enroll..."
                />
              </div>
              <Button size="sm" onClick={enroll} disabled={submitting}>
                {submitting ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-4" />} Enroll
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

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1 border-b">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value || '—'}</span>
    </div>
  )
}
