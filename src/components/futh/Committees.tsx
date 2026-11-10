'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Card, CardContent,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Users2, Plus, Pencil, Trash2, FileText, Search, Save,
  Calendar, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { initials, formatDate } from '@/lib/formatters'
import StaffSearch from './StaffSearch'
import UserSearch from './UserSearch'

type Member = {
  id: string; staffId: string; role: string;
  staff: { id: string; staffId: string; fullName: string; position: string | null; avatarUrl: string | null; department?: { code: string; name: string } | null; designation?: { code: string; name: string } | null };
  addedBy?: { id: string; fullName: string } | null; createdAt: string
}

type Committee = {
  id: string; code: string; name: string; description: string | null;
  chairpersonId: string | null; secretaryId: string | null; members: string | null;
  termOfReference: string | null; startDate: string | null; endDate: string | null; budget: number | null;
  isActive: boolean; createdAt: string;
  chairperson?: { id: string; fullName: string; role: string } | null;
  secretary?: { id: string; fullName: string; role: string } | null;
  members2?: Member[]; _count?: { files: number; members2?: number }
}

const MEMBER_ROLES = [
  { value: 'member', label: 'Member' }, { value: 'co_chair', label: 'Co-Chair' },
  { value: 'co_secretary', label: 'Co-Secretary' }, { value: 'ex_officio', label: 'Ex-Officio' },
  { value: 'treasurer', label: 'Treasurer' }, { value: 'advisor', label: 'Advisor' },
]

type Props = { user: any; onViewCommitteeFiles?: (committeeId: string) => void }

export default function Committees({ user, onViewCommitteeFiles }: Props) {
  const [committees, setCommittees] = useState<Committee[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Committee | null>(null)
  const [creating, setCreating] = useState(false)
  const [staff, setStaff] = useState<any[]>([])

  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cRes, sRes] = await Promise.all([
        fetch('/api/committees', { cache: 'no-store' }),
        fetch('/api/staff?limit=500', { cache: 'no-store' }),
      ])
      const cData = await cRes.json()
      const sData = await sRes.json()
      setCommittees(cData.committees || [])
      setStaff(sData.staff || [])
    } catch { toast.error('Failed to load committees') }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async (data: any, id?: string) => {
    try {
      const url = id ? `/api/committees/${id}` : '/api/committees'
      const method = id ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      const json = await res.json()
      if (!res.ok) return toast.error(json.error || 'Failed to save committee')
      toast.success(`Committee ${id ? 'updated' : 'created'}: ${data.name}`)
      setEditing(null); setCreating(false); load()
    } catch { toast.error('Network error') }
  }

  const handleDelete = async (c: Committee) => {
    if (!confirm(`Delete committee "${c.name}" (${c.code})?`)) return
    try {
      const res = await fetch(`/api/committees/${c.id}`, { method: 'DELETE' })
      const j = await res.json()
      if (!res.ok) return toast.error(j.error || 'Failed to delete')
      toast.success(`Committee ${c.name} deleted`); load()
    } catch { toast.error('Network error') }
  }

  const filtered = committees.filter((c) => {
    if (!search) return true
    const q = search.toLowerCase()
    return c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q)
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Users2 className="size-5" /></div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Committees</h1>
          <p className="text-sm text-muted-foreground">Institutional committees · {committees.length} configured</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3 justify-between">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input placeholder="Search committees by code, name, description..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          {isAdmin && <Button size="sm" onClick={() => setCreating(true)}><Plus className="size-4" /> Add Committee</Button>}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name &amp; Term</TableHead>
                <TableHead className="hidden md:table-cell">Chair / Secretary</TableHead>
                <TableHead className="text-center">Members</TableHead>
                <TableHead className="hidden lg:table-cell">Budget</TableHead>
                <TableHead className="text-center">Files</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Loading...</TableCell></TableRow>
              : filtered.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">No committees found</TableCell></TableRow>
              : filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell><Badge variant="outline" className="font-mono text-[11px]">{c.code}</Badge></TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">{c.name}</div>
                    {(c.startDate || c.endDate) && <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5"><Calendar className="size-3" />{c.startDate ? formatDate(c.startDate) : '—'} → {c.endDate ? formatDate(c.endDate) : '—'}</div>}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex flex-col gap-1">
                      {c.chairperson ? <div className="flex items-center gap-1.5"><Avatar className="size-5"><AvatarFallback className="bg-amber-100 text-amber-700 text-[9px]">{initials(c.chairperson.fullName)}</AvatarFallback></Avatar><span className="text-xs">{c.chairperson.fullName}</span></div> : <span className="text-xs text-muted-foreground">No chair</span>}
                      {c.secretary ? <div className="flex items-center gap-1.5"><Avatar className="size-5"><AvatarFallback className="bg-sky-100 text-sky-700 text-[9px]">{initials(c.secretary.fullName)}</AvatarFallback></Avatar><span className="text-xs">{c.secretary.fullName}</span></div> : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-semibold"><Badge variant="outline" className="text-xs">{c._count?.members2 ?? c.members2?.length ?? 0}</Badge></TableCell>
                  <TableCell className="hidden lg:table-cell text-xs">{c.budget != null ? `₦${c.budget.toLocaleString()}` : '—'}</TableCell>
                  <TableCell className="text-center font-semibold"><Badge variant="outline" className="text-xs">{c._count?.files || 0}</Badge></TableCell>
                  <TableCell>{c.isActive ? <Badge variant="outline" className="text-green-700 border-green-200 bg-green-50">Active</Badge> : <Badge variant="outline" className="text-red-700 border-red-200 bg-red-50">Inactive</Badge>}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => onViewCommitteeFiles?.(c.id)} title="View files"><FileText className="size-4" /></Button>
                      {isAdmin && (<><Button size="sm" variant="ghost" onClick={() => setEditing(c)} title="Edit"><Pencil className="size-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(c)} title="Delete" className="text-red-600 hover:text-red-700 hover:bg-red-50"><Trash2 className="size-4" /></Button></>)}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {(creating || editing) && <CommitteeEditDialog committee={editing} staff={staff} onClose={() => { setCreating(false); setEditing(null) }} onSave={handleSave} />}
    </div>
  )
}

function CommitteeEditDialog({ committee, staff, onClose, onSave }: any) {
  const initialMembers: { staffId: string; role: string }[] = (committee?.members2 || []).map((m: Member) => ({ staffId: m.staff.id, role: m.role }))
  const [form, setForm] = useState<any>({
    code: committee?.code || '', name: committee?.name || '', description: committee?.description || '',
    chairpersonId: committee?.chairpersonId || '', secretaryId: committee?.secretaryId || '',
    termOfReference: committee?.termOfReference || '',
    startDate: committee?.startDate ? committee.startDate.slice(0, 10) : '',
    endDate: committee?.endDate ? committee.endDate.slice(0, 10) : '',
    budget: committee?.budget != null ? String(committee.budget) : '', isActive: committee?.isActive ?? true,
  })
  const [members, setMembers] = useState<{ staffId: string; role: string }[]>(initialMembers)
  const [pickerStaffId, setPickerStaffId] = useState('')
  const [pickerRole, setPickerRole] = useState('member')

  const addMember = () => {
    if (!pickerStaffId) { toast.error('Search and select a staff member first'); return }
    if (members.some((m) => m.staffId === pickerStaffId)) { toast.error('That staff member is already in the list'); return }
    setMembers([...members, { staffId: pickerStaffId, role: pickerRole }])
    setPickerStaffId(''); setPickerRole('member')
  }
  const removeMember = (staffId: string) => setMembers(members.filter((m) => m.staffId !== staffId))
  const updateMemberRole = (staffId: string, role: string) => setMembers(members.map((m) => m.staffId === staffId ? { ...m, role } : m))

  const submit = () => {
    if (!form.code || !form.name) return toast.error('Code and name are required')
    onSave({ ...form, chairpersonId: form.chairpersonId || null, secretaryId: form.secretaryId || null, startDate: form.startDate || null, endDate: form.endDate || null, budget: form.budget === '' ? null : form.budget, members2: members }, committee?.id)
  }
  const memberDetails = (staffId: string) => staff.find((s: any) => s.id === staffId)

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{committee ? `Edit Committee: ${committee.name}` : 'Create Committee'}</DialogTitle>
          <DialogDescription>Institutional committee configuration — chairperson, secretary, members, term of reference, dates, budget</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Code *</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s+/g, '_') })} placeholder="TENDERS" disabled={!!committee} /></div>
            <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Tenders Board" /></div>
          </div>
          <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Purpose/scope of the committee..." /></div>
          <div><Label>Terms of Reference (ToR)</Label><Textarea value={form.termOfReference} onChange={(e) => setForm({ ...form, termOfReference: e.target.value })} rows={5} placeholder="Full Terms of Reference — duties, scope, deliverables, reporting lines..." /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Term Start Date</Label><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
            <div><Label>Term End Date</Label><Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
            <div><Label>Budget (₦)</Label><Input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} placeholder="0" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Chairperson</Label><UserSearch value={form.chairpersonId || ''} onChange={(v) => setForm({ ...form, chairpersonId: v })} placeholder="Search any user by name, IPPIS, or role..." allowClear /></div>
            <div><Label>Secretary</Label><UserSearch value={form.secretaryId || ''} onChange={(v) => setForm({ ...form, secretaryId: v })} placeholder="Search any user by name, IPPIS, or role..." allowClear /></div>
          </div>
          <div className="space-y-2">
            <Label>Committee Members ({members.length})</Label>
            <p className="text-[11px] text-muted-foreground">Search staff by name/IPPIS and add them as members with a role on the committee.</p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[220px]"><StaffSearch staff={staff} value={pickerStaffId} onChange={setPickerStaffId} placeholder="Search staff to add as member..." /></div>
              <Select value={pickerRole} onValueChange={setPickerRole}><SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger><SelectContent>{MEMBER_ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent></Select>
              <Button type="button" size="sm" onClick={addMember}><Plus className="size-4" /> Add</Button>
            </div>
            {members.length === 0 ? <div className="text-xs text-muted-foreground bg-muted/20 border border-dashed rounded-md p-3 text-center">No members added yet. Use the search above to find staff and click Add.</div>
            : <div className="space-y-1.5 max-h-[180px] overflow-y-auto border rounded-md p-2">
                {members.map((m) => {
                  const s = memberDetails(m.staffId)
                  if (!s) return <div key={m.staffId} className="flex items-center gap-2 text-xs p-1.5 bg-red-50 border border-red-200 rounded"><span className="text-red-700">Staff record not found (ID: {m.staffId})</span><Button type="button" size="sm" variant="ghost" className="ml-auto h-6" onClick={() => removeMember(m.staffId)}><X className="size-3" /></Button></div>
                  return (
                    <div key={m.staffId} className="flex items-center gap-2 text-xs p-1.5 bg-muted/30 border rounded">
                      <Avatar className="size-6"><AvatarFallback className="text-[9px]">{initials(s.fullName)}</AvatarFallback></Avatar>
                      <div className="flex-1 min-w-0"><div className="font-medium truncate">{s.fullName}</div><div className="text-[10px] text-muted-foreground">{s.staffId || s.ippisNumber || '—'}{s.designation ? ` · ${s.designation.code}` : ''}{s.department ? ` · ${s.department.code}` : ''}</div></div>
                      <Select value={m.role} onValueChange={(v) => updateMemberRole(m.staffId, v)}><SelectTrigger className="h-7 w-[130px] text-[11px]"><SelectValue /></SelectTrigger><SelectContent>{MEMBER_ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent></Select>
                      <Button type="button" size="sm" variant="ghost" className="h-7 text-red-600" onClick={() => removeMember(m.staffId)}><X className="size-3" /></Button>
                    </div>
                  )
                })}
              </div>}
          </div>
          <div className="flex items-center gap-2"><Switch id="c-active" checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} /><Label htmlFor="c-active">Committee is active</Label></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit}><Save className="size-4" /> {committee ? 'Save' : 'Create'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
