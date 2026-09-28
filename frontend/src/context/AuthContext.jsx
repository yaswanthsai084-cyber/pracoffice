import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { clearToken, fetchCurrentUser, getToken, saveToken } from "../services/authService"

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => getToken())
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(() => Boolean(getToken()))

  // Token whose profile has already been fetched. A token that came straight
  // from login() is trusted, so it is never verified a second time.
  const verifiedTokenRef = useRef(null)

  useEffect(() => {
    if (!token) {
      setUser(null)
      setLoading(false)
      return undefined
    }

    // Already known-good (fresh login): skip the extra API round-trip so the
    // dashboard never flashes its "checking session" state.
    if (verifiedTokenRef.current === token) {
      setLoading(false)
      return undefined
    }

    let cancelled = false
    setLoading(true)

    fetchCurrentUser()
      .then((profile) => {
        if (cancelled) return

        verifiedTokenRef.current = token
        setUser(profile)
      })
      .catch((error) => {
        // Only a rejected token ends the session; an unreachable API does not.
        if (cancelled) return

        if (error?.status === 401 || error?.status === 403) {
          verifiedTokenRef.current = null
          clearToken()
          setToken(null)
          setUser(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [token])

  /** Stores a new session (called after a successful login). */
  const login = useCallback((nextToken, nextUser = null) => {
    saveToken(nextToken)
    verifiedTokenRef.current = nextToken
    setUser(nextUser)
    setToken(nextToken)
  }, [])

  /** Forgets the session and returns to the guest state. */
  const logout = useCallback(() => {
    verifiedTokenRef.current = null
    clearToken()
    setToken(null)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ token, user, loading, isAuthenticated: Boolean(token), login, logout }),
    [token, user, loading, login, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/** Session state for any component rendered inside <AuthProvider>. */
export const useAuth = () => {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error("useAuth must be used inside an <AuthProvider>")
  }

  return context
}

export default AuthContext
