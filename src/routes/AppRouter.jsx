import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

// Auth
import RoleSelectPage from '../pages/auth/RoleSelectPage'
import LoginPage from '../pages/auth/LoginPage'
import RegisterPage from '../pages/auth/RegisterPage'

// Layouts
import AdminLayout from '../layouts/AdminLayout'
import ColdCallerLayout from '../layouts/ColdCallerLayout'
import AgencyLayout from '../layouts/AgencyLayout'

// Admin pages
import AdminDashboard from '../pages/admin/DashboardPage'
import ContactsPage from '../pages/admin/ContactsPage'
import UsersPage from '../pages/admin/UsersPage'
import LeadsPage from '../pages/admin/LeadsPage'
import CampaignsPage from '../pages/admin/CampaignsPage'
import DncPage from '../pages/admin/DncPage'
import AppointmentsPage from '../pages/admin/AppointmentsPage'
import AgentsPage from '../pages/admin/AgentsPage'
import CommissionsPage from '../pages/admin/CommissionsPage'
import LeaseRenewalsPage from '../pages/admin/LeaseRenewalsPage'
import AgenciesPage from '../pages/admin/AgenciesPage'
import AreasPage from '../pages/admin/AreasPage'

// Cold Caller pages
import ColdCallerDashboard from '../pages/cold-caller/DashboardPage'
import MyContactsPage from '../pages/cold-caller/MyContactsPage'
import ColdCallerCallLogsPage from '../pages/cold-caller/CallLogsPage'
import ColdCallerLeadsPage from '../pages/cold-caller/LeadsPage'
import ColdCallerAppointmentsPage from '../pages/cold-caller/AppointmentsPage'
import ColdCallerDncPage from '../pages/cold-caller/DncPage'
import ColdCallerCampaignsPage from '../pages/cold-caller/CampaignsPage'
import ColdCallerNotificationsPage from '../pages/cold-caller/NotificationsPage'
import LeaderboardPage from '../pages/cold-caller/LeaderboardPage'

// Agency pages
import AgencyDashboard from '../pages/agency/DashboardPage'
import AgencyAppointmentsPage from '../pages/agency/AppointmentsPage'
import AgencyLeaderboardPage from '../pages/agency/LeaderboardPage'
import AgencyLeadsPage from '../pages/agency/LeadsPage'
import AgencyNotificationsPage from '../pages/agency/NotificationsPage'

// Admin (additional)
import AdminCallLogsPage from '../pages/admin/CallLogsPage'
import AdminChatPage from '../pages/admin/ChatPage'
import PerformancePage from '../pages/admin/PerformancePage'
import AgentsPerformancePage from '../pages/admin/AgentsPerformancePage'
import ReportsPage from '../pages/admin/ReportsPage'
import LoginActivityPage from '../pages/admin/LoginActivityPage'
import AdminNotificationsPage from '../pages/admin/NotificationsPage'

// Shared
import UserChatPage from '../pages/shared/UserChatPage'
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
          <Route path="users" element={<UsersPage />} />
          <Route path="contacts" element={<ContactsPage />} />
          <Route path="leads" element={<LeadsPage />} />
          <Route path="campaigns" element={<CampaignsPage />} />
          <Route path="call-logs" element={<AdminCallLogsPage />} />
          <Route path="dnc" element={<DncPage />} />
          <Route path="appointments" element={<AppointmentsPage />} />
          <Route path="agents" element={<AgentsPage />} />
          <Route path="commissions" element={<CommissionsPage />} />
          <Route path="lease-renewals" element={<LeaseRenewalsPage />} />
          <Route path="agencies" element={<AgenciesPage />} />
          <Route path="areas" element={<AreasPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="performance" element={<PerformancePage />} />
          <Route path="agents-performance" element={<AgentsPerformancePage />} />
          <Route path="login-activity" element={<LoginActivityPage />} />
          <Route path="notifications" element={<AdminNotificationsPage />} />
          <Route path="chat" element={<AdminChatPage />} />
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
          <Route path="contacts" element={<MyContactsPage />} />
          <Route path="leads" element={<ColdCallerLeadsPage />} />
          <Route path="leads/new/:contactId" element={<ColdCallerLeadsPage />} />
          <Route path="call-logs" element={<ColdCallerCallLogsPage />} />
          <Route path="appointments" element={<ColdCallerAppointmentsPage />} />
          <Route path="dnc" element={<ColdCallerDncPage />} />
          <Route path="campaigns" element={<ColdCallerCampaignsPage />} />
          <Route path="leaderboard" element={<LeaderboardPage />} />
          <Route path="notifications" element={<ColdCallerNotificationsPage />} />
          <Route path="chat" element={<UserChatPage />} />
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
          <Route path="appointments" element={<AgencyAppointmentsPage />} />
          <Route path="leads" element={<AgencyLeadsPage />} />
          <Route path="leaderboard" element={<AgencyLeaderboardPage />} />
          <Route path="notifications" element={<AgencyNotificationsPage />} />
          <Route path="chat" element={<UserChatPage />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/select-role" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
