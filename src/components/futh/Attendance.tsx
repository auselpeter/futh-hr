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
  Tabs, TabsList, TabsTrigger, TabsContent,
} from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Clock, RefreshCw, Search, Loader2, Download, Upload, Fingerprint, Calendar,
  AlertCircle, CheckCircle2, XCircle, Activity, Network, FileSpreadsheet, Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/formatters'
import { exportToExcel } from '@/lib/export'

type AttendanceRecord = {
  id: string
  staffId: string
  punchTime: string
  punchType: string
  verifyMode: number | null
  inOutMode: number | null
  workCode: number | null
  deviceId: string | null
  status: string
  minutesLate: number | null
  minutesEarly: number | null
  hoursWorked: number | null
  source: string
  day: string
  staff: {
    id: string; staffId: string; fullName: string; position: string | null
    department: { id: string; code: string; name: string; isClinical: boolean } | null
    unit: { id: string; code: string; name: string } | null
  }
  shift: { id: string; code: string; name: string; type: string; startTime: string; endTime: string } | null
}

type SummaryRow = {
  staff: {
    id: string; staffId: string; fullName: string; position: string | null
    department: { id: string; code: string; name: string; isClinical: boolean } | null
  }
  period: string
  totalPunches: number
  inPunches: number
  outPunches: number
  onTime: number
  late: number
  earlyLeave: number
  avgHoursWorked: number | null
  totalHoursWorked: number
  presentDays: number
}

const statusColor: Record<string, string> = {
  on_time: 'bg-green-100 text-green-700',
  late: 'bg-amber-100 text-amber-700',
  early_leave: 'bg-orange-100 text-orange-700',
  absent: 'bg-red-100 text-red-700',
  overtime: 'bg-blue-100 text-blue-700',
  off_duty: 'bg-gray-100 text-gray-700',
}

const punchTypeColor: Record<string, string> = {
  in: 'bg-green-100 text-green-700',
  out: 'bg-blue-100 text-blue-700',
  break_in: 'bg-amber-100 text-amber-700',
  break_out: 'bg-orange-100 text-orange-700',
}

const verifyModeLabel: Record<number, string> = {
  0: 'Password',
  1: 'Fingerprint',
  2: 'Card',
  4: 'Face',
}

type Props = { user: any }

export default function Attendance({ user }: Props) {
  const [tab, setTab] = useState<'records' | 'summary' | 'shifts'>('records')
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [shifts, setShifts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('all')
  const [shiftFilter, setShiftFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [total, setTotal] = useState(0)
  const [syncOpen, setSyncOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncHost, setSyncHost] = useState('192.168.1.200')
  const [syncPort, setSyncPort] = useState('4370')
  const [importCsv, setImportCsv] = useState('')
  const [importing, setImporting] = useState(false)
  const [importDeviceId, setImportDeviceId] = useState('csv_import')

  // Summary tab state
  const [summary, setSummary] = useState<SummaryRow[]>([])
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryFrom, setSummaryFrom] = useState('')
  const [summaryTo, setSummaryTo] = useState('')
  const [summaryDept, setSummaryDept] = useState('all')
  const [summaryGroupBy, setSummaryGroupBy] = useState<'day' | 'month'>('day')

  const role = user?.activeRole || user?.role
  const canSync = ['SUPER_ADMIN', 'ADMIN', 'REGISTRY_OFFICER', 'PLANNING_OFFICER'].includes(role)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (deptFilter !== 'all') params.set('departmentId', deptFilter)
      if (shiftFilter !== 'all') params.set('shiftId', shiftFilter)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
      params.set('limit', '500')

      const [recRes, depRes, shRes] = await Promise.all([
        fetch(`/api/attendance?${params.toString()}`, { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/departments', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/shifts', { cache: 'no-store' }).then((r) => r.json()),
      ])
      setRecords(recRes.records || [])
      setTotal(recRes.total || 0)
      setDepartments(depRes.departments || [])
      setShifts(shRes.shifts || [])
    } catch (e) {
      console.error('Attendance load:', e)
    } finally {
      setLoading(false)
    }
  }, [search, deptFilter, shiftFilter, statusFilter, dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  const loadSummary = useCallback(async () => {
    if (!summaryFrom || !summaryTo) return
    setSummaryLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('from', summaryFrom)
      params.set('to', summaryTo)
      if (summaryDept !== 'all') params.set('departmentId', summaryDept)
      params.set('groupBy', summaryGroupBy)
      const res = await fetch(`/api/attendance/summary?${params.toString()}`, { cache: 'no-store' }).then((r) => r.json())
      setSummary(res.summary || [])
    } catch (e) {
      console.error('Attendance summary load:', e)
    } finally {
      setSummaryLoading(false)
    }
  }, [summaryFrom, summaryTo, summaryDept, summaryGroupBy])

  useEffect(() => {
    if (tab === 'summary' && summaryFrom && summaryTo) loadSummary()
  }, [tab, summaryFrom, summaryTo, summaryDept, summaryGroupBy, loadSummary])

  const doSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/attendance/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host: syncHost, port: Number(syncPort) }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(data.message || `Sync complete — ${data.inserted} new records`)
        load()
      } else if (res.status === 502) {
        toast.error(data.message || 'Device unreachable', { duration: 8000 })
      } else {
        toast.error(data.error || 'Sync failed')
      }
    } catch (e: any) {
      toast.error('Network error: ' + (e?.message || 'unknown'))
    } finally {
      setSyncing(false)
    }
  }

  const doImport = async () => {
    if (!importCsv.trim()) {
      toast.error('Paste CSV content first')
      return
    }
    setImporting(true)
    try {
      const res = await fetch('/api/attendance/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: importCsv, deviceId: importDeviceId || 'csv_import' }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(data.message || `Import complete — ${data.inserted} records`, { duration: 8000 })
        setImportOpen(false)
        setImportCsv('')
        load()
      } else {
        toast.error(data.error || 'Import failed', { duration: 8000 })
      }
    } catch (e: any) {
      toast.error('Network error: ' + (e?.message || 'unknown'))
    } finally {
      setImporting(false)
    }
  }

  const exportRecords = () => {
    if (records.length === 0) {
      toast.error('No records to export')
      return
    }
    const rows = records.map((r) => ({
      Day: r.day,
      StaffID: r.staff.staffId,
      Name: r.staff.fullName,
      Department: r.staff.department?.code || '',
      PunchTime: new Date(r.punchTime).toLocaleString(),
      Type: r.punchType.toUpperCase(),
      Status: r.status,
      MinutesLate: r.minutesLate ?? '',
      MinutesEarly: r.minutesEarly ?? '',
      HoursWorked: r.hoursWorked ?? '',
      Shift: r.shift?.code || '',
      DeviceID: r.deviceId || '',
      VerifyMode: r.verifyMode != null ? (verifyModeLabel[r.verifyMode] || r.verifyMode) : '',
      Source: r.source,
    }))
    exportToExcel(`attendance-${new Date().toISOString().slice(0, 10)}`, [{ name: 'Attendance', rows }])
  }

  return (
    <div className="space-y-4">
      {/* === Header === */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary flex items-center gap-2">
            <Clock className="size-6" /> Attendance Management
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            ZKTeco device at 192.168.1.200:4370 · Clinical + non-clinical staff · Shifts: early, late, night, call-duty
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canSync && (
            <>
              <Button variant="outline" onClick={() => setSyncOpen(true)}>
                <RefreshCw className="size-4" /> Sync from Device
              </Button>
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <Upload className="size-4" /> Import CSV
              </Button>
            </>
          )}
          <Button variant="outline" onClick={exportRecords} disabled={records.length === 0}>
            <Download className="size-4" /> Export
          </Button>
        </div>
      </div>

      {/* === Tabs === */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="records"><Activity className="size-4 mr-1" /> Punch Records</TabsTrigger>
          <TabsTrigger value="summary"><FileSpreadsheet className="size-4 mr-1" /> Summary</TabsTrigger>
          <TabsTrigger value="shifts"><Network className="size-4 mr-1" /> Shifts</TabsTrigger>
        </TabsList>

        {/* === Records tab === */}
        <TabsContent value="records" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input placeholder="Search staff name / staffId / IPPIS..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Department</Label>
                  <Select value={deptFilter} onValueChange={setDeptFilter}>
                    <SelectTrigger className="w-48"><SelectValue placeholder="All Depts" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.code} — {d.name}{d.isClinical ? ' (clinical)' : ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Shift</Label>
                  <Select value={shiftFilter} onValueChange={setShiftFilter}>
                    <SelectTrigger className="w-40"><SelectValue placeholder="All Shifts" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Shifts</SelectItem>
                      {shifts.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.code} — {s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-36"><SelectValue placeholder="All" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="on_time">On Time</SelectItem>
                      <SelectItem value="late">Late</SelectItem>
                      <SelectItem value="early_leave">Early Leave</SelectItem>
                      <SelectItem value="absent">Absent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">From</Label>
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">To</Label>
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Records table */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-4"><Skeleton className="h-12" /></div>
              ) : records.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  <Clock className="size-10 mx-auto mb-2 text-muted-foreground/50" />
                  No attendance records found. Try syncing from the ZKTeco device or importing a CSV.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 border-b">
                      <tr>
                        <th className="text-left p-2 font-semibold">Punch Time</th>
                        <th className="text-left p-2 font-semibold">Staff</th>
                        <th className="text-left p-2 font-semibold">Dept</th>
                        <th className="text-left p-2 font-semibold">Type</th>
                        <th className="text-left p-2 font-semibold">Status</th>
                        <th className="text-left p-2 font-semibold">Shift</th>
                        <th className="text-left p-2 font-semibold">Late</th>
                        <th className="text-left p-2 font-semibold">Hrs</th>
                        <th className="text-left p-2 font-semibold">Verify</th>
                        <th className="text-left p-2 font-semibold">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.slice(0, 200).map((r) => (
                        <tr key={r.id} className="border-b hover:bg-muted/30">
                          <td className="p-2">
                            <div className="font-mono text-xs">{new Date(r.punchTime).toLocaleString()}</div>
                            <div className="text-[10px] text-muted-foreground">{r.day}</div>
                          </td>
                          <td className="p-2">
                            <div className="font-medium">{r.staff.fullName}</div>
                            <div className="text-[10px] text-muted-foreground">{r.staff.staffId}</div>
                          </td>
                          <td className="p-2 text-xs">
                            {r.staff.department?.code && (
                              <span className="inline-flex items-center gap-1">
                                <span>{r.staff.department.code}</span>
                                {r.staff.department.isClinical && <Badge variant="outline" className="text-[9px] px-1 py-0">clinical</Badge>}
                              </span>
                            )}
                          </td>
                          <td className="p-2"><Badge className={punchTypeColor[r.punchType] || ''} variant="outline">{r.punchType}</Badge></td>
                          <td className="p-2"><Badge className={statusColor[r.status] || ''} variant="outline">{r.status.replace('_', ' ')}</Badge></td>
                          <td className="p-2 text-xs">{r.shift?.code || '—'}</td>
                          <td className="p-2 text-xs">{r.minutesLate ? `${r.minutesLate}m` : '—'}</td>
                          <td className="p-2 text-xs">{r.hoursWorked != null ? r.hoursWorked.toFixed(2) : '—'}</td>
                          <td className="p-2 text-xs">{r.verifyMode != null ? (verifyModeLabel[r.verifyMode] || r.verifyMode) : '—'}</td>
                          <td className="p-2 text-xs">{r.source === 'csv_import' ? 'CSV' : r.source === 'device' ? 'Device' : r.source}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {total > 200 && (
                    <div className="p-2 text-center text-[10px] text-muted-foreground border-t">
                      Showing 200 of {total} records. Use date filters to narrow down.
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* === Summary tab === */}
        <TabsContent value="summary" className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <Label className="text-[10px] text-muted-foreground">From</Label>
                  <Input type="date" value={summaryFrom} onChange={(e) => setSummaryFrom(e.target.value)} className="w-40" />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">To</Label>
                  <Input type="date" value={summaryTo} onChange={(e) => setSummaryTo(e.target.value)} className="w-40" />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Department</Label>
                  <Select value={summaryDept} onValueChange={setSummaryDept}>
                    <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.code} — {d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Group By</Label>
                  <Select value={summaryGroupBy} onValueChange={(v: any) => setSummaryGroupBy(v)}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">Day</SelectItem>
                      <SelectItem value="month">Month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              {summaryLoading ? (
                <div className="p-4"><Skeleton className="h-12" /></div>
              ) : summary.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  <FileSpreadsheet className="size-10 mx-auto mb-2 text-muted-foreground/50" />
                  {summaryFrom && summaryTo ? 'No attendance in this range' : 'Pick a date range to view summary'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 border-b">
                      <tr>
                        <th className="text-left p-2 font-semibold">Staff</th>
                        <th className="text-left p-2 font-semibold">Dept</th>
                        <th className="text-left p-2 font-semibold">Period</th>
                        <th className="text-right p-2 font-semibold">Present Days</th>
                        <th className="text-right p-2 font-semibold">Punches</th>
                        <th className="text-right p-2 font-semibold">On-Time</th>
                        <th className="text-right p-2 font-semibold">Late</th>
                        <th className="text-right p-2 font-semibold">Early Leave</th>
                        <th className="text-right p-2 font-semibold">Total Hours</th>
                        <th className="text-right p-2 font-semibold">Avg Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.map((s, i) => (
                        <tr key={`${s.staff.id}-${s.period}-${i}`} className="border-b hover:bg-muted/30">
                          <td className="p-2">
                            <div className="font-medium">{s.staff.fullName}</div>
                            <div className="text-[10px] text-muted-foreground">{s.staff.staffId}</div>
                          </td>
                          <td className="p-2 text-xs">{s.staff.department?.code || '—'}</td>
                          <td className="p-2 text-xs font-mono">{s.period}</td>
                          <td className="p-2 text-right">{s.presentDays}</td>
                          <td className="p-2 text-right">{s.totalPunches}</td>
                          <td className="p-2 text-right text-green-700">{s.onTime}</td>
                          <td className="p-2 text-right text-amber-700">{s.late}</td>
                          <td className="p-2 text-right text-orange-700">{s.earlyLeave}</td>
                          <td className="p-2 text-right">{s.totalHoursWorked.toFixed(1)}</td>
                          <td className="p-2 text-right">{s.avgHoursWorked != null ? s.avgHoursWorked.toFixed(2) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* === Shifts tab === */}
        <TabsContent value="shifts">
          <ShiftsManager shifts={shifts} departments={departments} onChanged={load} canEdit={canSync} />
        </TabsContent>
      </Tabs>

      {/* === Sync dialog === */}
      <Dialog open={syncOpen} onOpenChange={setSyncOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sync from ZKTeco Device</DialogTitle>
            <DialogDescription>
              Connects to the ZKTeco attendance device and pulls new punch logs.
              If the device is unreachable, use CSV import instead.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Device IP</Label>
                <Input value={syncHost} onChange={(e) => setSyncHost(e.target.value)} placeholder="192.168.1.200" />
              </div>
              <div>
                <Label>TCP Port</Label>
                <Input value={syncPort} onChange={(e) => setSyncPort(e.target.value)} placeholder="4370" />
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-800 space-y-1">
              <div className="font-semibold flex items-center gap-1"><Fingerprint className="size-3.5" /> Device info</div>
              <div>Default ZKTeco device: <span className="font-mono">192.168.1.200:4370</span></div>
              <div>If sync fails (firmware mismatch), use the ZKTeco "Attend" software to export a CSV file and import it via the Import CSV button.</div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSyncOpen(false)}>Cancel</Button>
            <Button onClick={doSync} disabled={syncing}>
              {syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Sync Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === CSV Import dialog === */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Attendance CSV</DialogTitle>
            <DialogDescription>
              Paste the CSV export from ZKTeco's "Attend" software. Header row required. Existing records (same staffId + punchTime + deviceId) are skipped.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Device ID (optional — defaults to csv_import)</Label>
              <Input value={importDeviceId} onChange={(e) => setImportDeviceId(e.target.value)} placeholder="csv_import" />
            </div>
            <div>
              <Label>CSV Content</Label>
              <Textarea
                value={importCsv}
                onChange={(e) => setImportCsv(e.target.value)}
                placeholder={`UserID,DateTime,InOutMode,VerifyMode,WorkCode\n12345,2026-03-14 08:23:00,0,1,0\n12345,2026-03-14 16:01:00,1,1,0`}
                rows={12}
                className="font-mono text-xs"
              />
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-800 space-y-1">
              <div className="font-semibold">CSV format</div>
              <div>Either: <code className="bg-white px-1 rounded">UserID,DateTime,InOutMode,VerifyMode,WorkCode</code></div>
              <div>Or: <code className="bg-white px-1 rounded">User ID,Date,Time,IN/OUT,Verify Mode,Work Code</code></div>
              <div>UserID is matched against IPPIS number first, then staffId.</div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button>
            <Button onClick={doImport} disabled={importing || !importCsv.trim()}>
              {importing ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// === Shifts sub-component ===
// Inline editor for shift definitions (admin only). Lets the user add/edit
// shifts with code, name, startTime, endTime, graceMinutes, type,
// departmentId (optional), isCallDuty, isActive.
function ShiftsManager({ shifts, departments, onChanged, canEdit }: {
  shifts: any[]
  departments: any[]
  onChanged: () => void
  canEdit: boolean
}) {
  const [editing, setEditing] = useState<any | null>(null)
  const [form, setForm] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  const blank = () => ({
    code: '', name: '', description: '', startTime: '08:00', endTime: '16:00',
    graceMinutes: 15, crossesMidnight: false, type: 'standard', departmentId: '',
    isCallDuty: false, isActive: true,
  })

  const openNew = () => { setEditing('new'); setForm(blank()) }
  const openEdit = (s: any) => {
    setEditing(s.id)
    setForm({
      code: s.code || '', name: s.name || '', description: s.description || '',
      startTime: s.startTime || '08:00', endTime: s.endTime || '16:00',
      graceMinutes: s.graceMinutes ?? 15, crossesMidnight: !!s.crossesMidnight,
      type: s.type || 'standard', departmentId: s.departmentId || '',
      isCallDuty: !!s.isCallDuty, isActive: s.isActive !== false,
    })
  }

  const save = async () => {
    if (!form.code || !form.name || !form.startTime || !form.endTime) {
      toast.error('Code, name, start time and end time are required')
      return
    }
    setSaving(true)
    try {
      const method = editing === 'new' ? 'POST' : 'PATCH'
      const url = editing === 'new' ? '/api/shifts' : `/api/shifts/${editing}`
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      toast.success(editing === 'new' ? 'Shift created' : 'Shift updated')
      setEditing(null)
      setForm(null)
      onChanged()
    } catch (e: any) {
      toast.error(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this shift? If any attendance records reference it, it will be deactivated instead.')) return
    try {
      const res = await fetch(`/api/shifts/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Delete failed')
      toast.success(data.softDeleted ? 'Shift deactivated (records exist)' : 'Shift deleted')
      onChanged()
    } catch (e: any) {
      toast.error(e.message || 'Delete failed')
    }
  }

  const grouped = shifts.reduce((acc: any, s) => {
    const key = s.departmentId || 'global'
    if (!acc[key]) acc[key] = { name: s.departmentId ? `${s.department?.code} — ${s.department?.name}` : 'Global (all departments)', items: [] }
    acc[key].items.push(s)
    return acc
  }, {})

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-2"><Network className="size-4 text-primary" /> Shift Definitions</h2>
            <p className="text-xs text-muted-foreground">Configure shift time windows per department. Non-clinical departments default to 08:00–16:00 STANDARD.</p>
          </div>
          {canEdit && <Button size="sm" onClick={openNew}><Network className="size-4" /> New Shift</Button>}
        </div>

        {Object.keys(grouped).length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm bg-muted/20 rounded-md border border-dashed">
            No shifts defined yet. Click "New Shift" to create one — the system will use defaults (early 06:00–14:00, late 14:00–22:00, night 22:00–06:00, call-duty on-call, standard 08:00–16:00) until you do.
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([key, group]: any) => (
              <div key={key}>
                <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">{group.name}</div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {group.items.map((s: any) => (
                    <div key={s.id} className="border rounded p-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-semibold text-sm">{s.code} — {s.name}</div>
                          {s.description && <div className="text-xs text-muted-foreground">{s.description}</div>}
                        </div>
                        {!s.isActive && <Badge variant="outline" className="text-[9px]">inactive</Badge>}
                      </div>
                      <div className="text-xs mt-1 space-y-0.5">
                        <div><span className="text-muted-foreground">Time:</span> {s.startTime}–{s.endTime}{s.crossesMidnight ? ' (overnight)' : ''}</div>
                        <div><span className="text-muted-foreground">Type:</span> <Badge variant="outline" className="text-[9px]">{s.type}</Badge> {s.isCallDuty && <Badge variant="outline" className="text-[9px] text-orange-700">call-duty</Badge>}</div>
                        <div><span className="text-muted-foreground">Grace:</span> {s.graceMinutes} min</div>
                        {s._count && <div className="text-[10px] text-muted-foreground">{s._count.staffShifts} staff assigned · {s._count.attendance} attendance records</div>}
                      </div>
                      {canEdit && (
                        <div className="flex gap-1 mt-2">
                          <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => openEdit(s)}>Edit</Button>
                          <Button size="sm" variant="outline" className="h-7 px-2 text-destructive" onClick={() => remove(s.id)}>Delete</Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Edit / Create dialog */}
        <Dialog open={!!editing} onOpenChange={(o) => { if (!o) { setEditing(null); setForm(null) } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing === 'new' ? 'New Shift' : 'Edit Shift'}</DialogTitle>
              <DialogDescription>Define the shift time window. For night shifts (crosses midnight), set startTime later than endTime.</DialogDescription>
            </DialogHeader>
            {form && (
              <div className="space-y-3 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Code *</Label>
                    <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="EARLY" />
                  </div>
                  <div>
                    <Label>Name *</Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Early Shift" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Start Time *</Label>
                    <Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
                  </div>
                  <div>
                    <Label>End Time *</Label>
                    <Input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Type</Label>
                    <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="early">Early</SelectItem>
                        <SelectItem value="late">Late</SelectItem>
                        <SelectItem value="night">Night</SelectItem>
                        <SelectItem value="call-duty">Call Duty</SelectItem>
                        <SelectItem value="standard">Standard (non-clinical)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Grace Minutes</Label>
                    <Input type="number" value={form.graceMinutes} onChange={(e) => setForm({ ...form, graceMinutes: Number(e.target.value) })} min={0} max={120} />
                  </div>
                </div>
                <div>
                  <Label>Department (leave empty for global)</Label>
                  <Select value={form.departmentId || 'none'} onValueChange={(v) => setForm({ ...form, departmentId: v === 'none' ? '' : v })}>
                    <SelectTrigger><SelectValue placeholder="Global (all departments)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Global (all departments)</SelectItem>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.code} — {d.name}{d.isClinical ? ' (clinical)' : ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={form.crossesMidnight} onChange={(e) => setForm({ ...form, crossesMidnight: e.target.checked })} />
                    Crosses midnight (overnight)
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={form.isCallDuty} onChange={(e) => setForm({ ...form, isCallDuty: e.target.checked })} />
                    Call duty (on-call)
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                    Active
                  </label>
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Optional..." />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => { setEditing(null); setForm(null) }}>Cancel</Button>
              <Button onClick={save} disabled={saving || !form?.code || !form?.name}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
