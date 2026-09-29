/**
 * Auth API client (backend endpoints).
 *
 *   POST /api/auth/register   create an account (password = mobile number)
 *   POST /api/auth/login      sign in, returns the JWT that every authorized
 *                             request sends as `Authorization: Bearer <token>`
 *
 * The Vite dev server proxies /api to the backend (see vite.config.mjs); set
 * VITE_API_BASE_URL to call a backend on another origin.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || ""

/** Error carrying the HTTP status and the backend's per-field messages. */
export class ApiError extends Error {
  constructor(message, { status = 0, errors = [] } = {}) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.errors = errors
  }
}

const call = async (path, { method = "GET", body, token } = {}) => {
  const headers = { "Content-Type": "application/json" }

  // Authorized endpoints (GET /api/auth/me) need the stored JWT.
  if (token) headers.Authorization = `Bearer ${token}`

  let response

  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(
      "Unable to reach the server. Please make sure the backend is running and try again."
    )
  }

  // Read the body as text FIRST and only treat it as JSON when the response
  // says so. A dead backend makes the Vite proxy answer with a plain-text 500,
  // and `response.json()` would throw on it, leaving `data` null - which used
  // to surface as a useless "Something went wrong" instead of the real cause.
  const raw = await response.text().catch(() => "")
  const contentType = response.headers.get("content-type") || ""
  const data = contentType.includes("application/json") && raw !== ""
    ? JSON.parse(raw)
    : null

  if (!response.ok) {
    // An error response that is not JSON never came from the API itself.
    if (data === null) {
      throw new ApiError(
        `The backend is not responding (HTTP ${response.status}). Start it with ` +
          `"npm run dev" in the backend folder, then try again.`,
        { status: response.status }
      )
    }
    throw new ApiError(
      data.message || "Something went wrong. Please try again.",
      { status: response.status, errors: data.errors || [] }
    )
  }

  // A 200 that is not JSON usually means the request never reached the
  // backend (e.g. the dev server proxy is not loaded yet).
  if (data === null || typeof data !== "object") {
    throw new ApiError(
      "Unexpected response from the server. Please make sure the backend is running and restart the dev server if vite.config.mjs just changed."
    )
  }

  return data
}

/**
 * Creates an account; the mobile number becomes the password.
 *
 * The form has no name input, but the API expects a name, so the username is
 * sent as the name automatically - students never see or type a name field.
 */
export const registerAccount = (payload) =>
  call("/api/auth/register", {
    method: "POST",
    body: { ...payload, name: payload.name || payload.username || "" },
  })

/** Signs in with the username (or email) + the mobile number. */
export const loginUser = (credentials) =>
  call("/api/auth/login", { method: "POST", body: credentials })

/** Persists the JWT so requests can send it as a Bearer token. */
export const saveToken = (token) => localStorage.setItem("token", token)

/** Removes the stored JWT (used by the header's Logout button). */
export const clearToken = () => localStorage.removeItem("token")

/** Returns the stored JWT, or null for a guest. */
export const getToken = () => localStorage.getItem("token")

/** True when a JWT is stored. The API stays the final authority. */
export const isAuthenticated = () => Boolean(getToken())

/** GET /api/auth/me - the signed-in profile for the stored token. */
export const fetchCurrentUser = async () => {
  const payload = await call("/api/auth/me", { token: getToken() })
  return payload.user || null
}

/** Turns an ApiError into one user-readable line (including field errors). */
export const describeError = (error) => {
  if (error instanceof ApiError) {
    if (error.errors.length > 0) {
      return `${error.message}: ${error.errors
        .map((item) => item.message)
        .join(" · ")}`
    }
    return error.message
  }
  return error instanceof Error ? error.message : "Something went wrong. Please try again."
}
