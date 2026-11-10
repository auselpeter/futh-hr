'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { BriefcaseBusiness, Plus, Search, Pencil, Check } from 'lucide-react'
import { toast } from 'sonner'

const LEVELS = ['executive', 'directorate', 'management', 'officer', 'staff']

export default function Designations() {
  const [designations, setDesignations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [editing, setEditing] = useState<any | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/designations', { cache: 'no-store' })
      const data = await res.json()
      setDesignations(data.designations || [])
    } catch {
      toast.error('Failed to load designations')
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = designations.filter((d) => {
    if (levelFilter !== 'all' && d.level !== levelFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        d.code.toLowerCase().includes(q) ||
        d.name.toLowerCase().includes(q) ||
        (d.description || '').toLowerCase().includes(q)
      )
    }
    return true
  })

  const openCreate = () => {
    setForm({ code: '', name: '', description: '', rank: 100, level: 'staff', isActive: true })
    setCreating(true)
    setEditing(null)
  }

  const openEdit = (d: any) => {
    setForm({
      code: d.code, name: d.name, description: d.description || '',
      rank: d.rank, level: d.level, isActive: d.isActive,
    })
    setEditing(d)
    setCreating(false)
  }

  const closeDialog = () => {
    setEditing(null)
    setCreating(false)
    setForm({})
  }

  const save = async () => {
    if (!form.code || !form.name) {
      toast.error('Code and name are required')
      return
    }
    setSaving(true)
    try {
      if (editing) {
        const res = await fetch(`/api/designations/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        const data = await res.json()
        if (!res.ok) {
          toast.error(data.error || 'Failed to update')
        } else {
          toast.success('Designation updated')
          await load()
          closeDialog()
        }
      } else {
        const res = await fetch('/api/designations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        const data = await res.json()
        if (!res.ok) {
          toast.error(data.error || 'Failed to create')
        } else {
          toast.success('Designation created')
          await load()
          closeDialog()
        }
      }
    } catch (e: any) {
      toast.error('Network error')
    }
    setSaving(false)
  }

  const toggleActive = async (d: any) => {
    try {
      const res = await fetch(`/api/designations/${d.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !d.isActive }),
      })
      if (!res.ok) {
        toast.error('Failed to update status')
      } else {
        toast.success(`${d.name} ${d.isActive ? 'deactivated' : 'activated'}`)
        await load()
      }
    } catch {
      toast.error('Network error')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BriefcaseBusiness className="size-6" /> Designations
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Institutional roles and ranks — {designations.length} total
          </p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="size-4" /> New Designation
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search by code, name or description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                {LEVELS.map((l) => <SelectItem key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase text-muted-foreground border-b">
                    <th className="text-left px-4 py-3 font-medium">Code</th>
                    <th className="text-left px-4 py-3 font-medium">Name</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Description</th>
                    <th className="text-left px-4 py-3 font-medium">Level</th>
                    <th className="text-right px-4 py-3 font-medium">Rank</th>
                    <th className="text-right px-4 py-3 font-medium">Users</th>
                    <th className="text-right px-4 py-3 font-medium">Staff</th>
                    <th className="text-center px-4 py-3 font-medium">Status</th>
                    <th className="text-right px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={9} className="text-center py-10 text-muted-foreground">No designations found</td></tr>
                  ) : filtered.map((d) => (
                    <tr key={d.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <span className="font-mono font-semibold text-primary">{d.code}</span>
                      </td>
                      <td className="px-4 py-3 font-medium">{d.name}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-muted-foreground max-w-xs truncate">
                        {d.description || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs capitalize">{d.level}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{d.rank}</td>
                      <td className="px-4 py-3 text-right font-mono">{d._count?.users || 0}</td>
                      <td className="px-4 py-3 text-right font-mono">{d._count?.staff || 0}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={d.isActive ? 'default' : 'secondary'} className="text-[10px]">
                          {d.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" className="size-7" onClick={() => openEdit(d)}>
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleActive(d)}
                            className="h-7 text-xs"
                          >
                            {d.isActive ? 'Deactivate' : 'Activate'}
                          </Button>
                        </div>
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
            <DialogTitle>{editing ? 'Edit Designation' : 'New Designation'}</DialogTitle>
            <DialogDescription>
              {editing
                ? `Editing ${editing.code} — ${editing.name}`
                : 'Create a new institutional designation/role.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="code">Code *</Label>
                <Input
                  id="code"
                  value={form.code || ''}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. CMD"
                  disabled={!!editing}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rank">Rank (higher = more senior)</Label>
                <Input
                  id="rank"
                  type="number"
                  value={form.rank || 0}
                  onChange={(e) => setForm({ ...form, rank: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={form.name || ''}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Chief Medical Director"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="level">Level</Label>
              <Select
                value={form.level || 'staff'}
                onValueChange={(v) => setForm({ ...form, level: v })}
              >
                <SelectTrigger id="level"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEVELS.map((l) => <SelectItem key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description || ''}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Brief description of this role..."
                rows={3}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="isActive"
                checked={form.isActive}
                onCheckedChange={(v) => setForm({ ...form, isActive: v })}
              />
              <Label htmlFor="isActive">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? 'Saving...' : <><Check className="size-4 mr-1" /> Save</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
