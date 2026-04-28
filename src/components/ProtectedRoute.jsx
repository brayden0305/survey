import { Navigate } from 'react-router-dom'

function ProtectedRoute({ user, adminOnly = false, children }) {
  if (!user) {
    return <Navigate to="/login" replace />
  }

  const isAdmin = user.app_metadata?.role === 'admin'

  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />
  }

  return children
}

export default ProtectedRoute
