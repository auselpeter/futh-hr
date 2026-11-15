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
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertTriangle, AlertCircle, Clock, TrendingUp, HandCoins, UserCheck, Search, Loader2, ShieldAlert,
} from 'lucide-react'
import { formatDate } from '@/lib/formatters'
import { toast } from 'sonner'

type StaffFlag = {
  type: string
  label: string
  severity: 'warning' | 'critical'
  dueDate?: string
  overdueDate?: string
  daysUntilDue?: number
  daysOverdue?: number
  lastPromotionRef?: string | null
  lastPromotionDate?: string | null
}

type FlaggedStaff = {
  staff: {
    id: string; staffId: string; fullName: string; position: string | null; rank: string | null
    gradeLevel: string | null; status: string
    dateHired: string | null; confirmationDate: string | null; retirementDate: string | null
    department: { id: string; code: string; name: string; isClinical: boolean } | null
  }
  flags: StaffFlag[]
}

type Props = { user: any; onNavigate?: (v: any) => void }

export default function StaffFlags({ user, onNavigate }: Props) {
  const [flags, setFlags] = useState<FlaggedStaff[]>([])
  const [summary, setSummary] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<FlaggedStaff | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/staff/flags?type=${typeFilter}`, { cache: 'no-store' })
      const data = await res.json()
      setFlags(data.flags || [])
      setSummary(data.summary || {})
    } catch (e: any) {
      toast.error('Failed to fetch staff flags: ' + (e?.message || ''))
    } finally {
      setLoading(false)
    }
  }, [typeFilter])

  useEffect(() => { load() }, [load])

  const filtered = search
    ? flags.filter((f) => {
        const q = search.toLowerCase()
        return f.staff.fullName.toLowerCase().includes(q) || f.staff.staffId.toLowerCase().includes(q) || (f.staff.department?.code || '').toLowerCase().includes(q)
      })
    : flags

  const severityColor = (sev: string) =>
    sev === 'critical' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-amber-100 text-amber-700 border-amber-200'

  const flagIcon = (type: string) => {
    if (type.startsWith('confirmation')) return <UserCheck className="size-3.5" />
    if (type.startsWith('promotion')) return <TrendingUp className="size-3.5" />
    if (type.startsWith('retirement')) return <HandCoins className="size-3.5" />
    return <AlertTriangle className="size-3.5" />
  }

  return (
    <div className="space-y-4">
      {/* === Header === */}
      <div>
        <h1 className="text-xl font-bold text-primary flex items-center gap-2">
          <ShieldAlert className="size-6" /> Staff Flags
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Confirmation, promotion and retirement milestones — due within 90 days or overdue. Auto-computed from staff records.
        </p>
      </div>

      {/* === Summary cards === */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-3">
            <div className="text-[10px] text-amber-700 uppercase tracking-wide font-semibold">Confirmation Due</div>
            <div className="text-2xl font-bold text-amber-700">{summary.confirmationDue || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-3">
            <div className="text-[10px] text-red-700 uppercase tracking-wide font-semibold">Confirmation Overdue</div>
            <div className="text-2xl font-bold text-red-700">{summary.confirmationOverdue || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-3">
            <div className="text-[10px] text-amber-700 uppercase tracking-wide font-semibold">Promotion Due</div>
            <div className="text-2xl font-bold text-amber-700">{summary.promotionDue || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-3">
            <div className="text-[10px] text-red-700 uppercase tracking-wide font-semibold">Promotion Overdue</div>
            <div className="text-2xl font-bold text-red-700">{summary.promotionOverdue || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-3">
            <div className="text-[10px] text-amber-700 uppercase tracking-wide font-semibold">Retirement Due</div>
            <div className="text-2xl font-bold text-amber-700">{summary.retirementDue || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-3">
            <div className="text-[10px] text-red-700 uppercase tracking-wide font-semibold">Retirement Overdue</div>
            <div className="text-2xl font-bold text-red-700">{summary.retirementOverdue || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* === Filters === */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input placeholder="Search staff name / staffId / dept code..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Flags</SelectItem>
                <SelectItem value="confirmation">Confirmation</SelectItem>
                <SelectItem value="promotion">Promotion</SelectItem>
                <SelectItem value="retirement">Retirement</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground">{filtered.length} staff</div>
          </div>
        </CardContent>
      </Card>

      {/* === Flags list === */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4"><Skeleton className="h-12" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              <ShieldAlert className="size-10 mx-auto mb-2 text-muted-foreground/50" />
              No flagged staff in this category. All staff are within their service thresholds.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b">
                  <tr>
                    <th className="text-left p-2 font-semibold">Staff</th>
                    <th className="text-left p-2 font-semibold">Dept</th>
                    <th className="text-left p-2 font-semibold">Position</th>
                    <th className="text-left p-2 font-semibold">Date Hired</th>
                    <th className="text-left p-2 font-semibold">Last Confirmation</th>
                    <th className="text-left p-2 font-semibold">Last Promotion</th>
                    <th className="text-left p-2 font-semibold">Retirement</th>
                    <th className="text-left p-2 font-semibold">Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((f) => (
                    <tr key={f.staff.id} className="border-b hover:bg-muted/30 cursor-pointer" onClick={() => setSelected(f)}>
                      <td className="p-2">
                        <div className="font-medium">{f.staff.fullName}</div>
                        <div className="text-[10px] text-muted-foreground">{f.staff.staffId}{f.staff.gradeLevel ? ` · GL ${f.staff.gradeLevel}` : ''}</div>
                      </td>
                      <td className="p-2 text-xs">
                        {f.staff.department ? (
                          <div className="flex flex-col">
                            <span>{f.staff.department.code}</span>
                            {f.staff.department.isClinical && <Badge variant="outline" className="text-[9px] px-1 py-0 w-fit mt-0.5">clinical</Badge>}
                          </div>
                        ) : '—'}
                      </td>
                      <td className="p-2 text-xs">{f.staff.position || f.staff.rank || '—'}</td>
                      <td className="p-2 text-xs">{formatDate(f.staff.dateHired)}</td>
                      <td className="p-2 text-xs">{formatDate(f.staff.confirmationDate) || <span className="text-amber-600">not confirmed</span>}</td>
                      <td className="p-2 text-xs">
                        {f.flags.find((fl) => fl.type.startsWith('promotion'))?.lastPromotionDate || '—'}
                      </td>
                      <td className="p-2 text-xs">{formatDate(f.staff.retirementDate) || '—'}</td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-1">
                          {f.flags.map((fl) => (
                            <Badge key={fl.type} className={`text-[9px] ${severityColor(fl.severity)}`} variant="outline">
                              {flagIcon(fl.type)} {fl.label}
                              {fl.daysOverdue && ` · ${fl.daysOverdue}d`}
                              {fl.daysUntilDue != null && ` · ${fl.daysUntilDue}d`}
                            </Badge>
                          ))}
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

      {/* === Detail sheet === */}
      <Sheet open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null) }}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <ShieldAlert className="size-5 text-destructive" />
                  {selected.staff.fullName}
                </SheetTitle>
                <SheetDescription>{selected.staff.staffId} · {selected.staff.position || selected.staff.rank || ''}</SheetDescription>
              </SheetHeader>
              <div className="p-4 space-y-4">
                {/* Department */}
                {selected.staff.department && (
                  <div className="rounded border p-2 bg-muted/40">
                    <div className="text-[10px] text-muted-foreground uppercase">Department</div>
                    <div className="text-sm font-medium">{selected.staff.department.name}</div>
                    <div className="text-[10px] text-muted-foreground">{selected.staff.department.code}{selected.staff.department.isClinical ? ' · clinical' : ' · non-clinical'}</div>
                  </div>
                )}

                {/* Key dates */}
                <div className="rounded border p-3 space-y-1">
                  <div className="text-[10px] text-muted-foreground uppercase mb-1">Service Timeline</div>
                  <div className="flex justify-between text-xs"><span>Date Hired</span><span>{formatDate(selected.staff.dateHired) || '—'}</span></div>
                  <div className="flex justify-between text-xs"><span>Confirmation</span><span>{formatDate(selected.staff.confirmationDate) || <span className="text-amber-600">not confirmed</span>}</span></div>
                  <div className="flex justify-between text-xs"><span>Retirement</span><span>{formatDate(selected.staff.retirementDate) || '—'}</span></div>
                  <div className="flex justify-between text-xs"><span>Status</span><Badge variant="outline" className="text-[9px]">{selected.staff.status}</Badge></div>
                </div>

                {/* Flags */}
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase mb-2">Active Flags ({selected.flags.length})</div>
                  <div className="space-y-2">
                    {selected.flags.map((fl) => (
                      <div key={fl.type} className={`rounded border p-3 ${severityColor(fl.severity)}`}>
                        <div className="flex items-center justify-between">
                          <div className="font-semibold text-sm flex items-center gap-1">{flagIcon(fl.type)} {fl.label}</div>
                          <Badge variant="outline" className="text-[9px]">{fl.severity}</Badge>
                        </div>
                        <div className="text-xs mt-1 space-y-0.5">
                          {fl.dueDate && <div>Due date: <span className="font-mono">{fl.dueDate}</span></div>}
                          {fl.overdueDate && <div>Overdue since: <span className="font-mono">{fl.overdueDate}</span></div>}
                          {fl.daysUntilDue != null && <div>Days until due: <span className="font-semibold">{fl.daysUntilDue}</span></div>}
                          {fl.daysOverdue != null && <div>Days overdue: <span className="font-semibold">{fl.daysOverdue}</span></div>}
                          {fl.lastPromotionRef && <div>Last promotion: <span className="font-mono">{fl.lastPromotionRef}</span> ({fl.lastPromotionDate})</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick actions */}
                <div className="space-y-2">
                  <div className="text-[10px] text-muted-foreground uppercase">Quick Actions</div>
                  {selected.flags.some((f) => f.type.startsWith('confirmation')) && onNavigate && (
                    <Button size="sm" className="w-full" variant="outline" onClick={() => onNavigate('appointment-confirmations')}>
                      <UserCheck className="size-4" /> Open Appointment Confirmations
                    </Button>
                  )}
                  {selected.flags.some((f) => f.type.startsWith('promotion')) && onNavigate && (
                    <Button size="sm" className="w-full" variant="outline" onClick={() => onNavigate('promotions')}>
                      <TrendingUp className="size-4" /> Open Promotions
                    </Button>
                  )}
                  {selected.flags.some((f) => f.type.startsWith('retirement')) && onNavigate && (
                    <Button size="sm" className="w-full" variant="outline" onClick={() => onNavigate('retirements')}>
                      <HandCoins className="size-4" /> Open Retirements
                    </Button>
                  )}
                  {onNavigate && (
                    <Button size="sm" className="w-full" variant="outline" onClick={() => onNavigate('staff')}>
                      <UserCheck className="size-4" /> Open Staff Directory
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
