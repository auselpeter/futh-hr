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
import {
  Network, Plus, Search, Pencil, Save, Loader2, Download, Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { exportToExcel } from '@/lib/export'
import UserSearch from './UserSearch'

type Unit = {
  id: string
  code: string
  name: string
  description: string | null
  departmentId: string
  houUserId: string | null
  isActive: boolean
  createdAt: string
  department?: { id: string; code: string; name: string }
  houUser?: { id: string; fullName: string; username: string } | null
  _count?: { staff: number }
}

type Props = { user: any }

const emptyForm = () => ({
  code: '',
  name: '',
  description: '',
  departmentId: '',
  houUserId: 'none',
  isActive: true,
})

export default function Units({ user }: Props) {
  const [units, setUnits] = useState<Unit[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('all')
  const [editing, setEditing] = useState<Unit | null>(null)
  const [creating, setCreating] = useState(false)
  const [detail, setDetail] = useState<Unit | null>(null)
  const [form, setForm] = useState<any>(emptyForm())
  const [saving, setSaving] = useState(false)

  const role = user?.activeRole || user?.role
  const canMutate = ['SUPER_ADMIN', 'ADMIN', 'CMD', 'CMA', 'AD', 'DFA', 'HOD', 'HOU'].includes(role)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [uRes, dRes] = await Promise.all([
        fetch('/api/units', { cache: 'no-store' }),
        fetch('/api/departments', { cache: 'no-store' }),
      ])
      const uData = await uRes.json()
      const dData = await dRes.json()
      setUnits(uData.units || [])
      setDepartments(dData.departments || [])
    } catch {
      toast.error('Failed to load units')
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = units.filter((u) => {
    if (deptFilter !== 'all' && u.departmentId !== deptFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        u.code.toLowerCase().includes(q) ||
        u.name.toLowerCase().includes(q) ||
        (u.description || '').toLowerCase().includes(q)
      )
    }
    return true
  })

  const openCreate = () => {
    setForm(emptyForm())
    setCreating(true)
    setEditing(null)
  }

  const openEdit = (u: Unit) => {
    setForm({
      code: u.code,
      name: u.name,
      description: u.description || '',
      departmentId: u.departmentId,
      houUserId: u.houUserId || 'none',
      isActive: u.isActive,
    })
    setEditing(u)
    setCreating(false)
  }

  const closeDialog = () => {
    setEditing(null)
    setCreating(false)
    setForm(emptyForm())
  }

  const save = async () => {
    if (!form.code || !form.name || !form.departmentId) {
      toast.error('Code, name and department are required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        houUserId: form.houUserId === 'none' ? null : form.houUserId,
      }
      if (editing) {
        const res = await fetch(`/api/units/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) toast.error(data.error || 'Failed to update')
        else { toast.success('Unit updated'); await load(); closeDialog() }
      } else {
        const res = await fetch('/api/units', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) toast.error(data.error || 'Failed to create')
        else { toast.success('Unit created'); await load(); closeDialog() }
      }
    } catch {
      toast.error('Network error')
    }
    setSaving(false)
  }

  const remove = async (u: Unit) => {
    if (!confirm(`Delete unit "${u.name}" (${u.code})?\n\nThis cannot be undone.`)) return
    try {
      const res = await fetch(`/api/units/${u.id}`, { method: 'DELETE' })
      const j = await res.json()
      if (!res.ok) toast.error(j.error || 'Failed to delete')
      else { toast.success(`Unit ${u.name} deleted`); load() }
    } catch {
      toast.error('Network error')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Network className="size-6" /> Units
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {units.length} units across {new Set(units.map((u) => u.departmentId)).size} departments
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!filtered.length}
            onClick={() => {
              const rows = filtered.map((u) => ({
                Code: u.code,
                Name: u.name,
                Department: u.department?.name || '',
                HOU: u.houUser?.fullName || '',
                Staff: u._count?.staff || 0,
                Status: u.isActive ? 'Active' : 'Inactive',
              }))
              exportToExcel('FUTH_Units', [{ name: 'Units', rows }])
              toast.success(`Exported ${rows.length} units`)
            }}
          >
            <Download className="size-4" /> Export
          </Button>
          {canMutate && (
            <Button size="sm" onClick={openCreate}>
              <Plus className="size-4" /> New Unit
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input placeholder="Search by code or name..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Department" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
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
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase text-muted-foreground border-b">
                    <th className="text-left px-4 py-3">Code</th>
                    <th className="text-left px-4 py-3">Name</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">Department</th>
                    <th className="text-left px-4 py-3 hidden lg:table-cell">HOU</th>
                    <th className="text-center px-4 py-3">Staff</th>
                    <th className="text-center px-4 py-3">Status</th>
                    <th className="text-right px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">No units found</td></tr>
                  ) : filtered.map((u) => (
                    <tr key={u.id} className="border-b last:border-0 hover:bg-muted/50 cursor-pointer" onClick={() => setDetail(u)}>
                      <td className="px-4 py-3 font-mono font-semibold text-primary">{u.code}</td>
                      <td className="px-4 py-3 font-medium">{u.name}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs">{u.department?.name || '—'}</td>
                      <td className="px-4 py-3 hidden lg:table-cell text-xs">{u.houUser?.fullName || '—'}</td>
                      <td className="px-4 py-3 text-center font-mono">{u._count?.staff || 0}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={u.isActive ? 'default' : 'secondary'} className="text-[10px]">
                          {u.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {canMutate && (
                          <>
                            <Button size="icon" variant="ghost" className="size-7" onClick={() => openEdit(u)}>
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="size-7 text-red-600" onClick={() => remove(u)}>
                              <Network className="size-3.5" />
                            </Button>
                          </>
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
            <DialogTitle>{editing ? 'Edit Unit' : 'New Unit'}</DialogTitle>
            <DialogDescription>
              {editing ? `Editing ${editing.code} — ${editing.name}` : 'Create a new unit under a department'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Code *</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="ICU"
                  disabled={!!editing}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Department *</Label>
                <Select
                  value={form.departmentId}
                  onValueChange={(v) => setForm({ ...form, departmentId: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Select department..." /></SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Intensive Care Unit"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                placeholder="Purpose of the unit..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Head of Unit</Label>
              <UserSearch
                value={form.houUserId === 'none' ? '' : form.houUserId}
                onChange={(v) => setForm({ ...form, houUserId: v || 'none' })}
                placeholder="Search any user by name, IPPIS, or role to assign as HOU..."
                allowClear
              />
              <p className="text-[10px] text-muted-foreground">
                Tip: type a name, IPPIS number, or username. All 2,800+ staff are searchable.
              </p>
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
                <SheetDescription className="text-white/80">{detail.code} · {detail.department?.name || '—'}</SheetDescription>
              </SheetHeader>
              <div className="p-6 space-y-4">
                <StatCard icon={<Users className="size-4" />} label="Staff in unit" value={detail._count?.staff || 0} />
                <DetailRow label="Head of Unit" value={detail.houUser?.fullName || '—'} />
                <DetailRow label="Description" value={detail.description || '—'} />
                <DetailRow label="Status" value={detail.isActive ? 'Active' : 'Inactive'} />
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
    <div className="rounded border p-4 text-center">
      <div className="size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-2">{icon}</div>
      <div className="text-xl font-bold">{value}</div>
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
