import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"

/**
 * Route guard for the exam pages.
 *
 * A student who is not signed in can never open the paper: they are sent to
 * /login (the page they asked for is remembered, so login returns them there).
 */
function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()

  // Wait until the stored token has been verified before deciding.
  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-page">

        <main className="flex flex-1 items-center justify-center px-4 py-16">

          <div className="text-center">

            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-brand-light border-t-brand" />

            <p className="mt-4 text-sm font-medium text-text-secondary">
              Checking your session...
            </p>

          </div>

        </main>

      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return children
}

export default RequireAuth
