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
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Award, Loader2, Download, Printer, Trophy, Users, Target, TrendingUp,
} from 'lucide-react'
import { toast } from 'sonner'
import { initials } from '@/lib/formatters'
import { exportToExcel } from '@/lib/export'
import { printHTML, printHeader, htmlEscape } from '@/lib/print'

type Rating = {
  id: string
  code: string
  name: string
  staffCount: number
  dutyCount: number
  avgScore: number
  rank?: number
}

type Props = { user: any }

export default function DepartmentRatings({ user }: Props) {
  const [items, setItems] = useState<Rating[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [viewMode, setViewMode] = useState<'departments' | 'units'>('departments')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const endpoint = viewMode === 'departments' ? '/api/department-ratings' : '/api/unit-ratings'
      const res = await fetch(`${endpoint}?period=${period}`, { cache: 'no-store' })
      const data = await res.json()
      const list = (data.ratings || []) as Rating[]
      // Compute rank
      list.sort((a, b) => (b.avgScore || 0) - (a.avgScore || 0))
      list.forEach((r, i) => { r.rank = i + 1 })
      setItems(list)
    } catch {
      toast.error('Failed to load ratings')
    }
    setLoading(false)
  }, [viewMode, period])

  useEffect(() => { load() }, [load])

  const topThree = items.slice(0, 3)
  const medalColor = ['#FFD700', '#C0C0C0', '#CD7F32'] // gold, silver, bronze

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Award className="size-6" /> {viewMode === 'departments' ? 'Department' : 'Unit'} Ratings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Performance leaderboard for period {period}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-end">
          <div>
            <Label className="text-xs">Period (YYYY-MM)</Label>
            <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="w-44" />
          </div>
          <Select value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="departments">Departments</SelectItem>
              <SelectItem value="units">Units</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            disabled={!items.length}
            onClick={() => {
              const rows = items.map((r) => ({
                Rank: r.rank,
                Code: r.code,
                Name: r.name,
                'Staff Count': r.staffCount,
                'Duty Count': r.dutyCount,
                'Avg Score': r.avgScore,
                Period: period,
              }))
              exportToExcel(`FUTH_${viewMode}_ratings_${period}`, [{ name: viewMode === 'departments' ? 'Departments' : 'Units', rows }])
              toast.success(`Exported ${rows.length} ${viewMode}`)
            }}
          >
            <Download className="size-4" /> Export
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const institution = 'FEDERAL UNIVERSITY TEACHING HOSPITAL'
              const subLine = `${viewMode === 'departments' ? 'Department' : 'Unit'} Performance Ratings — Period ${period}`
              const html =
                printHeader(institution, subLine, '', `${viewMode === 'departments' ? 'Department' : 'Unit'} Performance Leaderboard`) +
                `
                <table>
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Code</th>
                      <th>Name</th>
                      <th>Staff</th>
                      <th>Duties</th>
                      <th>Avg Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${items.map((r) => `
                      <tr>
                        <td>${r.rank}</td>
                        <td>${htmlEscape(r.code)}</td>
                        <td>${htmlEscape(r.name)}</td>
                        <td>${r.staffCount}</td>
                        <td>${r.dutyCount}</td>
                        <td>${(r.avgScore || 0).toFixed(2)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
                `
              await printHTML(html, `${viewMode} Ratings — ${period}`)
            }}
          >
            <Printer className="size-4" /> Print
          </Button>
        </div>
      </div>

      {topThree.length > 0 && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {topThree.map((r, i) => (
            <Card key={r.id} className={i === 0 ? 'border-amber-300 bg-gradient-to-br from-amber-50 to-white' : ''}>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trophy style={{ color: medalColor[i] }} className="size-6" />
                    <Badge variant="outline" className="font-mono text-xs">#{r.rank}</Badge>
                  </div>
                  <Badge variant="outline" className="font-mono text-xs">{r.code}</Badge>
                </div>
                <div>
                  <h3 className="font-semibold">{r.name}</h3>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <Users className="size-4 mx-auto text-primary mb-1" />
                    <div className="font-bold text-base">{r.staffCount}</div>
                    <div className="text-muted-foreground">Staff</div>
                  </div>
                  <div>
                    <Target className="size-4 mx-auto text-primary mb-1" />
                    <div className="font-bold text-base">{r.dutyCount}</div>
                    <div className="text-muted-foreground">Duties</div>
                  </div>
                  <div>
                    <TrendingUp className="size-4 mx-auto text-primary mb-1" />
                    <div className="font-bold text-base">{(r.avgScore || 0).toFixed(1)}</div>
                    <div className="text-muted-foreground">Avg</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No rating data for period {period}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase text-muted-foreground border-b">
                    <th className="text-center px-4 py-3">Rank</th>
                    <th className="text-left px-4 py-3">Code</th>
                    <th className="text-left px-4 py-3">Name</th>
                    <th className="text-center px-4 py-3">Staff</th>
                    <th className="text-center px-4 py-3">Duties</th>
                    <th className="text-right px-4 py-3">Avg Score</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((r, i) => (
                    <tr key={r.id} className={`border-b last:border-0 hover:bg-muted/50 ${i < 3 ? 'bg-amber-50/50' : ''}`}>
                      <td className="text-center px-4 py-3">
                        {i < 3 ? (
                          <span className="inline-flex size-6 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: medalColor[i] }}>{r.rank}</span>
                        ) : (
                          <span className="font-mono text-xs">{r.rank}</span>
                        )}
                      </td>
                      <td className="px-4 py-3"><Badge variant="outline" className="font-mono text-[10px]">{r.code}</Badge></td>
                      <td className="px-4 py-3 font-medium">{r.name}</td>
                      <td className="px-4 py-3 text-center font-mono">{r.staffCount}</td>
                      <td className="px-4 py-3 text-center font-mono">{r.dutyCount}</td>
                      <td className="px-4 py-3 text-right font-bold font-mono">{(r.avgScore || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
