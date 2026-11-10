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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Building2, Plus, Search, Pencil, Save, Loader2, Download, Users, Network,
} from 'lucide-react'
import { toast } from 'sonner'
import { exportToExcel } from '@/lib/export'
import UserSearch from './UserSearch'

type Department = {
  id: string
  code: string
  name: string
  faculty: string | null
  hodUserId: string | null
  isActive: boolean
  createdAt: string
  hodUser?: { id: string; fullName: string; username: string } | null
  _count?: { users: number; staff: number; units: number }
}

type Props = {
  user: any
}

const emptyForm = () => ({
  code: '',
  name: '',
  faculty: '',
  hodUserId: 'none',
  isActive: true,
})

export default function Departments({ user }: Props) {
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Department | null>(null)
  const [creating, setCreating] = useState(false)
  const [detail, setDetail] = useState<Department | null>(null)
  const [form, setForm] = useState<any>(emptyForm())
  const [saving, setSaving] = useState(false)

  const role = user?.activeRole || user?.role
  const canMutate = ['SUPER_ADMIN', 'ADMIN', 'CMD', 'CMA', 'AD', 'DFA', 'HOD'].includes(role)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const dRes = await fetch('/api/departments', { cache: 'no-store' })
      const dData = await dRes.json()
      setDepartments(dData.departments || [])
    } catch {
      toast.error('Failed to load departments')
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = departments.filter((d) => {
    if (search) {
      const q = search.toLowerCase()
      return (
        d.code.toLowerCase().includes(q) ||
        d.name.toLowerCase().includes(q) ||
        (d.faculty || '').toLowerCase().includes(q)
      )
    }
    return true
  })

  const openCreate = () => {
    setForm(emptyForm())
    setCreating(true)
    setEditing(null)
  }

  const openEdit = (d: Department) => {
    setForm({
      code: d.code,
      name: d.name,
      faculty: d.faculty || '',
      hodUserId: d.hodUserId || 'none',
      isActive: d.isActive,
    })
    setEditing(d)
    setCreating(false)
  }

  const closeDialog = () => {
    setEditing(null)
    setCreating(false)
    setForm(emptyForm())
  }

  const save = async () => {
    if (!form.code || !form.name) {
      toast.error('Code and name are required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        hodUserId: form.hodUserId === 'none' ? null : form.hodUserId,
      }
      if (editing) {
        const res = await fetch(`/api/departments/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) toast.error(data.error || 'Failed to update')
        else { toast.success('Department updated'); await load(); closeDialog() }
      } else {
        const res = await fetch('/api/departments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) toast.error(data.error || 'Failed to create')
        else { toast.success('Department created'); await load(); closeDialog() }
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
            <Building2 className="size-6" /> Departments
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {departments.length} departments across {new Set(departments.map((d) => d.faculty).filter(Boolean)).size} faculties
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!filtered.length}
            onClick={() => {
              const rows = filtered.map((d) => ({
                Code: d.code,
                Name: d.name,
                Faculty: d.faculty || '',
                HOD: d.hodUser?.fullName || '',
                Users: d._count?.users || 0,
                Staff: d._count?.staff || 0,
                Units: d._count?.units || 0,
                Status: d.isActive ? 'Active' : 'Inactive',
              }))
              exportToExcel('FUTH_Departments', [{ name: 'Departments', rows }])
              toast.success(`Exported ${rows.length} departments`)
            }}
          >
            <Download className="size-4" /> Export
          </Button>
          {canMutate && (
            <Button size="sm" onClick={openCreate}>
              <Plus className="size-4" /> New Department
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by code, name or faculty..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 max-w-md"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase text-muted-foreground border-b">
                    <th className="text-left px-4 py-3">Code</th>
                    <th className="text-left px-4 py-3">Name</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">Faculty</th>
                    <th className="text-left px-4 py-3 hidden lg:table-cell">HOD</th>
                    <th className="text-center px-4 py-3">Staff</th>
                    <th className="text-center px-4 py-3">Units</th>
                    <th className="text-center px-4 py-3">Status</th>
                    <th className="text-right px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">No departments found</td></tr>
                  ) : filtered.map((d) => (
                    <tr key={d.id} className="border-b last:border-0 hover:bg-muted/50 cursor-pointer" onClick={() => setDetail(d)}>
                      <td className="px-4 py-3 font-mono font-semibold text-primary">{d.code}</td>
                      <td className="px-4 py-3 font-medium">{d.name}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">{d.faculty || '—'}</td>
                      <td className="px-4 py-3 hidden lg:table-cell text-xs">{d.hodUser?.fullName || '—'}</td>
                      <td className="px-4 py-3 text-center font-mono">{d._count?.staff || 0}</td>
                      <td className="px-4 py-3 text-center font-mono">{d._count?.units || 0}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={d.isActive ? 'default' : 'secondary'} className="text-[10px]">
                          {d.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {canMutate && (
                          <Button size="icon" variant="ghost" className="size-7" onClick={() => openEdit(d)}>
                            <Pencil className="size-3.5" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing || creating} onOpenChange={(o) => { if (!o) closeDialog() }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Department' : 'New Department'}</DialogTitle>
            <DialogDescription>
              {editing ? `Editing ${editing.code} — ${editing.name}` : 'Create a new institutional department'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Code *</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="ICT"
                  disabled={!!editing}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Faculty</Label>
                <Input
                  value={form.faculty}
                  onChange={(e) => setForm({ ...form, faculty: e.target.value })}
                  placeholder="Administration"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Information & Communication Technology"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Head of Department</Label>
              <UserSearch
                value={form.hodUserId === 'none' ? '' : form.hodUserId}
                onChange={(v) => setForm({ ...form, hodUserId: v || 'none' })}
                placeholder="Search any user by name, IPPIS, or role to assign as HOD..."
                allowClear
              />
              <p className="text-[10px] text-muted-foreground">
                Tip: type a name, IPPIS number, or username. All 2,800+ staff are searchable.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Switch id="dept-active" checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
              <Label htmlFor="dept-active">Department is active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} {editing ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null) }}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 overflow-y-auto">
          {detail && (
            <>
              <SheetHeader className="bg-gradient-to-br from-[#14532d] to-[#15803d] text-white p-6">
                <SheetTitle className="text-white">{detail.name}</SheetTitle>
                <SheetDescription className="text-white/80">{detail.code} · {detail.faculty || 'No faculty'}</SheetDescription>
              </SheetHeader>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <StatCard icon={<Users className="size-4" />} label="Staff" value={detail._count?.staff || 0} />
                  <StatCard icon={<Network className="size-4" />} label="Units" value={detail._count?.units || 0} />
                  <StatCard icon={<Users className="size-4" />} label="Users" value={detail._count?.users || 0} />
                </div>
                <DetailRow label="Head of Department" value={detail.hodUser?.fullName || '—'} />
                <DetailRow label="Status" value={detail.isActive ? 'Active' : 'Inactive'} />
                <DetailRow label="Created" value={new Date(detail.createdAt).toLocaleDateString()} />
              </div>
              <SheetFooter className="px-6 pb-6">
                {canMutate && (
                  <Button variant="outline" onClick={() => { setDetail(null); openEdit(detail) }}>
                    <Pencil className="size-4" /> Edit
                  </Button>
                )}
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded border p-3 text-center">
      <div className="size-7 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-1">{icon}</div>
      <div className="text-lg font-bold">{value}</div>
      <div className="text-[10px] text-muted-foreground uppercase">{label}</div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1 border-b">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-medium text-sm text-right">{value || '—'}</span>
    </div>
  )
}
