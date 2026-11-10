'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Users as UsersIcon, Shield, FileText, Plus, Pencil, Trash2, Lock, Unlock,
  Search, Save, X, AlertTriangle, Crown, UserCog, Building2, Briefcase, ScrollText, Trash,
  KeyRound, CheckCircle2, Mail, Phone, Clock, RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import StaffSearch from './StaffSearch'

type User = {
  id: string
  username: string
  email: string
  fullName: string
  role: string
  phone: string | null
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
  designation?: { id: string; code: string; name: string } | null
  department?: { id: string; code: string; name: string } | null
  staff?: { id: string; staffId: string; fullName: string; ippisNumber?: string | null } | null
  unit?: { id: string; code: string; name: string } | null
}

type Role = {
  id: string
  code: string
  name: string
  description: string | null
  rank: number
  level: string
  isSystem: boolean
  isActive: boolean
  rolePermissions?: any[]
}

type Page = {
  id: string
  key: string
  name: string
  description: string | null
  icon: string | null
  category: string
  sortOrder: number
  isActive: boolean
}

type Permission = {
  id?: string
  roleId: string
  pageId: string
  canView: boolean
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
}

export default function UserManagement({ user: currentUser }: { user: any }) {
  const [tab, setTab] = useState<'users' | 'roles' | 'pages' | 'permissions' | 'audit'>('users')

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <UserCog className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage users, roles, pages, page-permissions and audit logs across FUTH LAFIA HR
          </p>
        </div>
      </div>

      {(currentUser?.role !== 'SUPER_ADMIN' && currentUser?.role !== 'ADMIN') && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="size-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900">
              You need <strong>Administrator</strong> or <strong>Super Administrator</strong> role to modify users, roles, or permissions.
              You can view the configuration below but changes are disabled.
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="grid grid-cols-6 w-full max-w-3xl">
          <TabsTrigger value="users" className="gap-1.5"><UsersIcon className="size-3.5" /> Users</TabsTrigger>
          <TabsTrigger value="roles" className="gap-1.5"><Shield className="size-3.5" /> Roles</TabsTrigger>
          <TabsTrigger value="pages" className="gap-1.5"><FileText className="size-3.5" /> Pages</TabsTrigger>
          <TabsTrigger value="permissions" className="gap-1.5"><Lock className="size-3.5" /> Permissions</TabsTrigger>
          <TabsTrigger value="resets" className="gap-1.5"><KeyRound className="size-3.5" /> Resets</TabsTrigger>
        <TabsTrigger value="audit" className="gap-1.5"><ScrollText className="size-3.5" /> Activity Log</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <UsersTab currentUser={currentUser} canEdit={['SUPER_ADMIN', 'ADMIN'].includes(currentUser?.role)} />
        </TabsContent>
        <TabsContent value="roles" className="mt-4">
          <RolesTab canEdit={['SUPER_ADMIN', 'ADMIN'].includes(currentUser?.role)} />
        </TabsContent>
        <TabsContent value="pages" className="mt-4">
          <PagesTab canEdit={['SUPER_ADMIN', 'ADMIN'].includes(currentUser?.role)} />
        </TabsContent>
        <TabsContent value="permissions" className="mt-4">
          <PermissionsTab canEdit={['SUPER_ADMIN', 'ADMIN'].includes(currentUser?.role)} />
        </TabsContent>
        <TabsContent value="resets" className="mt-4">
          <ResetRequestsTab currentUser={currentUser} canEdit={['SUPER_ADMIN', 'ADMIN'].includes(currentUser?.role)} />
        </TabsContent>
        <TabsContent value="audit" className="mt-4">
          <AuditLogTab currentUser={currentUser} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ============================================================
// USERS TAB
// ============================================================
function UsersTab({ currentUser, canEdit }: { currentUser: any; canEdit: boolean }) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [creating, setCreating] = useState(false)
  const [roles, setRoles] = useState<Role[]>([])
  const [designations, setDesignations] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [units, setUnits] = useState<any[]>([])
  const [staffList, setStaffList] = useState<any[]>([])
  const [rolePermSummary, setRolePermSummary] = useState<Record<string, { pages: number; v: number; c: number; e: number; d: number }>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [uRes, rRes, dRes, depRes, unitsRes, sRes, permRes] = await Promise.all([
        fetch(`/api/users?withInactive=${showInactive}&q=${encodeURIComponent(search)}`, { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/roles', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/designations', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/departments', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/units', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/staff', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/role-permissions', { cache: 'no-store' }).then((r) => r.json()),
      ])
      setUsers(uRes.users || [])
      setRoles(rRes.roles || [])
      setDesignations(dRes.designations || [])
      setDepartments(depRes.departments || [])
      setUnits(unitsRes.units || [])
      setStaffList(sRes.staff || [])
      // Aggregate role-permissions by role code
      const perms = permRes.permissions || []
      const roleMap: Record<string, { pages: number; v: number; c: number; e: number; d: number }> = {}
      // Build role code → id map
      const roleById: Record<string, string> = {}
      for (const r of (rRes.roles || [])) roleById[r.id] = r.code
      for (const p of perms) {
        const roleCode = roleById[p.roleId]
        if (!roleCode) continue
        if (!roleMap[roleCode]) roleMap[roleCode] = { pages: 0, v: 0, c: 0, e: 0, d: 0 }
        if (p.canView) {
          roleMap[roleCode].pages += 1
          roleMap[roleCode].v += 1
        }
        if (p.canCreate) roleMap[roleCode].c += 1
        if (p.canEdit) roleMap[roleCode].e += 1
        if (p.canDelete) roleMap[roleCode].d += 1
      }
      // SUPER_ADMIN always sees everything — patch the summary
      const totalPages = (rRes.roles?.find((r: Role) => r.code === 'SUPER_ADMIN') ? perms.filter((p: any) => p.roleId === rRes.roles.find((r: Role) => r.code === 'SUPER_ADMIN').id).length : 0) || 13
      roleMap['SUPER_ADMIN'] = { pages: totalPages, v: totalPages, c: totalPages, e: totalPages, d: totalPages }
      setRolePermSummary(roleMap)
    } catch {}
    setLoading(false)
  }, [search, showInactive])

  useEffect(() => { load() }, [load])

  const handleSave = async (data: any) => {
    try {
      if (editing) {
        const res = await fetch(`/api/users/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        const json = await res.json()
        if (!res.ok) return toast.error(json.error || 'Failed to update user')
        toast.success(`User ${data.fullName} updated`)
        setEditing(null)
        load()
      } else {
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        const json = await res.json()
        if (!res.ok) return toast.error(json.error || 'Failed to create user')
        toast.success(`User ${data.fullName} created`)
        setCreating(false)
        load()
      }
    } catch (e: any) {
      toast.error('Network error')
    }
  }

  const handleDelete = async (u: User) => {
    if (!confirm(`Deactivate user "${u.fullName}" (${u.username})?\n\nThis will prevent them from logging in. Their data will be preserved.`)) return
    try {
      const res = await fetch(`/api/users/${u.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const j = await res.json()
        return toast.error(j.error || 'Failed to delete')
      }
      toast.success(`${u.fullName} deactivated`)
      load()
    } catch {
      toast.error('Network error')
    }
  }

  const roleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      SUPER_ADMIN: 'bg-violet-100 text-violet-800 border-violet-200',
      ADMIN: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      CMD: 'bg-amber-100 text-amber-800 border-amber-200',
      CMA: 'bg-orange-100 text-orange-800 border-orange-200',
      AD: 'bg-cyan-100 text-cyan-800 border-cyan-200',
      DFA: 'bg-teal-100 text-teal-800 border-teal-200',
      HOD: 'bg-green-100 text-green-800 border-green-200',
      HOU: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      APPRAISAL_OFFICER: 'bg-pink-100 text-pink-800 border-pink-200',
      REGISTRY_OFFICER: 'bg-sky-100 text-sky-800 border-sky-200',
      STAFF: 'bg-slate-100 text-slate-800 border-slate-200',
    }
    return colors[role] || 'bg-gray-100 text-gray-800 border-gray-200'
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, username, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowInactive((v) => !v)}>
          {showInactive ? 'Hide inactive' : 'Show inactive'}
        </Button>
        {canEdit && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Add User
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="hidden lg:table-cell">Permissions</TableHead>
                <TableHead className="hidden md:table-cell">Designation</TableHead>
                <TableHead className="hidden lg:table-cell">Department</TableHead>
                <TableHead className="hidden md:table-cell">Status</TableHead>
                <TableHead className="hidden lg:table-cell">Last Login</TableHead>
                {canEdit && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : users.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">No users found</TableCell></TableRow>
              ) : users.map((u) => {
                const summary = rolePermSummary[u.role]
                return (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar className="size-9">
                        <AvatarFallback className="bg-primary/15 text-primary text-xs">
                          {u.fullName.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-sm flex items-center gap-1.5">
                          {u.fullName}
                          {u.id === currentUser?.id && <Badge variant="outline" className="text-[10px] px-1 py-0">You</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground">@{u.username} · {u.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[11px] ${roleBadgeColor(u.role)}`}>
                      {u.role.replace(/_/g, ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {summary ? (
                      <div className="flex flex-wrap gap-1 items-center">
                        <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                          {summary.pages} pages
                        </Badge>
                        <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
                          V:{summary.v}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                          C:{summary.c}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] bg-violet-50 text-violet-700 border-violet-200">
                          E:{summary.e}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">
                          D:{summary.d}
                        </Badge>
                      </div>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-xs">{u.designation?.code || '—'}</TableCell>
                  <TableCell className="hidden lg:table-cell text-xs">{u.department?.code || '—'}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {u.isActive ? (
                      <Badge variant="outline" className="text-green-700 border-green-200 bg-green-50">Active</Badge>
                    ) : (
                      <Badge variant="outline" className="text-red-700 border-red-200 bg-red-50">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}
                  </TableCell>
                  {canEdit && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(u)} title="Edit">
                          <Pencil className="size-4" />
                        </Button>
                        {u.id !== currentUser?.id && (
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(u)} title="Deactivate" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {(creating || editing) && (
        <UserEditDialog
          user={editing}
          roles={roles}
          designations={designations}
          departments={departments}
          units={units}
          staffList={staffList}
          onClose={() => { setCreating(false); setEditing(null) }}
          onSave={handleSave}
        />
      )}
    </div>
  )
}

function UserEditDialog({
  user, roles, designations, departments, units, staffList, onClose, onSave,
}: any) {
  const [form, setForm] = useState<any>({
    username: user?.username || '',
    email: user?.email || '',
    fullName: user?.fullName || '',
    password: '',
    role: user?.role || 'STAFF',
    phone: user?.phone || '',
    designationId: user?.designationId || '',
    departmentId: user?.departmentId || '',
    unitId: user?.unitId || '',
    ippisNumber: user?.staff?.ippisNumber || '',
    autoUsername: !user,
    staffId: user?.staffId || '',
    isActive: user?.isActive ?? true,
  })

  const submit = () => {
    if (!form.username || !form.email || !form.fullName) {
      toast.error('Username, email, and full name are required')
      return
    }
    if (!user && !form.password) {
      toast.error('Password is required for new users')
      return
    }
    const data = { ...form }
    if (!data.password) delete data.password
    if (!data.designationId) data.designationId = null
    if (!data.departmentId) data.departmentId = null
    if (!data.unitId) data.unitId = null
    if (!data.staffId) data.staffId = null
    if (user) { delete data.autoUsername; delete data.ippisNumber }
    onSave(data)
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{user ? 'Edit User' : 'Create User'}</DialogTitle>
          <DialogDescription>{user ? `Update ${user.fullName}'s account` : 'Add a new user account to FUTH HR'}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-2">
          <div>
            <Label>Full Name *</Label>
            <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Dr. John Doe" />
          </div>
          <div>
            <Label>Username *</Label>
            <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="johndoe" />
          </div>
          <div>
            <Label>Email *</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="john@futhlafia.gov.ng" />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+234 80..." />
          </div>
          <div>
            <Label>Password {user ? '(leave blank to keep)' : '(blank = admin123)'}</Label>
            <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={user ? '••••••••' : 'defaults to admin123'} />
            {!user && <p className="text-[10px] text-muted-foreground mt-1">If left blank, the default password <code className="bg-muted px-1 rounded">admin123</code> is used.</p>}
          </div>
          {!user && (
            <div className="col-span-2">
                <Label>IPPIS Number (becomes username if Auto-Username is on)</Label>
                <Input value={form.ippisNumber || ''} onChange={(e) => setForm({ ...form, ippisNumber: e.target.value })} placeholder="e.g. 12345678 — IPPIS Number; becomes the username" />
              </div>
          )}
          <div>
            <Label>Role *</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
              <SelectTrigger><SelectValue placeholder="Select role..." /></SelectTrigger>
              <SelectContent>
                {roles.filter((r: Role) => r.isActive).map((r: Role) => (
                  <SelectItem key={r.id} value={r.code}>
                    {r.code} — {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Designation</Label>
            <Select value={form.designationId || 'none'} onValueChange={(v) => setForm({ ...form, designationId: v === 'none' ? '' : v })}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {designations.map((d: any) => (
                  <SelectItem key={d.id} value={d.id}>{d.code} — {d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Department</Label>
            <Select value={form.departmentId || 'none'} onValueChange={(v) => setForm({ ...form, departmentId: v === 'none' ? '' : v, unitId: '' })}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {departments.map((d: any) => (
                  <SelectItem key={d.id} value={d.id}>{d.code} — {d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Unit</Label>
            <Select value={form.unitId || 'none'} onValueChange={(v) => setForm({ ...form, unitId: v === 'none' ? '' : v })}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {units.filter((u: any) => !form.departmentId || u.departmentId === form.departmentId).map((u: any) => (
                  <SelectItem key={u.id} value={u.id}>{u.code} — {u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Linked Staff Record</Label>
            <StaffSearch
              staff={staffList}
              value={form.staffId || ''}
              onChange={(v) => setForm({ ...form, staffId: v })}
              placeholder="Search staff to link to this user (optional)..."
            />
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <Switch id="active" checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
            <Label htmlFor="active">Account is active (user can log in)</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>
            <Save className="size-4" /> {user ? 'Save Changes' : 'Create User'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// ROLES TAB
// ============================================================
function RolesTab({ canEdit }: { canEdit: boolean }) {
  const [roles, setRoles] = useState<Role[]>([])
  const [userCounts, setUserCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Role | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/roles', { cache: 'no-store' })
      const json = await res.json()
      setRoles(json.roles || [])
      setUserCounts(json.userCounts || {})
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async (data: any, id?: string) => {
    try {
      const url = id ? `/api/roles/${id}` : '/api/roles'
      const method = id ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) return toast.error(json.error || 'Failed to save role')
      toast.success(`Role ${id ? 'updated' : 'created'}: ${data.name}`)
      setEditing(null); setCreating(false)
      load()
    } catch {
      toast.error('Network error')
    }
  }

  const handleDelete = async (r: Role) => {
    if (r.isSystem) return toast.error('System roles cannot be deleted')
    if (!confirm(`Delete role "${r.name}" (${r.code})?\n\nThis cannot be undone.`)) return
    try {
      const res = await fetch(`/api/roles/${r.id}`, { method: 'DELETE' })
      const j = await res.json()
      if (!res.ok) return toast.error(j.error || 'Failed to delete')
      toast.success(`Role ${r.name} deleted`)
      load()
    } catch {
      toast.error('Network error')
    }
  }

  const levelColor = (level: string) => {
    const colors: Record<string, string> = {
      executive: 'bg-amber-100 text-amber-800 border-amber-200',
      directorate: 'bg-cyan-100 text-cyan-800 border-cyan-200',
      management: 'bg-green-100 text-green-800 border-green-200',
      officer: 'bg-sky-100 text-sky-800 border-sky-200',
      staff: 'bg-slate-100 text-slate-800 border-slate-200',
    }
    return colors[level] || 'bg-gray-100 text-gray-800 border-gray-200'
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        {canEdit && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Add Role
          </Button>
        )}
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead className="hidden md:table-cell">Level</TableHead>
                <TableHead className="hidden md:table-cell">Rank</TableHead>
                <TableHead className="hidden lg:table-cell">Description</TableHead>
                <TableHead className="text-center">Users</TableHead>
                <TableHead>Status</TableHead>
                {canEdit && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : roles.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {r.isSystem ? <Lock className="size-3.5 text-muted-foreground" /> : <Unlock className="size-3.5 text-muted-foreground" />}
                      <div>
                        <div className="font-medium text-sm flex items-center gap-1.5">
                          {r.name}
                          {r.isSystem && <Badge variant="outline" className="text-[10px] px-1 py-0">System</Badge>}
                        </div>
                        <div className="text-xs font-mono text-muted-foreground">{r.code}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant="outline" className={`text-[11px] ${levelColor(r.level)}`}>{r.level}</Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell font-mono text-xs">{r.rank}</TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-muted-foreground max-w-[280px] truncate">{r.description}</TableCell>
                  <TableCell className="text-center font-semibold">{userCounts[r.code] || 0}</TableCell>
                  <TableCell>
                    {r.isActive ? (
                      <Badge variant="outline" className="text-green-700 border-green-200 bg-green-50">Active</Badge>
                    ) : (
                      <Badge variant="outline" className="text-red-700 border-red-200 bg-red-50">Inactive</Badge>
                    )}
                  </TableCell>
                  {canEdit && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(r)} title="Edit">
                          <Pencil className="size-4" />
                        </Button>
                        {!r.isSystem && (
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(r)} title="Delete" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {(creating || editing) && (
        <RoleEditDialog role={editing} onClose={() => { setCreating(false); setEditing(null) }} onSave={handleSave} />
      )}
    </div>
  )
}

function RoleEditDialog({ role, onClose, onSave }: any) {
  const [form, setForm] = useState<any>({
    code: role?.code || '',
    name: role?.name || '',
    description: role?.description || '',
    rank: role?.rank || 100,
    level: role?.level || 'staff',
    isActive: role?.isActive ?? true,
  })

  const submit = () => {
    if (!form.code || !form.name) return toast.error('Code and name are required')
    if (role?.isSystem) {
      // For system roles, code is immutable
      onSave({ ...form, code: role.code }, role.id)
    } else {
      onSave(form, role?.id)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{role ? `Edit Role: ${role.name}` : 'Create Role'}</DialogTitle>
          <DialogDescription>{role?.isSystem ? 'System role — code is immutable' : 'Define a new role for the institution'}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Code *</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                placeholder="CUSTOM_ROLE"
                disabled={role?.isSystem}
              />
            </div>
            <div>
              <Label>Display Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Custom Role" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Level</Label>
              <Select value={form.level} onValueChange={(v) => setForm({ ...form, level: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="executive">Executive</SelectItem>
                  <SelectItem value="directorate">Directorate</SelectItem>
                  <SelectItem value="management">Management</SelectItem>
                  <SelectItem value="officer">Officer</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Rank (higher = more senior)</Label>
              <Input type="number" value={form.rank} onChange={(e) => setForm({ ...form, rank: parseInt(e.target.value) || 100 })} />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Role description..." />
          </div>
          <div className="flex items-center gap-2">
            <Switch id="r-active" checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
            <Label htmlFor="r-active">Role is active</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}><Save className="size-4" /> {role ? 'Save' : 'Create'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// PAGES TAB
// ============================================================
function PagesTab({ canEdit }: { canEdit: boolean }) {
  const [pages, setPages] = useState<Page[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Page | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/pages', { cache: 'no-store' })
      const json = await res.json()
      setPages(json.pages || [])
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async (data: any, id?: string) => {
    try {
      const url = id ? `/api/pages/${id}` : '/api/pages'
      const method = id ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) return toast.error(json.error || 'Failed to save page')
      toast.success(`Page ${id ? 'updated' : 'created'}: ${data.name}`)
      setEditing(null); setCreating(false)
      load()
    } catch {
      toast.error('Network error')
    }
  }

  const handleDelete = async (p: Page) => {
    if (!confirm(`Delete page "${p.name}" (${p.key})?\n\nAll permissions for this page will also be deleted.`)) return
    try {
      const res = await fetch(`/api/pages/${p.id}`, { method: 'DELETE' })
      if (!res.ok) return toast.error('Failed to delete page')
      toast.success(`Page ${p.name} deleted`)
      load()
    } catch {
      toast.error('Network error')
    }
  }

  const categoryColor = (cat: string) => {
    const colors: Record<string, string> = {
      Main: 'bg-blue-100 text-blue-800 border-blue-200',
      Admin: 'bg-violet-100 text-violet-800 border-violet-200',
      Executive: 'bg-amber-100 text-amber-800 border-amber-200',
      HR: 'bg-green-100 text-green-800 border-green-200',
    }
    return colors[cat] || 'bg-gray-100 text-gray-800 border-gray-200'
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        {canEdit && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Add Page
          </Button>
        )}
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Page</TableHead>
                <TableHead className="hidden md:table-cell">Key</TableHead>
                <TableHead className="hidden md:table-cell">Category</TableHead>
                <TableHead className="hidden lg:table-cell">Description</TableHead>
                <TableHead className="text-center hidden md:table-cell">Order</TableHead>
                <TableHead>Status</TableHead>
                {canEdit && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : pages.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-medium text-sm">{p.name}</div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell font-mono text-xs">{p.key}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant="outline" className={`text-[11px] ${categoryColor(p.category)}`}>{p.category}</Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-muted-foreground max-w-[300px] truncate">{p.description}</TableCell>
                  <TableCell className="text-center hidden md:table-cell font-mono text-xs">{p.sortOrder}</TableCell>
                  <TableCell>
                    {p.isActive ? (
                      <Badge variant="outline" className="text-green-700 border-green-200 bg-green-50">Active</Badge>
                    ) : (
                      <Badge variant="outline" className="text-red-700 border-red-200 bg-red-50">Inactive</Badge>
                    )}
                  </TableCell>
                  {canEdit && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(p)} title="Edit">
                          <Pencil className="size-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(p)} title="Delete" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {(creating || editing) && (
        <PageEditDialog page={editing} onClose={() => { setCreating(false); setEditing(null) }} onSave={handleSave} />
      )}
    </div>
  )
}

function PageEditDialog({ page, onClose, onSave }: any) {
  const [form, setForm] = useState<any>({
    key: page?.key || '',
    name: page?.name || '',
    description: page?.description || '',
    icon: page?.icon || '',
    category: page?.category || 'Main',
    sortOrder: page?.sortOrder || 100,
    isActive: page?.isActive ?? true,
  })

  const submit = () => {
    if (!form.key || !form.name) return toast.error('Key and name are required')
    onSave(form, page?.id)
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{page ? `Edit Page: ${page.name}` : 'Create Page'}</DialogTitle>
          <DialogDescription>Define a navigable page/module in the HR system</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Key *</Label>
              <Input
                value={form.key}
                onChange={(e) => setForm({ ...form, key: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                placeholder="custom-page"
                disabled={!!page}
              />
              <p className="text-[10px] text-muted-foreground mt-0.5">Must match the ViewKey in code</p>
            </div>
            <div>
              <Label>Display Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Custom Page" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Main">Main</SelectItem>
                  <SelectItem value="Admin">Admin</SelectItem>
                  <SelectItem value="Executive">Executive</SelectItem>
                  <SelectItem value="HR">HR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sort Order</Label>
              <Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 100 })} />
            </div>
          </div>
          <div>
            <Label>Icon (Lucide name)</Label>
            <Input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="LayoutDashboard" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
          </div>
          <div className="flex items-center gap-2">
            <Switch id="p-active" checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
            <Label htmlFor="p-active">Page is active (visible in sidebar)</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}><Save className="size-4" /> {page ? 'Save' : 'Create'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// PERMISSIONS TAB — Role × Page matrix
// ============================================================
function PermissionsTab({ canEdit }: { canEdit: boolean }) {
  const [roles, setRoles] = useState<Role[]>([])
  const [pages, setPages] = useState<Page[]>([])
  const [matrix, setMatrix] = useState<Record<string, Permission>>({}) // `${roleId}|${pageId}` -> perm
  const [loading, setLoading] = useState(true)
  const [dirty, setDirty] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [rRes, pRes, permRes] = await Promise.all([
        fetch('/api/roles', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/pages', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/role-permissions', { cache: 'no-store' }).then((r) => r.json()),
      ])
      setRoles(rRes.roles || [])
      setPages(pRes.pages || [])
      const m: Record<string, Permission> = {}
      for (const p of permRes.permissions || []) {
        m[`${p.roleId}|${p.pageId}`] = {
          id: p.id,
          roleId: p.roleId,
          pageId: p.pageId,
          canView: p.canView,
          canCreate: p.canCreate,
          canEdit: p.canEdit,
          canDelete: p.canDelete,
        }
      }
      setMatrix(m)
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const key = (roleId: string, pageId: string) => `${roleId}|${pageId}`

  const getPerm = (roleId: string, pageId: string): Permission => {
    return matrix[key(roleId, pageId)] || {
      roleId, pageId,
      canView: false, canCreate: false, canEdit: false, canDelete: false,
    }
  }

  const setPerm = (roleId: string, pageId: string, field: keyof Permission, value: boolean) => {
    const k = key(roleId, pageId)
    const existing = matrix[k] || { roleId, pageId, canView: false, canCreate: false, canEdit: false, canDelete: false }
    setMatrix({ ...matrix, [k]: { ...existing, [field]: value } })
    setDirty(new Set([...dirty, k]))
  }

  const saveAll = async () => {
    if (dirty.size === 0) return toast.info('No changes to save')
    setSaving(true)
    try {
      const updates = Array.from(dirty).map((k) => matrix[k]).filter(Boolean)
      const res = await fetch('/api/role-permissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      })
      if (!res.ok) return toast.error('Failed to save permissions')
      toast.success(`${updates.length} permission(s) saved`)
      setDirty(new Set())
      load()
    } catch {
      toast.error('Network error')
    }
    setSaving(false)
  }

  if (loading) return <div className="text-center py-10 text-muted-foreground">Loading permission matrix...</div>

  return (
    <div className="space-y-3">
      <Card className="border-primary/20">
        <CardContent className="p-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm text-muted-foreground">
            Tick the boxes below to grant each role <strong>View / Create / Edit / Delete</strong> access to each page.
            {dirty.size > 0 && <Badge variant="outline" className="ml-2 text-amber-700 border-amber-200 bg-amber-50">{dirty.size} unsaved</Badge>}
          </div>
          {canEdit && (
            <Button size="sm" onClick={saveAll} disabled={dirty.size === 0 || saving}>
              <Save className="size-4" /> Save Changes
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-background">Page ↓ / Role →</TableHead>
                {roles.map((r) => (
                  <TableHead key={r.id} className="text-center min-w-[120px]">
                    <div className="flex flex-col items-center gap-1">
                      <div className="font-medium text-[11px]">{r.code}</div>
                      <div className="text-[10px] text-muted-foreground font-normal">{r.name}</div>
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pages.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="sticky left-0 bg-background">
                    <div className="font-medium text-sm">{p.name}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{p.key}</div>
                  </TableCell>
                  {roles.map((r) => {
                    const perm = getPerm(r.id, p.id)
                    const isSuperAdmin = r.code === 'SUPER_ADMIN'
                    return (
                      <TableCell key={r.id} className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <label className="flex items-center gap-1 text-[10px] cursor-pointer">
                            <Checkbox
                              checked={perm.canView}
                              disabled={!canEdit || isSuperAdmin}
                              onCheckedChange={(v) => setPerm(r.id, p.id, 'canView', !!v)}
                            />
                            <span>V</span>
                          </label>
                          <label className="flex items-center gap-1 text-[10px] cursor-pointer">
                            <Checkbox
                              checked={perm.canCreate}
                              disabled={!canEdit || isSuperAdmin}
                              onCheckedChange={(v) => setPerm(r.id, p.id, 'canCreate', !!v)}
                            />
                            <span>C</span>
                          </label>
                          <label className="flex items-center gap-1 text-[10px] cursor-pointer">
                            <Checkbox
                              checked={perm.canEdit}
                              disabled={!canEdit || isSuperAdmin}
                              onCheckedChange={(v) => setPerm(r.id, p.id, 'canEdit', !!v)}
                            />
                            <span>E</span>
                          </label>
                          <label className="flex items-center gap-1 text-[10px] cursor-pointer">
                            <Checkbox
                              checked={perm.canDelete}
                              disabled={!canEdit || isSuperAdmin}
                              onCheckedChange={(v) => setPerm(r.id, p.id, 'canDelete', !!v)}
                            />
                            <span>D</span>
                          </label>
                        </div>
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <p className="text-[11px] text-muted-foreground">
        Legend: V = View, C = Create, E = Edit, D = Delete. SUPER_ADMIN always has all permissions and cannot be restricted.
      </p>
    </div>
  )
}

// ============================================================
// AUDIT LOG TAB
// ============================================================
const ACTION_COLOR: Record<string, string> = {
  create: 'bg-green-100 text-green-700 border-green-200',
  update: 'bg-blue-100 text-blue-700 border-blue-200',
  delete: 'bg-red-100 text-red-700 border-red-200',
  forward: 'bg-amber-100 text-amber-700 border-amber-200',
  approve: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  reject: 'bg-rose-100 text-rose-700 border-rose-200',
  return: 'bg-orange-100 text-orange-700 border-orange-200',
  close_permanently: 'bg-gray-200 text-gray-700 border-gray-300',
  close: 'bg-gray-200 text-gray-700 border-gray-300',
  submit: 'bg-sky-100 text-sky-700 border-sky-200',
  acknowledge: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  complete: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  archive: 'bg-violet-100 text-violet-700 border-violet-200',
}

function AuditLogTab({ currentUser }: { currentUser: any }) {
  const [logs, setLogs] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(50)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [entityFilter, setEntityFilter] = useState('all')
  const [actionFilter, setActionFilter] = useState('all')
  const [clearing, setClearing] = useState(false)
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) })
      if (search) params.set('q', search)
      if (entityFilter !== 'all') params.set('entity', entityFilter)
      if (actionFilter !== 'all') params.set('action', actionFilter)
      const res = await fetch(`/api/audit-logs?${params.toString()}`, { cache: 'no-store' })
      const data = await res.json()
      if (res.ok) {
        setLogs(data.logs || [])
        setTotal(data.total || 0)
      } else {
        toast.error(data.error || 'Failed to load audit logs')
      }
    } catch {
      toast.error('Network error')
    }
    setLoading(false)
  }, [page, limit, search, entityFilter, actionFilter])

  useEffect(() => { load() }, [load])

  const handleClear = async () => {
    if (!confirm('Clear all audit logs older than 90 days?\n\nThis action cannot be undone.')) return
    setClearing(true)
    try {
      const res = await fetch('/api/audit-logs', { method: 'DELETE' })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Cleared ${data.deleted} old log entries`)
        load()
      } else {
        toast.error(data.error || 'Failed to clear logs')
      }
    } catch {
      toast.error('Network error')
    }
    setClearing(false)
  }

  const entities = ['Requisition', 'RegistryFile', 'Committee', 'Staff', 'User', 'Role', 'Page', 'Leave', 'AnnualReview']

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search by user, action, or details..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="pl-9"
              />
            </div>
            <Select value={entityFilter} onValueChange={(v) => { setEntityFilter(v); setPage(1) }}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Entity" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Entities</SelectItem>
                {entities.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(1) }}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Action" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="create">Create</SelectItem>
                <SelectItem value="update">Update</SelectItem>
                <SelectItem value="delete">Delete</SelectItem>
                <SelectItem value="forward">Forward</SelectItem>
                <SelectItem value="approve">Approve</SelectItem>
                <SelectItem value="reject">Reject</SelectItem>
                <SelectItem value="return">Return</SelectItem>
                <SelectItem value="close">Close</SelectItem>
                <SelectItem value="acknowledge">Acknowledge</SelectItem>
                <SelectItem value="complete">Complete</SelectItem>
                <SelectItem value="archive">Archive</SelectItem>
              </SelectContent>
            </Select>
            {isSuperAdmin && (
              <Button size="sm" variant="outline" onClick={handleClear} disabled={clearing} className="text-red-600 hover:text-red-700">
                <Trash className="size-4" /> {clearing ? 'Clearing...' : 'Clear >90d'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground">
        Showing {logs.length} of {total} audit {total === 1 ? 'entry' : 'entries'}
        {total > limit && (
          <>
            {' · '}Page {page} of {Math.ceil(total / limit)}
            <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <Button size="sm" variant="ghost" disabled={page >= Math.ceil(total / limit)} onClick={() => setPage(page + 1)}>Next</Button>
          </>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead className="hidden md:table-cell">Entity</TableHead>
                <TableHead className="hidden lg:table-cell">Entity ID</TableHead>
                <TableHead>Details</TableHead>
                <TableHead className="hidden xl:table-cell">IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : logs.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No audit log entries</TableCell></TableRow>
              ) : logs.map((l: any) => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {l.createdAt ? new Date(l.createdAt).toLocaleString() : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Avatar className="size-6">
                        <AvatarFallback className="bg-primary/15 text-primary text-[9px]">
                          {l.user?.fullName?.split(' ').map((n: string) => n[0]).slice(0, 2).join('') || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="text-xs font-medium">{l.user?.fullName || '—'}</div>
                        <div className="text-[10px] text-muted-foreground">{l.user?.role}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] ${ACTION_COLOR[l.action] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                      {l.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-xs">{l.entity || '—'}</TableCell>
                  <TableCell className="hidden lg:table-cell text-xs font-mono text-muted-foreground truncate max-w-[120px]">{l.entityId || '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{l.details || '—'}</TableCell>
                  <TableCell className="hidden xl:table-cell text-xs text-muted-foreground">{l.ipAddress || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// RESET REQUESTS TAB — admin-mediated password reset requests
// ============================================================
function ResetRequestsTab({ currentUser, canEdit }: { currentUser: any; canEdit: boolean }) {
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [resolving, setResolving] = useState<any | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/password-resets', { cache: 'no-store' })
      const data = await res.json()
      setRequests(data.requests || [])
    } catch { toast.error('Failed to load reset requests') }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const dismiss = async (r: any) => {
    if (!confirm(`Dismiss this reset request from "${r.usernameQuery}"?`)) return
    try {
      const res = await fetch(`/api/password-resets/${r.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'dismissed', resolvedNote: 'Dismissed by admin' }),
      })
      if (!res.ok) return toast.error('Failed to dismiss')
      toast.success('Request dismissed'); load()
    } catch { toast.error('Network error') }
  }

  const filtered = requests.filter((r) => statusFilter === 'all' ? true : r.status === statusFilter)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Requester</TableHead>
            <TableHead className="hidden md:table-cell">Contact</TableHead>
            <TableHead>Submitted</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">Loading...</TableCell></TableRow>
            : filtered.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">No password reset requests</TableCell></TableRow>
            : filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell><div className="font-medium text-sm">{r.usernameQuery}</div>{r.user && <div className="text-[10px] text-muted-foreground">→ {r.user.fullName} ({r.user.username})</div>}</TableCell>
                <TableCell className="hidden md:table-cell text-xs">{r.contactEmail || r.contactPhone || '—'}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</TableCell>
                <TableCell>{r.status === 'pending' ? <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200">Pending</Badge> : r.status === 'resolved' ? <Badge variant="outline" className="bg-green-50 text-green-800 border-green-200">Resolved</Badge> : <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">Dismissed</Badge>}</TableCell>
                <TableCell className="text-right">{canEdit && r.status === 'pending' && <div className="flex justify-end gap-1"><Button size="sm" variant="default" onClick={() => setResolving(r)}><KeyRound className="size-3.5" /> Reset</Button><Button size="sm" variant="ghost" onClick={() => dismiss(r)}><X className="size-3.5" /></Button></div>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
      {resolving && <ResolveResetDialog request={resolving} onClose={() => setResolving(null)} onResolved={() => { setResolving(null); load() }} />}
    </div>
  )
}

function ResolveResetDialog({ request, onClose, onResolved }: any) {
  const [mode, setMode] = useState<'default' | 'custom'>('default')
  const [newPassword, setNewPassword] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (mode === 'custom' && !newPassword) { toast.error('Enter a new password'); return }
    if (!request.user) { toast.error('This request has no linked user — dismiss it instead.'); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/password-resets/${request.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved', newPassword: mode === 'custom' ? newPassword : undefined, resolvedNote: mode === 'custom' ? 'Custom password set by admin' : 'Reset to default admin123' }),
      })
      const j = await res.json()
      if (!res.ok) { toast.error(j.error || 'Failed to reset password'); setSaving(false); return }
      toast.success(`Password reset to ${mode === 'custom' ? 'custom password' : 'admin123'}. User can log in now.`)
      onResolved()
    } catch { toast.error('Network error') }
    setSaving(false)
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><KeyRound className="size-5" /> Reset Password</DialogTitle>
          <DialogDescription>Reset password for {request.user?.fullName || 'this account'} (@{request.user?.username || request.usernameQuery}).</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-2"><Label>Reset Mode</Label>
            <Select value={mode} onValueChange={(v: any) => setMode(v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="default">Reset to default (admin123)</SelectItem><SelectItem value="custom">Set a custom password</SelectItem></SelectContent></Select>
          </div>
          {mode === 'custom' && <div className="space-y-2"><Label>New Password</Label><Input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Enter new password" autoFocus /></div>}
          {mode === 'default' && <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-800">The user's password will be reset to <code className="bg-white px-1 rounded">admin123</code>.</div>}
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button><Button onClick={submit} disabled={saving}>{saving ? 'Resetting...' : <><RefreshCw className="size-4" /> Reset Password</>}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
