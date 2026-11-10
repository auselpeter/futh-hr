'use client'

import { useEffect, useState, useCallback } from 'react'
import { useCurrentUser } from '@/hooks/use-current-user'
import LoginScreen from '@/components/futh/LoginScreen'
import AppShell from '@/components/futh/AppShell'
import Dashboard from '@/components/futh/Dashboard'
import CMDDashboard from '@/components/futh/CMDDashboard'
import CMDMail from '@/components/futh/CMDMail'
import Requisitions from '@/components/futh/Requisitions'
import Files from '@/components/futh/Files'
import Designations from '@/components/futh/Designations'
import StaffDirectory from '@/components/futh/StaffDirectory'
import Appraisals from '@/components/futh/Appraisals'
import Leaves from '@/components/futh/Leaves'
import Promotions from '@/components/futh/Promotions'
import Terminations from '@/components/futh/Terminations'
import Resignations from '@/components/futh/Resignations'
import UserManagement from '@/components/futh/UserManagement'
import Committees from '@/components/futh/Committees'
import Documents from '@/components/futh/Documents'
import Mail from '@/components/futh/Mail'
import Settings from '@/components/futh/Settings'
import RequisitionCreate from '@/components/futh/RequisitionCreate'
import MailCompose from '@/components/futh/MailCompose'
import FileCreate from '@/components/futh/FileCreate'
import Projects from '@/components/futh/Projects'
import Reports from '@/components/futh/Reports'
import DepartmentRatings from '@/components/futh/DepartmentRatings'
import Retirements from '@/components/futh/Retirements'
import PaymentVouchers from '@/components/futh/PaymentVouchers'
import PostingTransfer from '@/components/futh/PostingTransfer'
import Trainings from '@/components/futh/Trainings'
import Departments from '@/components/futh/Departments'
import Units from '@/components/futh/Units'
import type { ViewKey } from '@/components/futh/Sidebar'
import { Loader2 } from 'lucide-react'

export default function Home() {
  const { user, loading, logout, refresh } = useCurrentUser()
  const [view, setView] = useState<ViewKey>('dashboard')
  const [quickReqOpen, setQuickReqOpen] = useState(false)
  const [quickMailOpen, setQuickMailOpen] = useState(false)
  const [quickFileOpen, setQuickFileOpen] = useState(false)
  const [filesCommitteeFilter, setFilesCommitteeFilter] = useState<string | null>(null)

  // refresh helper data when navigating to a module
  const handleNavigate = useCallback((v: ViewKey) => {
    setView(v)
    // Reset committee filter when navigating away from Files
    if (v !== 'files') setFilesCommitteeFilter(null)
  }, [])

  // Decide default landing view based on role once user is loaded
  useEffect(() => {
    if (user) {
      const r = user.activeRole || user.role
      if ((r === 'CMD' || r === 'SUPER_ADMIN') && view === 'dashboard') {
        // CMDs land on CMD Dashboard by default — but keep dashboard option
        setView('cmd-dashboard')
      }
    }
  }, [user])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="size-10 animate-spin text-primary mx-auto" />
          <div className="text-sm text-muted-foreground mt-3">Loading FUTH HR...</div>
        </div>
      </div>
    )
  }

  if (!user) {
    return <LoginScreen onLogin={refresh} />
  }

  const handleQuickAction = (
    action: 'new-requisition' | 'new-file' | 'compose-mail',
  ) => {
    if (action === 'new-requisition') setQuickReqOpen(true)
    if (action === 'new-file') setQuickFileOpen(true)
    if (action === 'compose-mail') setQuickMailOpen(true)
  }

  return (
    <>
      <AppShell current={view} onNavigate={handleNavigate}>
        {view === 'dashboard' && (
          <Dashboard
            user={user}
            onNavigate={handleNavigate}
            onQuickAction={handleQuickAction}
          />
        )}
        {view === 'cmd-dashboard' && ((user.activeRole || user.role) === 'CMD' || (user.activeRole || user.role) === 'SUPER_ADMIN') && (
          <CMDDashboard
            user={user}
            onNavigate={handleNavigate}
            onOpenRequisition={() => setView('requisitions')}
            onOpenMail={() => setView('cmd-mail')}
            onQuickAction={handleQuickAction}
          />
        )}
        {view === 'cmd-mail' && ((user.activeRole || user.role) === 'CMD' || (user.activeRole || user.role) === 'SUPER_ADMIN') && (
          <CMDMail user={user} />
        )}
        {view === 'requisitions' && <Requisitions user={user} />}
        {view === 'projects' && <Projects user={user} />}
        {view === 'reports' && <Reports user={user} />}
        {view === 'files' && (
          <Files
            user={user}
            initialCommitteeFilter={filesCommitteeFilter}
          />
        )}
        {view === 'committees' && (
          <Committees
            user={user}
            onViewCommitteeFiles={(committeeId) => {
              setFilesCommitteeFilter(committeeId)
              setView('files')
            }}
          />
        )}
        {view === 'documents' && <Documents user={user} />}
        {view === 'designations' && <Designations />}
        {view === 'staff' && <StaffDirectory user={user} />}
        {view === 'duties' && <Appraisals user={user} onNavigate={handleNavigate} />}
        {view === 'appraisals' && <Appraisals user={user} onNavigate={handleNavigate} />}
        {view === 'department-ratings' && <DepartmentRatings user={user} />}
        {view === 'leaves' && <Leaves user={user} onNavigate={handleNavigate} />}
        {view === 'promotions' && <Promotions user={user} />}
        {view === 'terminations' && <Terminations user={user} />}
        {view === 'resignations' && <Resignations user={user} />}
        {view === 'retirements' && <Retirements user={user} />}
        {view === 'payment-vouchers' && <PaymentVouchers user={user} />}
        {view === 'posting-transfer' && <PostingTransfer user={user} />}
        {view === 'trainings' && <Trainings user={user} />}
        {view === 'departments' && <Departments user={user} />}
        {view === 'units' && <Units user={user} />}
        {view === 'user-mgmt' && ((user.activeRole || user.role) === 'SUPER_ADMIN' || (user.activeRole || user.role) === 'ADMIN') && (
          <UserManagement user={user} />
        )}
        {view === 'mail' && <Mail user={user} />}
        {view === 'settings' && <Settings user={user} />}
      </AppShell>

      {/* Quick-action modals — shared across views */}
      <QuickActionModals
        user={user}
        quickReqOpen={quickReqOpen}
        setQuickReqOpen={setQuickReqOpen}
        quickMailOpen={quickMailOpen}
        setQuickMailOpen={setQuickMailOpen}
        quickFileOpen={quickFileOpen}
        setQuickFileOpen={setQuickFileOpen}
      />
    </>
  )
}

function QuickActionModals({
  user, quickReqOpen, setQuickReqOpen, quickMailOpen, setQuickMailOpen,
  quickFileOpen, setQuickFileOpen,
}: any) {
  const [users, setUsers] = useState<any[]>([])
  const [designations, setDesignations] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [staffList, setStaffList] = useState<any[]>([])

  useEffect(() => {
    Promise.all([
      fetch('/api/users', { cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/designations', { cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/departments', { cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/staff', { cache: 'no-store' }).then((r) => r.json()),
    ]).then(([u, d, dep, st]) => {
      setUsers(u.users || [])
      setDesignations(d.designations || [])
      setDepartments(dep.departments || [])
      setStaffList(st.staff || [])
    }).catch(() => {})
  }, [])

  const isRegistry = ['SUPER_ADMIN', 'ADMIN', 'REGISTRY_OFFICER'].includes(user?.activeRole || user?.role)

  return (
    <>
      <RequisitionCreate
        open={quickReqOpen}
        onClose={() => setQuickReqOpen(false)}
        users={users}
        designations={designations}
        currentUser={user}
        onCreated={() => setQuickReqOpen(false)}
      />
      <MailCompose
        open={quickMailOpen}
        onClose={() => setQuickMailOpen(false)}
        users={users}
        onSent={() => setQuickMailOpen(false)}
      />
      {isRegistry && (
        <FileCreate
          open={quickFileOpen}
          onClose={() => setQuickFileOpen(false)}
          users={users}
          designations={designations}
          departments={departments}
          staffList={staffList}
          onCreated={() => setQuickFileOpen(false)}
        />
      )}
    </>
  )
}
