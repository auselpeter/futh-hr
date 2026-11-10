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
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Users, Search, Plus, Trash2, Mail, Phone, Briefcase, Building2, Save, Camera, MapPin, CreditCard, GraduationCap, UserCheck, IdCard, Loader2, Download, Printer, Edit } from 'lucide-react'
import { initials, formatDate } from '@/lib/formatters'
import { toast } from 'sonner'
import FileUpload from './FileUpload'
import { exportToExcel } from '@/lib/export'
import { printHTML, printHeader, formatDateForPrint, htmlEscape, row } from '@/lib/print'

const STATUSES = ['active', 'on_leave', 'suspended', 'retired', 'disengaged']
const GENDERS = ['Male', 'Female']
const MARITAL = ['Single', 'Married', 'Divorced', 'Widowed']
const EMPLOYMENT_TYPES = ['permanent', 'contract', 'temp', 'intern']

const statusColor: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  on_leave: 'bg-amber-100 text-amber-700',
  suspended: 'bg-red-100 text-red-700',
  retired: 'bg-gray-100 text-gray-700',
  disengaged: 'bg-orange-100 text-orange-700',
}

type Props = {
  user: any
}

const emptyForm = () => ({
  staffId: '', ippisNumber: '',
  // Personal
  surname: '', firstName: '', otherNames: '', gender: 'Male',
  dateOfBirth: '', maritalStatus: 'Single', nationality: 'Nigerian',
  religion: '', stateOfOrigin: '', lga: '',
  // Government
  ninNumber: '', tinNumber: '', pensionNumber: '', nhfNumber: '', nhisNumber: '',
  // Contact
  email: '', phone: '', altPhone: '',
  // Address
  residentialAddress: '', permanentAddress: '', cityOfResidence: '', stateOfResidence: '',
  // Employment
  position: '', rank: '', employmentType: 'permanent',
  fileNumber: '', gradeLevel: '', step: '', cadre: '',
  dateHired: '', confirmationDate: '', retirementDate: '',
  status: 'active', departmentId: '', designationId: '', unitId: '',
  // Biometrics
  avatarUrl: '', signatureUrl: '', thumbprintUrl: '', pictureUrl: '',
  // Nested
  nextOfKin: [] as any[],
  bankDetails: [] as any[],
  academicBackground: [] as any[],
  dependants: [] as any[],
})

export default function StaffDirectory({ user }: Props) {
  const [staff, setStaff] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [designations, setDesignations] = useState<any[]>([])
  const [units, setUnits] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('all')
  const [dsgFilter, setDsgFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [unitFilter, setUnitFilter] = useState('all')
  const [rankFilter, setRankFilter] = useState('all')
  const [gradeFilter, setGradeFilter] = useState('all')
  const [selected, setSelected] = useState<any | null>(null)
  const [selectedDetail, setSelectedDetail] = useState<any | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<any | null>(null) // null = create mode, staff object = edit mode
  const [form, setForm] = useState<any>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'PLANNING_OFFICER', 'REGISTRY_OFFICER'].includes(user?.activeRole || user?.role)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (deptFilter !== 'all') params.set('departmentId', deptFilter)
      if (dsgFilter !== 'all') params.set('designationId', dsgFilter)
      if (unitFilter !== 'all') params.set('unitId', unitFilter)
      if (rankFilter !== 'all') params.set('rank', rankFilter)
      if (gradeFilter !== 'all') params.set('gradeLevel', gradeFilter)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const [staffRes, deptRes, dsgRes, unitRes] = await Promise.all([
        fetch(`/api/staff?${params.toString()}`, { cache: 'no-store' }),
        fetch('/api/departments', { cache: 'no-store' }),
        fetch('/api/designations', { cache: 'no-store' }),
        fetch('/api/units?limit=500', { cache: 'no-store' }),
      ])
      const sData = await staffRes.json()
      const dData = await deptRes.json()
      const dsgData = await dsgRes.json()
      const uData = await unitRes.json()
      setStaff(sData.staff || [])
      setDepartments(dData.departments || [])
      setDesignations(dsgData.designations || [])
      setUnits(uData.units || [])
    } catch {
      toast.error('Failed to load staff')
    }
    setLoading(false)
  }, [search, deptFilter, dsgFilter, statusFilter, unitFilter, rankFilter, gradeFilter])

  useEffect(() => { load() }, [load])

  const openDetail = async (s: any) => {
    setSelected(s)
    setLoadingDetail(true)
    try {
      const res = await fetch(`/api/staff/${s.id}`, { cache: 'no-store' })
      const data = await res.json()
      setSelectedDetail(data.staff || null)
    } catch {
      toast.error('Failed to load staff details')
    }
    setLoadingDetail(false)
  }

  const handleDeleteStaff = async (staffId: string, deleteUserToo: boolean) => {
    setDeleting(true)
    try {
      const url = `/api/staff/${staffId}${deleteUserToo ? '?deleteUser=true' : ''}`
      const res = await fetch(url, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to delete staff record')
      } else {
        toast.success(`Staff record deleted${deleteUserToo && data.deleted?.linkedUserUsername ? ` + linked user ${data.deleted.linkedUserUsername}` : ''}`)
        setSelected(null)
        setSelectedDetail(null)
        load()
      }
    } catch {
      toast.error('Network error')
    }
    setDeleting(false)
  }

  const openCreate = () => {
    setForm(emptyForm())
    setEditing(null)
    setCreating(true)
  }

  const openEdit = (s: any) => {
    if (!s) return
    // Pre-populate the form from the existing staff record. Format dates as yyyy-MM-dd for <input type="date">.
    const toDateInput = (v: any) => (v ? new Date(v).toISOString().slice(0, 10) : '')
    setForm({
      staffId: s.staffId || '',
      ippisNumber: s.ippisNumber || '',
      // Personal
      surname: s.surname || '',
      firstName: s.firstName || '',
      otherNames: s.otherNames || '',
      gender: s.gender || 'Male',
      dateOfBirth: toDateInput(s.dateOfBirth),
      maritalStatus: s.maritalStatus || 'Single',
      nationality: s.nationality || 'Nigerian',
      religion: s.religion || '',
      stateOfOrigin: s.stateOfOrigin || '',
      lga: s.lga || '',
      // Government
      ninNumber: s.ninNumber || '',
      tinNumber: s.tinNumber || '',
      pensionNumber: s.pensionNumber || '',
      nhfNumber: s.nhfNumber || '',
      nhisNumber: s.nhisNumber || '',
      // Contact
      email: s.email || '',
      phone: s.phone || '',
      altPhone: s.altPhone || '',
      // Address
      residentialAddress: s.residentialAddress || '',
      permanentAddress: s.permanentAddress || '',
      cityOfResidence: s.cityOfResidence || '',
      stateOfResidence: s.stateOfResidence || '',
      // Employment
      position: s.position || '',
      rank: s.rank || '',
      fileNumber: s.fileNumber || '',
      gradeLevel: s.gradeLevel || '',
      step: s.step || '',
      cadre: s.cadre || '',
      employmentType: s.employmentType || 'permanent',
      dateHired: toDateInput(s.dateHired),
      confirmationDate: toDateInput(s.confirmationDate),
      retirementDate: toDateInput(s.retirementDate),
      status: s.status || 'active',
      departmentId: s.departmentId || '',
      unitId: s.unitId || '',
      designationId: s.designationId || '',
      // Biometrics
      avatarUrl: s.avatarUrl || '',
      signatureUrl: s.signatureUrl || '',
      thumbprintUrl: s.thumbprintUrl || '',
      pictureUrl: s.pictureUrl || '',
      // Nested — keep existing
      nextOfKin: s.nextOfKin || [],
      bankDetails: s.bankDetails || [],
      academicBackground: s.academicBackground || [],
      dependants: s.dependants || [],
    })
    setEditing(s)
    setSelected(null)
    setSelectedDetail(null)
    setCreating(true)
  }

  const saveNew = async () => {
    if (!form.staffId || !form.surname || !form.firstName) {
      toast.error('staffId, surname and firstName are required')
      return
    }
    setSaving(true)
    try {
      const isEditing = !!editing
      const url = isEditing ? `/api/staff/${editing.id}` : '/api/staff'
      const method = isEditing ? 'PATCH' : 'POST'
      // When editing, the API PATCH only allows certain fields; we send the form body as-is
      // and the API picks out the allowed fields. (Nested arrays are not updated via PATCH —
      // they require separate endpoints if needed in the future; for now we don't send them.)
      const body: any = { ...form }
      if (isEditing) {
        delete body.nextOfKin
        delete body.bankDetails
        delete body.academicBackground
        delete body.dependants
      }
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || `Failed to ${isEditing ? 'update' : 'create'} staff`)
      } else {
        toast.success(`Staff record ${isEditing ? 'updated' : 'created'}`)
        await load()
        setCreating(false)
        setEditing(null)
      }
    } catch {
      toast.error('Network error')
    }
    setSaving(false)
  }

  // Helpers for nested arrays
  const updateRow = (key: string, idx: number, field: string, value: any) => {
    setForm((prev: any) => {
      const arr = [...(prev[key] || [])]
      arr[idx] = { ...arr[idx], [field]: value }
      return { ...prev, [key]: arr }
    })
  }
  const addRow = (key: string, template: any) => {
    setForm((prev: any) => ({ ...prev, [key]: [...(prev[key] || []), { ...template }] }))
  }
  const removeRow = (key: string, idx: number) => {
    setForm((prev: any) => {
      const arr = [...(prev[key] || [])]
      arr.splice(idx, 1)
      return { ...prev, [key]: arr }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="size-6" /> Staff Directory
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {staff.length} staff across {departments.length} departments
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const rows = staff.map((s: any) => ({
                'Staff ID': s.staffId,
                'IPPIS': s.ippisNumber || '',
                'Surname': s.surname,
                'First Name': s.firstName,
                'Other Names': s.otherNames || '',
                'Full Name': s.fullName,
                'Gender': s.gender || '',
                'Date of Birth': s.dateOfBirth ? formatDate(s.dateOfBirth) : '',
                'Marital Status': s.maritalStatus || '',
                'Nationality': s.nationality || '',
                'State of Origin': s.stateOfOrigin || '',
                'LGA': s.lga || '',
                'Religion': s.religion || '',
                'NIN': s.ninNumber || '',
                'TIN': s.tinNumber || '',
                'Pension PIN': s.pensionNumber || '',
                'NHF': s.nhfNumber || '',
                'NHIS': s.nhisNumber || '',
                'Email': s.email || '',
                'Phone': s.phone || '',
                'Alt Phone': s.altPhone || '',
                'Position': s.position || '',
                'Rank': s.rank || '',
                'File No.': s.fileNumber || '',
                'Grade Level': s.gradeLevel || '',
                'Step': s.step || '',
                'Cadre': s.cadre || '',
                'Unit': s.unit?.code || '',
                'Employment Type': s.employmentType || '',
                'Date Hired': s.dateHired ? formatDate(s.dateHired) : '',
                'Confirmation Date': s.confirmationDate ? formatDate(s.confirmationDate) : '',
                'Retirement Date': s.retirementDate ? formatDate(s.retirementDate) : '',
                'Status': s.status,
                'Department': s.department?.code || '',
                'Designation': s.designation?.code || '',
                'City of Residence': s.cityOfResidence || '',
                'State of Residence': s.stateOfResidence || '',
                'Created At': s.createdAt ? new Date(s.createdAt).toLocaleString() : '',
              }))
              exportToExcel('FUTH_Staff_Directory', [{ name: 'Staff', rows }])
              toast.success(`Exported ${rows.length} staff records`)
            }}
            disabled={!staff.length}
          >
            <Download className="size-4" /> Export to Excel
          </Button>
          {isAdmin && (
            <Button onClick={openCreate} size="sm">
              <Plus className="size-4" /> Add Staff
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, staffId, IPPIS, NIN..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Department" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.code} — {d.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={dsgFilter} onValueChange={setDsgFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Designation" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Designations</SelectItem>
                {designations.map((d) => <SelectItem key={d.id} value={d.id}>{d.code} — {d.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={unitFilter} onValueChange={setUnitFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Unit" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Units</SelectItem>
                {units.filter((u) => deptFilter === 'all' || u.departmentId === deptFilter).map((u) => <SelectItem key={u.id} value={u.id}>{u.code} - {u.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={rankFilter} onValueChange={setRankFilter}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Rank" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Ranks</SelectItem>
                {[...new Set(staff.map(s => s.rank).filter(Boolean))].sort().map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={gradeFilter} onValueChange={setGradeFilter}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Grade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Grades</SelectItem>
                {[...new Set(staff.map(s => s.gradeLevel).filter(Boolean))].sort((a,b) => Number(a)-Number(b)).map((g) => <SelectItem key={g} value={g}>GL {g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 rounded" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase text-muted-foreground border-b">
                    <th className="text-left px-4 py-3 font-medium">Staff ID</th>
                    <th className="text-left px-4 py-3 font-medium">Full Name</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">File No.</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Position</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Department</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Unit</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Grade</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Designation</th>
                    <th className="text-center px-4 py-3 font-medium">Status</th>
                    <th className="text-right px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.length === 0 ? (
                    <tr><td colSpan={10} className="text-center py-10 text-muted-foreground">No staff records found</td></tr>
                  ) : staff.map((s) => (
                    <tr
                      key={s.id}
                      className="border-b last:border-0 hover:bg-muted/50 cursor-pointer"
                      onClick={() => openDetail(s)}
                    >
                      {/* 1. Staff ID */}
                      <td className="px-4 py-3 font-mono text-xs">{s.staffId}</td>
                      {/* 2. Full Name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {s.avatarUrl ? (
                            <img src={s.avatarUrl} alt={s.fullName} className="size-7 rounded-full object-cover" />
                          ) : (
                            <Avatar className="size-7">
                              <AvatarFallback className="bg-primary/15 text-primary text-[10px]">
                                {initials(s.fullName)}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          <span className="font-medium">{s.fullName}</span>
                        </div>
                      </td>
                      {/* 3. File No. */}
                      <td className="px-4 py-3 hidden md:table-cell font-mono text-xs">{s.fileNumber || '\u2014'}</td>
                      {/* 4. Position */}
                      <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{s.position || '\u2014'}</td>
                      {/* 5. Department */}
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {s.department ? (
                          <Badge variant="outline" className="text-xs">{s.department.code}</Badge>
                        ) : '\u2014'}
                      </td>
                      {/* 6. Unit */}
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {s.unit ? (
                          <Badge variant="outline" className="text-xs">{s.unit.code}</Badge>
                        ) : '\u2014'}
                      </td>
                      {/* 7. Grade */}
                      <td className="px-4 py-3 hidden lg:table-cell text-xs font-mono">
                        {s.gradeLevel ? `GL ${s.gradeLevel}` : '\u2014'}
                      </td>
                      {/* 8. Designation */}
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {s.designation ? (
                          <Badge variant="outline" className="text-xs">{s.designation.code}</Badge>
                        ) : '\u2014'}
                      </td>
                      {/* 9. Status */}
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${statusColor[s.status] || 'bg-gray-100 text-gray-700'}`}>
                          {s.status.replace('_', ' ')}
                        </span>
                      </td>
                      {/* 10. Actions */}
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="ghost" className="h-7 text-xs">View</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => { if (!o) { setSelected(null); setSelectedDetail(null) } }}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0 overflow-y-auto">
          {selected && (
            <>
              <SheetHeader className="bg-gradient-to-br from-[#14532d] to-[#15803d] text-white p-6">
                <div className="flex items-center gap-4">
                  {selected.avatarUrl ? (
                     
                    <img src={selected.avatarUrl} alt={selected.fullName} className="size-16 rounded-full object-cover border-2 border-white/30" />
                  ) : (
                    <Avatar className="size-16 border-2 border-white/30">
                      <AvatarFallback className="bg-white/15 text-white text-xl font-semibold">
                        {initials(selected.fullName)}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div>
                    <SheetTitle className="text-white text-lg">{selected.fullName}</SheetTitle>
                    <SheetDescription className="text-white/80 text-xs">
                      {selected.position || 'Staff'} · {selected.staffId}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>
              {loadingDetail ? (
                <div className="p-6"><Skeleton className="h-32 rounded" /></div>
              ) : selectedDetail ? (
                <div className="p-6 space-y-6">
                  {/* Personal */}
                  <Section icon={<Users className="size-4" />} title="Personal Information">
                    <DetailRow label="IPPIS #" value={selectedDetail.ippisNumber} />
                    <DetailRow label="Gender" value={selectedDetail.gender} />
                    <DetailRow label="Date of Birth" value={selectedDetail.dateOfBirth ? new Date(selectedDetail.dateOfBirth).toLocaleDateString("en-GB") : "\u2014"} />
                    <DetailRow label="Marital Status" value={selectedDetail.maritalStatus} />
                    <DetailRow label="Nationality" value={selectedDetail.nationality} />
                    <DetailRow label="Religion" value={selectedDetail.religion} />
                    <DetailRow label="State of Origin" value={selectedDetail.stateOfOrigin} />
                    <DetailRow label="LGA" value={selectedDetail.lga} />
                    <DetailRow label="Date Hired" value={formatDate(selectedDetail.dateHired)} />
                    <DetailRow label="Confirmation Date" value={formatDate(selectedDetail.confirmationDate)} />
                    <DetailRow label="Retirement Date" value={formatDate(selectedDetail.retirementDate)} />
                    <DetailRow label="Status">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${statusColor[selectedDetail.status] || 'bg-gray-100 text-gray-700'}`}>
                        {selectedDetail.status.replace('_', ' ')}
                      </span>
                    </DetailRow>
                  </Section>

                  {/* Government Numbers */}
                  <Section icon={<IdCard className="size-4" />} title="Government Numbers">
                    <DetailRow label="NIN" value={selectedDetail.ninNumber} />
                    <DetailRow label="TIN" value={selectedDetail.tinNumber} />
                    <DetailRow label="Pension PIN" value={selectedDetail.pensionNumber} />
                    <DetailRow label="NHF" value={selectedDetail.nhfNumber} />
                    <DetailRow label="NHIS" value={selectedDetail.nhisNumber} />
                    <DetailRow label="IPPIS" value={selectedDetail.ippisNumber} />
                  </Section>

                  {/* Contact */}
                  <Section icon={<Mail className="size-4" />} title="Contact">
                    <DetailRow label="Email" value={selectedDetail.email} />
                    <DetailRow label="Phone" value={selectedDetail.phone} />
                    <DetailRow label="Alt Phone" value={selectedDetail.altPhone} />
                  </Section>

                  {/* Address */}
                  <Section icon={<MapPin className="size-4" />} title="Address">
                    <DetailRow label="Residential" value={selectedDetail.residentialAddress} />
                    <DetailRow label="Permanent" value={selectedDetail.permanentAddress} />
                    <DetailRow label="City" value={selectedDetail.cityOfResidence} />
                    <DetailRow label="State" value={selectedDetail.stateOfResidence} />
                  </Section>

                  {/* Employment */}
                  <Section icon={<Briefcase className="size-4" />} title="Employment">
                    <DetailRow label="Position" value={selectedDetail.position} />
                    <DetailRow label="Rank" value={selectedDetail.rank} />
                    <DetailRow label="Employment Type" value={selectedDetail.employmentType} />
                    <DetailRow label="Department" value={selectedDetail.department ? `${selectedDetail.department.code} — ${selectedDetail.department.name}` : null} />
                    <DetailRow label="Designation" value={selectedDetail.designation ? `${selectedDetail.designation.code} — ${selectedDetail.designation.name}` : null} />
                  </Section>

                  {/* Biometrics */}
                  <Section icon={<Camera className="size-4" />} title="Biometrics & Uploads">
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <BioImage label="Passport" url={selectedDetail.avatarUrl} />
                      <BioImage label="Photo" url={selectedDetail.pictureUrl} />
                      <BioImage label="Signature" url={selectedDetail.signatureUrl} />
                      <BioImage label="Thumbprint" url={selectedDetail.thumbprintUrl} />
                    </div>
                  </Section>

                  {/* Next of Kin */}
                  <Section icon={<UserCheck className="size-4" />} title={`Next of Kin (${selectedDetail.nextOfKin?.length || 0})`}>
                    {selectedDetail.nextOfKin?.length ? (
      <div className="space-y-2">
        {selectedDetail.nextOfKin.map((nk: any) => (
          <div key={nk.id} className="rounded border p-3 text-sm">
            <div className="flex justify-between">
              <span className="font-medium">{nk.fullName} {nk.isPrimary && <Badge className="ml-2 text-[9px] bg-primary text-white">Primary</Badge>}</span>
              <span className="text-muted-foreground text-xs">{nk.relationship}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">{nk.phone} {nk.email && `· ${nk.email}`}</div>
            <div className="text-xs text-muted-foreground">{[nk.address, nk.city, nk.state].filter(Boolean).join(', ')}</div>
            {nk.occupation && <div className="text-xs text-muted-foreground mt-1">Occupation: {nk.occupation} {nk.employerName && `· ${nk.employerName}`}</div>}
          </div>
        ))}
      </div>
                    ) : <p className="text-sm text-muted-foreground">No next of kin recorded</p>}
                  </Section>

                  {/* Bank Details */}
                  <Section icon={<CreditCard className="size-4" />} title={`Bank Details (${selectedDetail.bankDetails?.length || 0})`}>
                    {selectedDetail.bankDetails?.length ? (
      <div className="space-y-2">
        {selectedDetail.bankDetails.map((b: any) => (
          <div key={b.id} className="rounded border p-3 text-sm">
            <div className="flex justify-between">
              <span className="font-medium">{b.bankName} {b.isPrimary && <Badge className="ml-2 text-[9px] bg-primary text-white">Primary</Badge>}</span>
              <span className="text-muted-foreground text-xs">{b.accountType}</span>
            </div>
            <div className="text-xs mt-1">{b.accountName} · A/C {b.accountNumber}</div>
            {(b.branch || b.sortCode || b.bvnNumber) && (
              <div className="text-xs text-muted-foreground mt-1">
                {[b.branch && `Branch: ${b.branch}`, b.sortCode && `Sort: ${b.sortCode}`, b.bvnNumber && `BVN: ${b.bvnNumber}`].filter(Boolean).join(' · ')}
              </div>
            )}
          </div>
        ))}
      </div>
                    ) : <p className="text-sm text-muted-foreground">No bank details recorded</p>}
                  </Section>

                  {/* Academic Background */}
                  <Section icon={<GraduationCap className="size-4" />} title={`Academic Background (${selectedDetail.academicBackground?.length || 0})`}>
                    {selectedDetail.academicBackground?.length ? (
      <div className="space-y-2">
        {selectedDetail.academicBackground.map((a: any) => (
          <div key={a.id} className="rounded border p-3 text-sm">
            <div className="flex justify-between">
              <span className="font-medium">{a.institution}</span>
              <Badge variant="outline" className="text-[10px]">{a.qualification || '—'}</Badge>
            </div>
            <div className="text-xs text-muted-foreground mt-1">{a.field} {a.grade && `· ${a.grade}`}</div>
            <div className="text-xs text-muted-foreground">{formatDate(a.startDate)} → {formatDate(a.endDate)}</div>
            {a.certificateNumber && <div className="text-xs text-muted-foreground mt-1">Cert #: {a.certificateNumber}</div>}
          </div>
        ))}
      </div>
                    ) : <p className="text-sm text-muted-foreground">No academic records</p>}
                  </Section>

                  {/* Dependants */}
                  <Section icon={<Users className="size-4" />} title={`Dependants (${selectedDetail.dependants?.length || 0})`}>
                    {selectedDetail.dependants?.length ? (
      <div className="grid grid-cols-2 gap-2">
        {selectedDetail.dependants.map((d: any) => (
          <div key={d.id} className="rounded border p-2 text-xs">
            <div className="font-medium">{d.fullName}</div>
            <div className="text-muted-foreground">{d.relationship} · {d.gender}</div>
            <div className="text-muted-foreground">{formatDate(d.dateOfBirth)}</div>
          </div>
        ))}
      </div>
                    ) : <p className="text-sm text-muted-foreground">No dependants recorded</p>}
                  </Section>

                  {/* Linked Account */}
                  {selectedDetail.user && (
                    <Section icon={<Building2 className="size-4" />} title="Linked Account">
                      <DetailRow label="Username" value={selectedDetail.user.username} />
                      <DetailRow label="Role" value={selectedDetail.user.role} />
                      <DetailRow label="Account Status" value={selectedDetail.user.isActive ? 'Active' : 'Inactive'} />
                    </Section>
                  )}

                  <div className="flex gap-2 pt-2 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        const s = selectedDetail
                        const institution = 'FEDERAL UNIVERSITY TEACHING HOSPITAL'
                        const subLine = 'HUMAN RESOURCES MANAGEMENT SYSTEM · Staff Profile'
                        const nokRows = (s.nextOfKin || []).map((nk: any) => `<tr>
                          <td>${htmlEscape(nk.fullName)}</td>
                          <td>${htmlEscape(nk.relationship || '')}</td>
                          <td>${htmlEscape(nk.phone || '')}</td>
                          <td>${htmlEscape(nk.email || '')}</td>
                          <td>${htmlEscape(nk.address || '')}</td>
                          <td>${nk.isPrimary ? '<strong>Yes</strong>' : ''}</td>
                        </tr>`).join('')
                        const bankRows = (s.bankDetails || []).map((b: any) => `<tr>
                          <td>${htmlEscape(b.bankName)}</td>
                          <td>${htmlEscape(b.accountName)}</td>
                          <td>${htmlEscape(b.accountNumber)}</td>
                          <td>${htmlEscape(b.accountType || '')}</td>
                          <td>${htmlEscape(b.branch || '')}</td>
                          <td>${b.isPrimary ? '<strong>Yes</strong>' : ''}</td>
                        </tr>`).join('')
                        const academicRows = (s.academicBackground || []).map((a: any) => `<tr>
                          <td>${htmlEscape(a.institution)}</td>
                          <td>${htmlEscape(a.qualification || '')}</td>
                          <td>${htmlEscape(a.field || '')}</td>
                          <td>${htmlEscape(a.grade || '')}</td>
                          <td>${formatDateForPrint(a.startDate)} → ${formatDateForPrint(a.endDate)}</td>
                        </tr>`).join('')
                        const depRows = (s.dependants || []).map((d: any) => `<tr>
                          <td>${htmlEscape(d.fullName)}</td>
                          <td>${htmlEscape(d.relationship || '')}</td>
                          <td>${htmlEscape(d.gender || '')}</td>
                          <td>${formatDateForPrint(d.dateOfBirth)}</td>
                        </tr>`).join('')
                        const html =
                          printHeader(institution, subLine, s.staffId, `Staff Profile · ${s.fullName}`) +
                          `
                          <div class="grid" style="margin-bottom: 14px;">
                            <div class="section">
                              <h3>Personal</h3>
                              ${row('Full Name', s.fullName)}
                              ${row('Staff ID', s.staffId)}
                              ${row('IPPIS', s.ippisNumber)}
                              ${row('Gender', s.gender)}
                              ${row('Date of Birth', formatDateForPrint(s.dateOfBirth))}
                              ${row('Marital Status', s.maritalStatus)}
                              ${row('Nationality', s.nationality)}
                              ${row('State of Origin', s.stateOfOrigin)}
                              ${row('LGA', s.lga)}
                              ${row('Religion', s.religion)}
                            </div>
                            <div class="section">
                              <h3>Government Numbers</h3>
                              ${row('NIN', s.ninNumber)}
                              ${row('TIN', s.tinNumber)}
                              ${row('Pension PIN', s.pensionNumber)}
                              ${row('NHF', s.nhfNumber)}
                              ${row('NHIS', s.nhisNumber)}
                              <h3 style="margin-top: 10px;">Contact</h3>
                              ${row('Email', s.email)}
                              ${row('Phone', s.phone)}
                              ${row('Alt Phone', s.altPhone)}
                              <h3 style="margin-top: 10px;">Address</h3>
                              ${row('Residential', s.residentialAddress)}
                              ${row('Permanent', s.permanentAddress)}
                              ${row('City', s.cityOfResidence)}
                              ${row('State', s.stateOfResidence)}
                            </div>
                          </div>
                          <div class="section">
                            <h3>Employment</h3>
                            <div class="grid">
                              <div>${row('Position', s.position)}</div>
                              <div>${row('Rank', s.rank)}</div>
                              <div>${row('Employment Type', s.employmentType)}</div>
                              <div>${row('Date Hired', formatDateForPrint(s.dateHired))}</div>
                              <div>${row('Confirmation', formatDateForPrint(s.confirmationDate))}</div>
                              <div>${row('Retirement', formatDateForPrint(s.retirementDate))}</div>
                              <div>${row('Department', s.department ? `${s.department.code} — ${s.department.name}` : null)}</div>
                              <div>${row('Designation', s.designation ? `${s.designation.code} — ${s.designation.name}` : null)}</div>
                              <div>${row('Status', s.status)}</div>
                            </div>
                          </div>
                          <div class="section">
                            <h3>Biometrics</h3>
                            <div style="display:flex; gap:14px; flex-wrap:wrap;">
                              ${s.avatarUrl ? `<div><div class="label">Passport</div><img src="${s.avatarUrl}" style="max-width:120px; max-height:140px;"/></div>` : ''}
                              ${s.signatureUrl ? `<div><div class="label">Signature</div><img src="${s.signatureUrl}" style="max-width:160px; max-height:80px;"/></div>` : ''}
                              ${s.thumbprintUrl ? `<div><div class="label">Thumbprint</div><img src="${s.thumbprintUrl}" style="max-width:120px; max-height:120px;"/></div>` : ''}
                            </div>
                          </div>
                          ${nokRows ? `<div class="section"><h3>Next of Kin</h3><table><thead><tr><th>Name</th><th>Relationship</th><th>Phone</th><th>Email</th><th>Address</th><th>Primary</th></tr></thead><tbody>${nokRows}</tbody></table></div>` : ''}
                          ${bankRows ? `<div class="section"><h3>Bank Details</h3><table><thead><tr><th>Bank</th><th>Account Name</th><th>Account #</th><th>Type</th><th>Branch</th><th>Primary</th></tr></thead><tbody>${bankRows}</tbody></table></div>` : ''}
                          ${academicRows ? `<div class="section"><h3>Academic Background</h3><table><thead><tr><th>Institution</th><th>Qualification</th><th>Field</th><th>Grade</th><th>Dates</th></tr></thead><tbody>${academicRows}</tbody></table></div>` : ''}
                          ${depRows ? `<div class="section"><h3>Dependants</h3><table><thead><tr><th>Name</th><th>Relationship</th><th>Gender</th><th>Date of Birth</th></tr></thead><tbody>${depRows}</tbody></table></div>` : ''}
                          `
                        await printHTML(html, `Staff Profile ${s.fullName}`)
                      }}
                    >
                      <Printer className="size-4" /> Print Profile
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-sm text-muted-foreground">Unable to load detail.</div>
              )}
              <SheetFooter className="px-6 pb-6 flex gap-2 justify-between flex-wrap">
                <div className="flex gap-2 flex-wrap">
                  {isAdmin && selectedDetail && (
                    <>
                      <Button
                        variant="outline"
                        disabled={deleting}
                        onClick={() => openEdit(selectedDetail)}
                      >
                          <Edit className="size-4" /> Edit Staff
                      </Button>
                      <Button
                        variant="destructive"
                        disabled={deleting}
                        onClick={() => {
                          if (!selectedDetail) return
                          const staffName = selectedDetail.fullName || 'this staff'
                          const hasUser = !!selectedDetail.user
                          const msg = hasUser
                            ? `Delete staff record for "${staffName}"?\n\nThis will PERMANENTLY delete:\n• Staff record + ALL related records (duties, appraisals, leaves, promotions, terminations, resignations, retirements, next-of-kin, bank details, academic background, dependants, training enrollments, project memberships)\n• Linked user account (${selectedDetail.user?.username})\n\nThis CANNOT be undone.`
                            : `Delete staff record for "${staffName}"?\n\nThis will PERMANENTLY delete the staff record + ALL related records (duties, appraisals, leaves, promotions, terminations, resignations, retirements, next-of-kin, bank details, academic background, dependants, training enrollments, project memberships).\n\nThis CANNOT be undone.`
                          if (!confirm(msg)) return
                          handleDeleteStaff(selectedDetail.id, hasUser)
                        }}
                      >
                        {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} Delete Staff
                      </Button>
                    </>
                  )}
                </div>
                <Button variant="outline" onClick={() => { setSelected(null); setSelectedDetail(null) }}>Close</Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Create / Edit dialog */}
      <Dialog open={creating} onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null) } }}>
        <DialogContent className="sm:max-w-5xl max-h-[92vh] overflow-hidden p-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>{editing ? `Edit Staff — ${editing.fullName}` : 'Add New Staff'}</DialogTitle>
            <DialogDescription>{editing ? 'Update the staff record fields below. Nested arrays (Next of Kin, Bank, Academic, Dependants) are kept as-is on save.' : 'Create a new staff record with full HR information'}</DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-2">
            <Tabs defaultValue="personal" className="w-full">
              <TabsList className="w-full flex flex-wrap h-auto justify-start gap-1">
                <TabsTrigger value="personal" className="text-xs">Personal</TabsTrigger>
                <TabsTrigger value="govt" className="text-xs">Govt Numbers</TabsTrigger>
                <TabsTrigger value="contact" className="text-xs">Contact</TabsTrigger>
                <TabsTrigger value="address" className="text-xs">Address</TabsTrigger>
                <TabsTrigger value="employment" className="text-xs">Employment</TabsTrigger>
                <TabsTrigger value="biometrics" className="text-xs">Biometrics</TabsTrigger>
                <TabsTrigger value="nok" className="text-xs">Next of Kin</TabsTrigger>
                <TabsTrigger value="bank" className="text-xs">Bank</TabsTrigger>
                <TabsTrigger value="academic" className="text-xs">Academic</TabsTrigger>
                <TabsTrigger value="dependants" className="text-xs">Dependants</TabsTrigger>
              </TabsList>

              <div className="max-h-[60vh] overflow-y-auto py-4 pr-1">
                {/* Personal */}
                <TabsContent value="personal" className="mt-0">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <FormField label="Staff ID *"><Input value={form.staffId} onChange={(e) => setForm({ ...form, staffId: e.target.value })} placeholder="FUTH/013" /></FormField>
                    <FormField label="IPPIS Number"><Input value={form.ippisNumber} onChange={(e) => setForm({ ...form, ippisNumber: e.target.value })} /></FormField>
                    <FormField label="Surname *"><Input value={form.surname} onChange={(e) => setForm({ ...form, surname: e.target.value })} /></FormField>
                    <FormField label="First Name *"><Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></FormField>
                    <FormField label="Other Names"><Input value={form.otherNames} onChange={(e) => setForm({ ...form, otherNames: e.target.value })} /></FormField>
                    <FormField label="Gender">
                      <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{GENDERS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                      </Select>
                    </FormField>
                    <FormField label="Date of Birth (DD/MM/YYYY)"><Input type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} /></FormField>
                    <FormField label="Marital Status">
                      <Select value={form.maritalStatus} onValueChange={(v) => setForm({ ...form, maritalStatus: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{MARITAL.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                      </Select>
                    </FormField>
                    <FormField label="Nationality"><Input value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} /></FormField>
                    <FormField label="Religion"><Input value={form.religion} onChange={(e) => setForm({ ...form, religion: e.target.value })} placeholder="Christian/Muslim/Other" /></FormField>
                    <FormField label="State of Origin"><Input value={form.stateOfOrigin} onChange={(e) => setForm({ ...form, stateOfOrigin: e.target.value })} /></FormField>
                    <FormField label="LGA"><Input value={form.lga} onChange={(e) => setForm({ ...form, lga: e.target.value })} /></FormField>
                  </div>
                </TabsContent>

                {/* Government */}
                <TabsContent value="govt" className="mt-0">
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="NIN (National ID)"><Input value={form.ninNumber} onChange={(e) => setForm({ ...form, ninNumber: e.target.value })} /></FormField>
                    <FormField label="TIN (Tax ID)"><Input value={form.tinNumber} onChange={(e) => setForm({ ...form, tinNumber: e.target.value })} /></FormField>
                    <FormField label="Pension PIN"><Input value={form.pensionNumber} onChange={(e) => setForm({ ...form, pensionNumber: e.target.value })} /></FormField>
                    <FormField label="NHF (Housing Fund)"><Input value={form.nhfNumber} onChange={(e) => setForm({ ...form, nhfNumber: e.target.value })} /></FormField>
                    <FormField label="NHIS (Health Insurance)"><Input value={form.nhisNumber} onChange={(e) => setForm({ ...form, nhisNumber: e.target.value })} /></FormField>
                  </div>
                </TabsContent>

                {/* Contact */}
                <TabsContent value="contact" className="mt-0">
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></FormField>
                    <FormField label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></FormField>
                    <FormField label="Alt Phone"><Input value={form.altPhone} onChange={(e) => setForm({ ...form, altPhone: e.target.value })} /></FormField>
                  </div>
                </TabsContent>

                {/* Address */}
                <TabsContent value="address" className="mt-0">
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="Residential Address" className="col-span-2"><Textarea value={form.residentialAddress} onChange={(e) => setForm({ ...form, residentialAddress: e.target.value })} /></FormField>
                    <FormField label="Permanent Address" className="col-span-2"><Textarea value={form.permanentAddress} onChange={(e) => setForm({ ...form, permanentAddress: e.target.value })} /></FormField>
                    <FormField label="City of Residence"><Input value={form.cityOfResidence} onChange={(e) => setForm({ ...form, cityOfResidence: e.target.value })} /></FormField>
                    <FormField label="State of Residence"><Input value={form.stateOfResidence} onChange={(e) => setForm({ ...form, stateOfResidence: e.target.value })} /></FormField>
                  </div>
                </TabsContent>

                {/* Employment */}
                <TabsContent value="employment" className="mt-0">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <FormField label="Position"><Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} /></FormField>
                    <FormField label="Rank"><Input value={form.rank} onChange={(e) => setForm({ ...form, rank: e.target.value })} /></FormField>
                    <FormField label="Staff File No."><Input value={form.fileNumber || ''} onChange={(e) => setForm({ ...form, fileNumber: e.target.value })} placeholder="e.g. 2181 (from physical file)" className="font-mono" /></FormField>
                    <FormField label="Grade Level"><Input value={form.gradeLevel || ''} onChange={(e) => setForm({ ...form, gradeLevel: e.target.value })} placeholder="e.g. 5, 8, 12" /></FormField>
                    <FormField label="Step"><Input value={form.step || ''} onChange={(e) => setForm({ ...form, step: e.target.value })} placeholder="e.g. 1, 2, 3" /></FormField>
                    <FormField label="Cadre"><Input value={form.cadre || ''} onChange={(e) => setForm({ ...form, cadre: e.target.value })} placeholder="e.g. SNR DATA P. ASST. I" /></FormField>
                    <FormField label="Employment Type">
                      <Select value={form.employmentType} onValueChange={(v) => setForm({ ...form, employmentType: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{EMPLOYMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                    </FormField>
                    <FormField label="Date Hired"><Input type="date" value={form.dateHired} onChange={(e) => setForm({ ...form, dateHired: e.target.value })} /></FormField>
                    <FormField label="Confirmation Date"><Input type="date" value={form.confirmationDate} onChange={(e) => setForm({ ...form, confirmationDate: e.target.value })} /></FormField>
                    <FormField label="Retirement Date"><Input type="date" value={form.retirementDate} onChange={(e) => setForm({ ...form, retirementDate: e.target.value })} /></FormField>
                    <FormField label="NIN"><Input value={form.ninNumber || ''} onChange={(e) => setForm({ ...form, ninNumber: e.target.value })} placeholder="National ID Number" /></FormField>
                    <FormField label="TIN"><Input value={form.tinNumber || ''} onChange={(e) => setForm({ ...form, tinNumber: e.target.value })} placeholder="Tax ID Number" /></FormField>
                    <FormField label="Pension No."><Input value={form.pensionNumber || ''} onChange={(e) => setForm({ ...form, pensionNumber: e.target.value })} placeholder="Pension PIN" /></FormField>
                    <FormField label="Status">
                      <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}</SelectContent>
                      </Select>
                    </FormField>
                    <FormField label="Department">
                      <Select value={form.departmentId || 'none'} onValueChange={(v) => setForm({ ...form, departmentId: v === 'none' ? '' : v, unitId: '' })}>
                        <SelectTrigger><SelectValue placeholder="\u2014" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">\u2014 None \u2014</SelectItem>
                          {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.code} \u2014 {d.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FormField>
                    <FormField label="Unit">
                      <Select value={form.unitId || 'none'} onValueChange={(v) => setForm({ ...form, unitId: v === 'none' ? '' : v })}>
                        <SelectTrigger><SelectValue placeholder="\u2014" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">\u2014 None \u2014</SelectItem>
                          {units.filter((u) => !form.departmentId || u.departmentId === form.departmentId).map((u) => <SelectItem key={u.id} value={u.id}>{u.code} \u2014 {u.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FormField>
                    <FormField label="Designation">
                      <Select value={form.designationId || 'none'} onValueChange={(v) => setForm({ ...form, designationId: v === 'none' ? '' : v })}>
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— None —</SelectItem>
                          {designations.map((d) => <SelectItem key={d.id} value={d.id}>{d.code} — {d.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FormField>
                  </div>
                </TabsContent>

                {/* Biometrics */}
                <TabsContent value="biometrics" className="mt-0">
                  <div className="space-y-4">
                    <div>
                      <Label className="mb-1.5 block">Passport Photo (avatar)</Label>
                      <FileUpload type="avatar" label="Upload passport" accept="image/*" value={form.avatarUrl} onChange={(url) => setForm({ ...form, avatarUrl: url })} />
                    </div>
                    <div>
                      <Label className="mb-1.5 block">Signature</Label>
                      <FileUpload type="signature" label="Upload signature" accept="image/*" value={form.signatureUrl} onChange={(url) => setForm({ ...form, signatureUrl: url })} />
                    </div>
                    <div>
                      <Label className="mb-1.5 block">Thumbprint</Label>
                      <FileUpload type="thumbprint" label="Upload thumbprint" accept="image/*" value={form.thumbprintUrl} onChange={(url) => setForm({ ...form, thumbprintUrl: url })} allowCamera />
                    </div>
                    <div>
                      <Label className="mb-1.5 block">Additional Photo</Label>
                      <FileUpload type="picture" label="Upload photo" accept="image/*" value={form.pictureUrl} onChange={(url) => setForm({ ...form, pictureUrl: url })} allowCamera />
                    </div>
                  </div>
                </TabsContent>

                {/* Next of Kin */}
                <TabsContent value="nok" className="mt-0">
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">Up to 3 next of kin records. Mark one as Primary.</p>
                    {form.nextOfKin.map((nk: any, i: number) => (
                      <div key={i} className="rounded border p-3 space-y-2 relative">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          <FormField label="Full Name"><Input value={nk.fullName || ''} onChange={(e) => updateRow('nextOfKin', i, 'fullName', e.target.value)} /></FormField>
                          <FormField label="Relationship"><Input value={nk.relationship || ''} onChange={(e) => updateRow('nextOfKin', i, 'relationship', e.target.value)} placeholder="Spouse/Parent/..." /></FormField>
                          <FormField label="Gender">
                            <Select value={nk.gender || 'Male'} onValueChange={(v) => updateRow('nextOfKin', i, 'gender', v)}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>{GENDERS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                            </Select>
                          </FormField>
                          <FormField label="Phone"><Input value={nk.phone || ''} onChange={(e) => updateRow('nextOfKin', i, 'phone', e.target.value)} /></FormField>
                          <FormField label="Email"><Input value={nk.email || ''} onChange={(e) => updateRow('nextOfKin', i, 'email', e.target.value)} /></FormField>
                          <FormField label="Occupation"><Input value={nk.occupation || ''} onChange={(e) => updateRow('nextOfKin', i, 'occupation', e.target.value)} /></FormField>
                          <FormField label="Address" className="col-span-2"><Input value={nk.address || ''} onChange={(e) => updateRow('nextOfKin', i, 'address', e.target.value)} /></FormField>
                          <FormField label="City"><Input value={nk.city || ''} onChange={(e) => updateRow('nextOfKin', i, 'city', e.target.value)} /></FormField>
                          <FormField label="State"><Input value={nk.state || ''} onChange={(e) => updateRow('nextOfKin', i, 'state', e.target.value)} /></FormField>
                          <FormField label="Employer"><Input value={nk.employerName || ''} onChange={(e) => updateRow('nextOfKin', i, 'employerName', e.target.value)} /></FormField>
                        </div>
                        <div className="flex justify-between items-center">
                          <label className="flex items-center gap-2 text-xs">
                            <Checkbox checked={!!nk.isPrimary} onCheckedChange={(c) => updateRow('nextOfKin', i, 'isPrimary', !!c)} />
                            Primary next of kin
                          </label>
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeRow('nextOfKin', i)}><Trash2 className="size-3" /> Remove</Button>
                        </div>
                      </div>
                    ))}
                    {form.nextOfKin.length < 3 && (
                      <Button variant="outline" size="sm" onClick={() => addRow('nextOfKin', { fullName: '', relationship: '', gender: 'Male', phone: '', email: '', address: '', city: '', state: '', occupation: '', employerName: '', isPrimary: false })}>
                        <Plus className="size-4" /> Add Next of Kin
                      </Button>
                    )}
                  </div>
                </TabsContent>

                {/* Bank */}
                <TabsContent value="bank" className="mt-0">
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">Up to 2 bank accounts. Mark one as Primary.</p>
                    {form.bankDetails.map((bd: any, i: number) => (
                      <div key={i} className="rounded border p-3 space-y-2">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          <FormField label="Bank Name"><Input value={bd.bankName || ''} onChange={(e) => updateRow('bankDetails', i, 'bankName', e.target.value)} /></FormField>
                          <FormField label="Account Name"><Input value={bd.accountName || ''} onChange={(e) => updateRow('bankDetails', i, 'accountName', e.target.value)} /></FormField>
                          <FormField label="Account Number"><Input value={bd.accountNumber || ''} onChange={(e) => updateRow('bankDetails', i, 'accountNumber', e.target.value)} /></FormField>
                          <FormField label="Account Type">
                            <Select value={bd.accountType || 'Savings'} onValueChange={(v) => updateRow('bankDetails', i, 'accountType', v)}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Savings">Savings</SelectItem>
                                <SelectItem value="Current">Current</SelectItem>
                                <SelectItem value="Salary">Salary</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormField>
                          <FormField label="Branch"><Input value={bd.branch || ''} onChange={(e) => updateRow('bankDetails', i, 'branch', e.target.value)} /></FormField>
                          <FormField label="Sort Code"><Input value={bd.sortCode || ''} onChange={(e) => updateRow('bankDetails', i, 'sortCode', e.target.value)} /></FormField>
                          <FormField label="BVN"><Input value={bd.bvnNumber || ''} onChange={(e) => updateRow('bankDetails', i, 'bvnNumber', e.target.value)} /></FormField>
                        </div>
                        <div className="flex justify-between items-center">
                          <label className="flex items-center gap-2 text-xs">
                            <Checkbox checked={!!bd.isPrimary} onCheckedChange={(c) => updateRow('bankDetails', i, 'isPrimary', !!c)} />
                            Primary account
                          </label>
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeRow('bankDetails', i)}><Trash2 className="size-3" /> Remove</Button>
                        </div>
                      </div>
                    ))}
                    {form.bankDetails.length < 2 && (
                      <Button variant="outline" size="sm" onClick={() => addRow('bankDetails', { bankName: '', accountName: '', accountNumber: '', accountType: 'Savings', branch: '', sortCode: '', bvnNumber: '', isPrimary: false })}>
                        <Plus className="size-4" /> Add Bank Account
                      </Button>
                    )}
                  </div>
                </TabsContent>

                {/* Academic */}
                <TabsContent value="academic" className="mt-0">
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">Up to 5 academic records.</p>
                    {form.academicBackground.map((ab: any, i: number) => (
                      <div key={i} className="rounded border p-3 space-y-2">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          <FormField label="Institution"><Input value={ab.institution || ''} onChange={(e) => updateRow('academicBackground', i, 'institution', e.target.value)} /></FormField>
                          <FormField label="Qualification"><Input value={ab.qualification || ''} onChange={(e) => updateRow('academicBackground', i, 'qualification', e.target.value)} placeholder="BSc/MSc/PhD..." /></FormField>
                          <FormField label="Field of Study"><Input value={ab.field || ''} onChange={(e) => updateRow('academicBackground', i, 'field', e.target.value)} /></FormField>
                          <FormField label="Start Date"><Input type="date" value={ab.startDate || ''} onChange={(e) => updateRow('academicBackground', i, 'startDate', e.target.value)} /></FormField>
                          <FormField label="End Date"><Input type="date" value={ab.endDate || ''} onChange={(e) => updateRow('academicBackground', i, 'endDate', e.target.value)} /></FormField>
                          <FormField label="Grade"><Input value={ab.grade || ''} onChange={(e) => updateRow('academicBackground', i, 'grade', e.target.value)} placeholder="First Class/Second..." /></FormField>
                          <FormField label="Certificate Number"><Input value={ab.certificateNumber || ''} onChange={(e) => updateRow('academicBackground', i, 'certificateNumber', e.target.value)} /></FormField>
                          <div className="md:col-span-2">
                            <Label className="mb-1.5 block">Certificate Upload</Label>
                            <FileUpload type="general" label="Upload certificate" accept="image/*,application/pdf" value={ab.certificateUrl} onChange={(url) => updateRow('academicBackground', i, 'certificateUrl', url)} previewClassName="size-12" />
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeRow('academicBackground', i)}><Trash2 className="size-3" /> Remove</Button>
                        </div>
                      </div>
                    ))}
                    {form.academicBackground.length < 5 && (
                      <Button variant="outline" size="sm" onClick={() => addRow('academicBackground', { institution: '', qualification: '', field: '', startDate: '', endDate: '', grade: '', certificateUrl: '', certificateNumber: '' })}>
                        <Plus className="size-4" /> Add Academic Record
                      </Button>
                    )}
                  </div>
                </TabsContent>

                {/* Dependants */}
                <TabsContent value="dependants" className="mt-0">
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">Up to 5 dependants.</p>
                    {form.dependants.map((dp: any, i: number) => (
                      <div key={i} className="rounded border p-3 space-y-2">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <FormField label="Full Name" className="col-span-2"><Input value={dp.fullName || ''} onChange={(e) => updateRow('dependants', i, 'fullName', e.target.value)} /></FormField>
                          <FormField label="Relationship"><Input value={dp.relationship || ''} onChange={(e) => updateRow('dependants', i, 'relationship', e.target.value)} /></FormField>
                          <FormField label="Gender">
                            <Select value={dp.gender || 'Male'} onValueChange={(v) => updateRow('dependants', i, 'gender', v)}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>{GENDERS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                            </Select>
                          </FormField>
                          <FormField label="Date of Birth"><Input type="date" value={dp.dateOfBirth || ''} onChange={(e) => updateRow('dependants', i, 'dateOfBirth', e.target.value)} /></FormField>
                        </div>
                        <div className="flex justify-end">
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeRow('dependants', i)}><Trash2 className="size-3" /> Remove</Button>
                        </div>
                      </div>
                    ))}
                    {form.dependants.length < 5 && (
                      <Button variant="outline" size="sm" onClick={() => addRow('dependants', { fullName: '', relationship: '', gender: 'Male', dateOfBirth: '' })}>
                        <Plus className="size-4" /> Add Dependant
                      </Button>
                    )}
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </div>
          <DialogFooter className="px-6 pb-4 border-t pt-3">
            <Button variant="outline" onClick={() => { setCreating(false); setEditing(null) }}>{editing ? 'Cancel' : 'Cancel'}</Button>
            <Button onClick={saveNew} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Staff'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold mb-2 text-primary flex items-center gap-2">
        {icon}{title}
      </h3>
      <div className="space-y-2 text-sm">
        {children}
      </div>
    </div>
  )
}

function DetailRow({ label, value, children }: { label: string; value?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value || children || '—'}</span>
    </div>
  )
}

function BioImage({ label, url }: { label: string; url?: string | null }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="size-24 rounded border bg-muted/40 flex items-center justify-center overflow-hidden">
        {url ? (
           
          <img src={url} alt={label} className="w-full h-full object-cover" />
        ) : (
          <span className="text-[10px] text-muted-foreground">—</span>
        )}
      </div>
    </div>
  )
}

function FormField({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className || ''}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  )
}
