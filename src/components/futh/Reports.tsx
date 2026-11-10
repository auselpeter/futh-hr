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
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import {
  FileBarChart, Search, Loader2, Download, FileText, Eye, Calendar, Building2,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/formatters'
import { exportToExcel } from '@/lib/export'
import { printHTML, printHeader, htmlEscape, row } from '@/lib/print'

const accessLevelLabel: Record<string, string> = {
  executive: 'Executive',
  directorate: 'Directorate',
  management: 'Management',
  officer: 'Officer',
  staff: 'Staff',
  all: 'All Staff',
}

const moduleLabel: Record<string, string> = {
  staff: 'Staff',
  requisitions: 'Requisitions',
  files: 'Registry Files',
  appraisals: 'Appraisals',
  leaves: 'Leaves',
  promotions: 'Promotions',
  terminations: 'Terminations',
  retirements: 'Retirements',
  trainings: 'Trainings',
  projects: 'Projects',
  payment_vouchers: 'Payment Vouchers',
  posting_transfer: 'Posting & Transfer',
  finance: 'Finance',
}

type Props = { user: any }

const emptyGenerateForm = () => ({
  templateId: '',
  startDate: '',
  endDate: '',
  departmentId: 'all',
})

export default function Reports({ user }: Props) {
  const [templates, setTemplates] = useState<any[]>([])
  const [generated, setGenerated] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [generating, setGenerating] = useState(false)
  const [generateForm, setGenerateForm] = useState<any>(emptyGenerateForm())
  const [previewItem, setPreviewItem] = useState<any | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [tRes, gRes, dRes] = await Promise.all([
        fetch('/api/report-templates', { cache: 'no-store' }),
        fetch('/api/reports', { cache: 'no-store' }),
        fetch('/api/departments', { cache: 'no-store' }),
      ])
      const tData = await tRes.json()
      const gData = await gRes.json()
      const dData = await dRes.json()
      setTemplates(tData.templates || [])
      setGenerated(gData.reports || [])
      setDepartments(dData.departments || [])
    } catch {
      toast.error('Failed to load reports')
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = templates.filter((t) => {
    if (categoryFilter !== 'all' && t.category !== categoryFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        (t.code || '').toLowerCase().includes(q) ||
        (t.name || '').toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q)
      )
    }
    return true
  })

  const openGenerate = (template: any) => {
    setGenerateForm({
      templateId: template.id,
      startDate: '',
      endDate: '',
      departmentId: 'all',
    })
    setGenerating(true)
  }

  const doGenerate = async () => {
    if (!generateForm.templateId) return toast.error('Select a template')
    setGenerating(true)
    try {
      const payload: any = { templateId: generateForm.templateId }
      if (generateForm.startDate) payload.startDate = generateForm.startDate
      if (generateForm.endDate) payload.endDate = generateForm.endDate
      if (generateForm.departmentId !== 'all') payload.departmentId = generateForm.departmentId
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) toast.error(data.error || 'Failed to generate report')
      else {
        toast.success('Report generated')
        setPreviewItem(data.report)
        load()
      }
    } catch {
      toast.error('Network error')
    }
    setGenerating(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileBarChart className="size-6" /> Reports
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {templates.length} report templates available · {generated.length} reports generated
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input placeholder="Search reports by code, name..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="HR">HR</SelectItem>
              <SelectItem value="Finance">Finance</SelectItem>
              <SelectItem value="Operations">Operations</SelectItem>
              <SelectItem value="Performance">Performance</SelectItem>
              <SelectItem value="Compliance">Compliance</SelectItem>
              <SelectItem value="Registry">Registry</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No report templates available for your access level</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((t) => (
            <Card key={t.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <FileText className="size-4 text-primary" />
                      <Badge variant="outline" className="font-mono text-[10px]">{t.code}</Badge>
                    </div>
                    <h3 className="font-semibold text-sm mt-2">{t.name}</h3>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">{accessLevelLabel[t.accessLevel] || t.accessLevel}</Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{t.description || '—'}</p>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <Badge variant="outline" className="text-[10px]">{t.category}</Badge>
                  {t.hasDateRange && <Calendar className="size-3" />}
                  {t.hasDeptFilter && <Building2 className="size-3" />}
                </div>
                <Button size="sm" className="w-full" onClick={() => openGenerate(t)}>
                  <FileBarChart className="size-4" /> Generate
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          <h3 className="font-semibold text-sm mb-3">Recently Generated Reports</h3>
          {generated.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">No reports generated yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase text-muted-foreground border-b">
                    <th className="text-left px-3 py-2">Template</th>
                    <th className="text-left px-3 py-2 hidden md:table-cell">Period</th>
                    <th className="text-left px-3 py-2 hidden lg:table-cell">Department</th>
                    <th className="text-left px-3 py-2 hidden md:table-cell">Generated By</th>
                    <th className="text-right px-3 py-2">Date</th>
                    <th className="text-right px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {generated.slice(0, 10).map((r: any) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="px-3 py-2 text-xs">{r.template?.name || '—'}</td>
                      <td className="px-3 py-2 hidden md:table-cell text-xs">
                        {r.startDate ? formatDate(r.startDate) : '—'} → {r.endDate ? formatDate(r.endDate) : '—'}
                      </td>
                      <td className="px-3 py-2 hidden lg:table-cell text-xs">—</td>
                      <td className="px-3 py-2 hidden md:table-cell text-xs">{r.generatedBy?.fullName || '—'}</td>
                      <td className="px-3 py-2 text-right text-xs">{formatDate(r.generatedAt)}</td>
                      <td className="px-3 py-2 text-right">
                        <Button size="sm" variant="ghost" onClick={() => setPreviewItem(r)}>
                          <Eye className="size-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!generateForm.templateId} onOpenChange={(o) => { if (!o) { setGenerateForm(emptyGenerateForm()); setGenerating(false) } }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Generate Report</DialogTitle>
            <DialogDescription>Configure the report parameters</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Template</Label>
              <Input value={templates.find((t) => t.id === generateForm.templateId)?.name || '—'} disabled />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Date</Label>
                <Input type="date" value={generateForm.startDate} onChange={(e) => setGenerateForm({ ...generateForm, startDate: e.target.value })} />
              </div>
              <div>
                <Label>End Date</Label>
                <Input type="date" value={generateForm.endDate} onChange={(e) => setGenerateForm({ ...generateForm, endDate: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Department</Label>
              <Select value={generateForm.departmentId} onValueChange={(v) => setGenerateForm({ ...generateForm, departmentId: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setGenerateForm(emptyGenerateForm()); setGenerating(false) }}>Cancel</Button>
            <Button onClick={doGenerate} disabled={generating}>
              {generating && <Loader2 className="size-4 animate-spin" />} Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReportPreviewSheet item={previewItem} onClose={() => setPreviewItem(null)} />
    </div>
  )
}

function ReportPreviewSheet({ item, onClose }: { item: any | null; onClose: () => void }) {
  if (!item) return null
  let rows: any[] = []
  try {
    rows = item.data ? JSON.parse(item.data) : []
  } catch {
    rows = []
  }
  const cols = rows.length ? Object.keys(rows[0]) : []

  return (
    <Sheet open={!!item} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-3xl p-0 overflow-y-auto">
        <SheetHeader className="bg-gradient-to-br from-[#14532d] to-[#15803d] text-white p-6">
          <SheetTitle className="text-white">{item.template?.name || item.fileName || 'Report'}</SheetTitle>
          <SheetDescription className="text-white/80">
            Generated {formatDate(item.generatedAt)}
          </SheetDescription>
        </SheetHeader>
        <div className="p-6 space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (!rows.length) return toast.error('No data to export')
                exportToExcel(item.fileName || 'report', [{ name: 'Report', rows }])
                toast.success(`Exported ${rows.length} rows`)
              }}
            >
              <Download className="size-4" /> Export Excel
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                const institution = 'FEDERAL UNIVERSITY TEACHING HOSPITAL'
                const subLine = `Report: ${item.template?.name || '—'}`
                const html =
                  printHeader(institution, subLine, item.id, item.template?.name || 'Report') +
                  `<div class="section">
                    <h3>Period</h3>
                    ${row('Start Date', formatDate(item.startDate))}
                    ${row('End Date', formatDate(item.endDate))}
                  </div>` +
                  (rows.length ? `
                    <h3>Report Data</h3>
                    <table>
                      <thead>
                        <tr>${cols.map((c) => `<th>${htmlEscape(c)}</th>`).join('')}</tr>
                      </thead>
                      <tbody>
                        ${rows.map((r: any) => `<tr>${cols.map((c) => `<td>${htmlEscape(String(r[c] ?? ''))}</td>`).join('')}</tr>`).join('')}
                      </tbody>
                    </table>
                  ` : '<div>No data</div>')
                await printHTML(html, item.template?.name || 'Report')
              }}
            >
              <FileBarChart className="size-4" /> Print Report
            </Button>
          </div>

          {rows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No data in this report</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border">
                <thead>
                  <tr className="bg-muted/50">
                    {cols.map((c) => <th key={c} className="text-left px-3 py-2 text-xs uppercase border-b">{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: any, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                      {cols.map((c) => <td key={c} className="px-3 py-2 text-xs">{String(r[c] ?? '—')}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <SheetFooter className="px-6 pb-6">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
