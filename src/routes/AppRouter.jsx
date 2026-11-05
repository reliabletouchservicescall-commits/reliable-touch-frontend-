import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

// Auth
import RoleSelectPage from '../pages/auth/RoleSelectPage'
import LoginPage from '../pages/auth/LoginPage'
import RegisterPage from '../pages/auth/RegisterPage'

// Layouts
import AdminLayout from '../layouts/AdminLayout'
import ColdCallerLayout from '../layouts/ColdCallerLayout'
import AgencyLayout from '../layouts/AgencyLayout'
import FollowUpManagerLayout from '../layouts/FollowUpManagerLayout'

// Admin pages
import AdminDashboard from '../pages/admin/DashboardPage'
import UserDetailPage from '../pages/admin/UserDetailPage'
import AdminLeadDetailPage from '../pages/admin/LeadDetailPage'

// Cold Caller pages
import ColdCallerDashboard from '../pages/cold-caller/DashboardPage'
import ColdCallerLeadsPage from '../pages/cold-caller/LeadsPage'
import ColdCallerLeadDetailPage from '../pages/cold-caller/LeadDetailPage'
import ColdCallerNotificationsPage from '../pages/cold-caller/NotificationsPage'

// Agency pages
import AgencyDashboard from '../pages/agency/DashboardPage'
import AgencyAppointmentsPage from '../pages/agency/AppointmentsPage'
import AgencyLeaderboardPage from '../pages/agency/LeaderboardPage'
import AgencyMyProgressPage from '../pages/agency/MyProgressPage'
import CallsHubPage from '../pages/agency/CallsHubPage'
import LeadsHubPage from '../pages/agency/LeadsHubPage'
import DiaryPage from '../pages/agency/DiaryPage'
import TeamHubPage from '../pages/agency/TeamHubPage'
import { CallerCallsHub, CallerLeadsHub, CallerProgressHub } from '../pages/cold-caller/CallerHubs'
import { FumLeadsHub, FumDiaryHub } from '../pages/follow-up-manager/FumHubs'
import { AdminLeadsHub, AdminContactsHub, AdminTeamHub, AdminAgenciesHub, AdminCalendarHub } from '../pages/admin/AdminHubs'

// Company people and cold callers work from a few places (AgencyLayout's / ColdCallerLayout's
// NAV). The old addresses still work — bookmarks, notification links, emails — and land on
// the right tab: `agent` (also a cold caller) / `manager` name where each goes; leave one out
// to keep the page there.
function Goes({ agent, manager, children }) {
  const user = useAuthStore((s) => s.user)
  const { search } = useLocation()
  const to = user?.isAgencyManager ? manager : agent
  if (!to) return children
  const [path, q = ''] = to.split('?')
  const params = new URLSearchParams(q)
  new URLSearchParams(search).forEach((v, k) => params.set(k, v))
  const qs = params.toString()
  return <Navigate to={`${path}${qs ? `?${qs}` : ''}`} replace />
}
function ForAgent({ agent, manager }) {
  return useAuthStore((s) => s.user)?.isAgencyManager ? manager : agent
}
import AgencyLeadDetailPage from '../pages/agency/LeadDetailPage'
import AgencyNotificationsPage from '../pages/agency/NotificationsPage'
import AgencyExcelFilesPage from '../pages/agency/ExcelFilesPage'
import AgencyAreasPage from '../pages/agency/AreasPage'
import AgencyCallerWorkloadPage from '../pages/agency/CallerWorkloadPage'
import AgencyLoginActivityPage from '../pages/agency/LoginActivityPage'
import AgentDetailPage from '../pages/agency/AgentDetailPage'

// Follow Up Manager pages
import FollowUpManagerDashboard from '../pages/follow-up-manager/DashboardPage'
import FollowUpManagerLeadDetailPage from '../pages/follow-up-manager/LeadDetailPage'
import FollowUpManagerNotificationsPage from '../pages/follow-up-manager/NotificationsPage'
// Campaigns is a purely read-only, role-agnostic list (no cold-caller-specific logic or
// copy) — reused as-is (see ColdCallerCampaignsPage import above) rather than cloning
// a near-duplicate file.

// Admin (additional)
import AdminChatPage from '../pages/admin/ChatPage'
import ReportsPage from '../pages/admin/ReportsPage'
import AdminNotificationsPage from '../pages/admin/NotificationsPage'
import BinPage from '../pages/admin/BinPage'

import ColdCallerChatPage from '../pages/cold-caller/ChatPage'
import AgencyChatPage from '../pages/agency/ChatPage'
import AgencyTeamPage from '../pages/agency/TeamPage'
import CompanyProfilePage from '../pages/agency/CompanyProfilePage'
import ApplyPage from '../pages/public/ApplyPage'
import LandlordPage from '../pages/public/LandlordPage'
import AgencyDetailPage from '../pages/admin/AgencyDetailPage'
import FollowUpManagerChatPage from '../pages/follow-up-manager/ChatPage'
import ProtectedRoute from './ProtectedRoute'

function Stub({ label }) {
  return (
    <div className="min-h-full bg-[#FAFAF9] dark:bg-[#0B0B0B] flex items-center justify-center p-8">
      <div className="text-center">
        <p className="text-[#111111] dark:text-white font-semibold text-sm mb-1">{label}</p>
        <p className="text-[#6B7280] dark:text-[#A1A1AA] text-xs">This page is coming soon</p>
      </div>
    </div>
  )
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Default */}
        <Route path="/" element={<Navigate to="/select-role" replace />} />

        {/* Auth */}
        <Route path="/select-role" element={<RoleSelectPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<Stub label="Forgot Password" />} />
        <Route path="/reset-password/:token" element={<Stub label="Reset Password" />} />

        {/* A tenant's application — the private link they're sent; no sign-in */}
        <Route path="/apply/:token" element={<ApplyPage />} />
        <Route path="/landlord/:token" element={<LandlordPage />} />

        {/* ── Admin ────────────────────────────────────────────────── */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="leads" element={<AdminLeadsHub />} />
          <Route path="leads/:id" element={<AdminLeadDetailPage />} />
          <Route path="appointments" element={<AdminCalendarHub />} />
          <Route path="contacts" element={<AdminContactsHub />} />
          <Route path="team" element={<AdminTeamHub />} />
          <Route path="users/:id" element={<UserDetailPage />} />
          <Route path="agencies" element={<AdminAgenciesHub />} />
          <Route path="agencies/:id" element={<AgencyDetailPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="notifications" element={<AdminNotificationsPage />} />
          <Route path="chat" element={<AdminChatPage />} />
          <Route path="bin" element={<BinPage />} />
          {/* The old pages now live in tabs — their addresses still work */}
          <Route path="deal-tracker" element={<Goes agent="/admin/leads?tab=deals" />} />
          <Route path="tenants" element={<Goes agent="/admin/leads?tab=applications" />} />
          <Route path="lease-renewals" element={<Goes agent="/admin/leads?tab=renewals" />} />
          <Route path="caller-workload" element={<Goes agent="/admin/contacts?tab=workload" />} />
          <Route path="call-logs" element={<Goes agent="/admin/contacts?tab=log" />} />
          <Route path="campaigns" element={<Goes agent="/admin/contacts?tab=campaigns" />} />
          <Route path="areas" element={<Goes agent="/admin/contacts?tab=areas" />} />
          <Route path="dnc" element={<Goes agent="/admin/contacts?tab=dnc" />} />
          <Route path="excel-files" element={<Navigate to="/admin/contacts?view=files" replace />} />
          <Route path="performance" element={<Goes agent="/admin/team?tab=performance" />} />
          <Route path="agents-performance" element={<Navigate to="/admin/team?tab=performance&view=agents" replace />} />
          <Route path="users" element={<Goes agent="/admin/team?tab=users" />} />
          <Route path="login-activity" element={<Goes agent="/admin/team?tab=logins" />} />
          <Route path="agents" element={<Goes agent="/admin/agencies?tab=agents" />} />
          <Route path="commissions" element={<Goes agent="/admin/agencies?tab=commissions" />} />
        </Route>

        {/* ── Cold Caller ──────────────────────────────────────────── */}
        <Route
          path="/cold-caller"
          element={
            <ProtectedRoute allowedRoles={['cold_caller']}>
              <ColdCallerLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<ColdCallerDashboard />} />
          <Route path="calls" element={<CallerCallsHub />} />
          <Route path="leads" element={<CallerLeadsHub />} />
          <Route path="leads/new/:contactId" element={<ColdCallerLeadsPage />} />
          <Route path="leads/:id" element={<ColdCallerLeadDetailPage />} />
          <Route path="progress" element={<CallerProgressHub />} />
          <Route path="diary" element={<DiaryPage scope="caller" />} />
          <Route path="notifications" element={<ColdCallerNotificationsPage />} />
          <Route path="chat" element={<ColdCallerChatPage />} />
          {/* The old pages now live in tabs — their addresses still work */}
          <Route path="contacts" element={<Goes agent="/cold-caller/calls?tab=contacts" />} />
          <Route path="call-mode" element={<Goes agent="/cold-caller/calls" />} />
          <Route path="callbacks" element={<Goes agent="/cold-caller/calls?tab=callbacks" />} />
          <Route path="call-logs" element={<Goes agent="/cold-caller/calls?tab=log" />} />
          <Route path="dnc" element={<Goes agent="/cold-caller/calls?tab=dnc" />} />
          <Route path="campaigns" element={<Goes agent="/cold-caller/calls" />} />
          <Route path="deal-tracker" element={<Goes agent="/cold-caller/leads?tab=deals" />} />
          <Route path="tenants" element={<Goes agent="/cold-caller/leads?tab=applications" />} />
          <Route path="appointments" element={<Goes agent="/cold-caller/leads?tab=viewings" />} />
          <Route path="leaderboard" element={<Goes agent="/cold-caller/progress?tab=board" />} />
        </Route>

        {/* ── Agency ───────────────────────────────────────────────── */}
        <Route
          path="/agency"
          element={
            <ProtectedRoute allowedRoles={['agency']}>
              <AgencyLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AgencyDashboard />} />
          <Route path="contacts" element={<Goes agent="/agency/calls?tab=contacts" manager="/agency/calls?tab=contacts" />} />
          <Route path="call-mode" element={<Goes agent="/agency/calls" manager="/agency/calls?tab=next" />} />
          <Route path="callbacks" element={<Goes agent="/agency/calls?tab=callbacks" manager="/agency/calls?tab=callbacks" />} />
          <Route path="caller-workload" element={<Goes manager="/agency/calls?tab=workload"><AgencyCallerWorkloadPage /></Goes>} />
          <Route path="dnc" element={<Goes agent="/agency/calls?tab=dnc" manager="/agency/calls?tab=dnc" />} />
          <Route path="excel-files" element={<Goes manager="/agency/calls?tab=files"><AgencyExcelFilesPage /></Goes>} />
          <Route path="areas" element={<Goes manager="/agency/calls?tab=areas"><AgencyAreasPage /></Goes>} />
          <Route path="campaigns" element={<Goes agent="/agency/calls" manager="/agency/calls?tab=campaigns" />} />
          <Route path="appointments" element={<Goes agent="/agency/diary" manager="/agency/diary" />} />
          <Route path="leads" element={<LeadsHubPage />} />
          <Route path="calls" element={<CallsHubPage />} />
          <Route path="diary" element={<ForAgent agent={<DiaryPage />} manager={<AgencyAppointmentsPage />} />} />
          <Route path="leads/:id" element={<AgencyLeadDetailPage />} />
          <Route path="deal-tracker" element={<Goes agent="/agency/leads?tab=board" manager="/agency/leads?tab=board" />} />
          <Route path="tenants" element={<Goes agent="/agency/leads?tab=tenants" manager="/agency/leads?tab=tenants" />} />
          <Route path="leaderboard" element={<Goes manager="/agency/team?tab=leaderboard"><AgencyLeaderboardPage /></Goes>} />
          <Route path="progress" element={<AgencyMyProgressPage />} />
          <Route path="notifications" element={<AgencyNotificationsPage />} />
          <Route path="team" element={<ForAgent agent={<AgencyTeamPage />} manager={<TeamHubPage />} />} />
          <Route path="company-profile" element={<CompanyProfilePage />} />
          <Route path="login-activity" element={<AgencyLoginActivityPage />} />
          <Route path="agents/:id" element={<AgentDetailPage />} />
          <Route path="chat" element={<AgencyChatPage />} />
        </Route>

        {/* ── Follow Up Manager ───────────────────────────────────────── */}
        <Route
          path="/follow-up-manager"
          element={
            <ProtectedRoute allowedRoles={['follow_up_manager']}>
              <FollowUpManagerLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<FollowUpManagerDashboard />} />
          <Route path="leads" element={<FumLeadsHub />} />
          <Route path="leads/:id" element={<FollowUpManagerLeadDetailPage />} />
          <Route path="diary" element={<FumDiaryHub />} />
          <Route path="notifications" element={<FollowUpManagerNotificationsPage />} />
          <Route path="chat" element={<FollowUpManagerChatPage />} />
          {/* The old pages now live in tabs — their addresses still work */}
          <Route path="deal-tracker" element={<Goes agent="/follow-up-manager/leads?tab=deals" />} />
          <Route path="tenants" element={<Goes agent="/follow-up-manager/leads?tab=applications" />} />
          <Route path="campaigns" element={<Goes agent="/follow-up-manager/leads?tab=campaigns" />} />
          <Route path="appointments" element={<Goes agent="/follow-up-manager/diary?tab=appointments" />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/select-role" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
