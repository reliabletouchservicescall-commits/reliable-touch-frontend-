import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { ROLE_HOME } from '../utils/constants'

export default function ProtectedRoute({ allowedRoles, children }) {
  const { isAuthenticated, user } = useAuthStore()

  if (!isAuthenticated || !user) {
    return <Navigate to="/select-role" replace />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={ROLE_HOME[user.role] ?? '/select-role'} replace />
  }

  return children
}
