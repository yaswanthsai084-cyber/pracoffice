/**
 * Email client API layer for Part E.
 *
 * The frontend never delivers mail: it posts the composed message to the
 * Node backend, which grades it and owns any real delivery.
 *
 * GET   /api/exam/email/inbox              -> { messages: [...] }
 * POST  /api/exam/email/send               -> { sent: true, id }  (multipart)
 * PATCH /api/exam/email/messages/:id       -> { ok: true }
 *
 * Every call degrades to localStorage when the backend is unreachable so
 * the exam stays usable before the API is deployed.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || ""

const STORAGE_KEYS = {
  inbox: "examEmailInbox",
  sent: "examEmailSent",
  drafts: "examEmailDrafts",
}

const getAuthHeaders = () => {
  const token = localStorage.getItem("token")

  return token ? { Authorization: `Bearer ${token}` } : {}
}

/**
 * Seed inbox for the offline fallback. Deliberately contains one message
 * whose subject includes "Invoice" so task e4 (flag as important) and
 * task e5 (inbox holds at least 3 messages) are achievable with no API.
 */
export const SEED_INBOX = [
  {
    id: "seed-1",
    from: "finance@office.com",
    to: "candidate@office.com",
    subject: "Invoice #INV-2041 for Q3 training",
    body: "<p>Please find the invoice for the Q3 training session attached.</p><p>Kindly approve it before Friday.</p>",
    date: "2026-09-21T09:15:00.000Z",
    seen: false,
    flagged: false,
    importance: "normal",
    hasAttachment: true,
    attachments: [{ name: "INV-2041.pdf", size: 84210 }],
  },
  {
    id: "seed-2",
    from: "hr@office.com",
    to: "candidate@office.com",
    subject: "Office timings during the festive week",
    body: "<p>Desk hours shift to 9:00 to 16:00 for the festive week.</p><p>Please plan your shifts accordingly.</p>",
    date: "2026-09-22T11:40:00.000Z",
    seen: false,
    flagged: false,
    importance: "normal",
    hasAttachment: false,
    attachments: [],
  },
  {
    id: "seed-3",
    from: "it-support@office.com",
    to: "candidate@office.com",
    subject: "Password reset reminder",
    body: "<p>Your password expires in seven days.</p><p>Update it from the self-service portal.</p>",
    date: "2026-09-23T08:05:00.000Z",
    seen: true,
    flagged: false,
    importance: "normal",
    hasAttachment: false,
    attachments: [],
  },
]

const readStore = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key)

    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

const writeStore = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage can be full or blocked; the in-memory state still works.
  }
}

/** True when the last inbox read came from the live backend. */
let backendLive = false

export const isEmailBackendLive = () => backendLive

/** Requests are small, so a plain timeout keeps the UI from hanging. */
const withTimeout = async (promise, ms = 6000) => {
  let timer

  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("Email API request timed out")), ms)
  })

  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timer)
  }
}

const request = async (path, options = {}) =>
  withTimeout(
    fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { ...getAuthHeaders(), ...(options.headers || {}) },
    })
  )


/**
 * Normalises a message from either backend or seed shape so the list and
 * reading pane can rely on the same fields.
 */
const normalizeMessage = (message) => ({
  id: String(message.id ?? crypto.randomUUID()),
  from: message.from || "unknown@office.com",
  to: message.to || "candidate@office.com",
  subject: message.subject || "(no subject)",
  body: message.body || "",
  date: message.date || new Date().toISOString(),
  seen: Boolean(message.seen),
  flagged: Boolean(message.flagged),
  importance: message.importance || (message.flagged ? "high" : "normal"),
  hasAttachment: Boolean(message.hasAttachment || message.attachments?.length),
  attachments: message.attachments || [],
  preview:
    message.preview ||
    String(message.body || "").replace(/<[^>]*>/g, " ").trim().slice(0, 90),
})

/** Loads the inbox, falling back to the locally stored copy or the seed. */
export const fetchInbox = async () => {
  try {
    const response = await request("/api/exam/email/inbox")

    if (!response.ok) {
      throw new Error(`Inbox request failed with status ${response.status}`)
    }

    const payload = await response.json()

    if (!Array.isArray(payload?.messages)) {
      throw new Error("Inbox response did not include a messages array")
    }

    backendLive = true

    const messages = payload.messages.map(normalizeMessage)

    writeStore(STORAGE_KEYS.inbox, messages)

    return { messages, source: "backend" }
  } catch (error) {
    backendLive = false
    console.warn("Falling back to the local inbox:", error.message)

    const stored = readStore(STORAGE_KEYS.inbox, null)
    const messages = (stored?.length ? stored : SEED_INBOX).map(normalizeMessage)

    if (!stored) writeStore(STORAGE_KEYS.inbox, messages)

    return { messages, source: "local" }
  }
}

export const fetchSent = () => readStore(STORAGE_KEYS.sent, []).map(normalizeMessage)

export const saveDraft = (draft) => writeStore(STORAGE_KEYS.drafts, draft)
export const loadDraft = () => readStore(STORAGE_KEYS.drafts, null)

/** Marks a message important/normal. Mirrors the change locally when offline. */
export const setMessageImportance = async (id, flagged, importance = "high") => {
  const applyLocal = () => {
    const messages = readStore(STORAGE_KEYS.inbox, SEED_INBOX)
      .map(normalizeMessage)
      .map((message) =>
        message.id === id
          ? { ...message, flagged, importance: flagged ? importance : "normal" }
          : message
      )

    writeStore(STORAGE_KEYS.inbox, messages)

    return messages
  }

  if (!backendLive) {
    return { messages: applyLocal(), source: "local" }
  }

  try {
    const response = await request(
      `/api/exam/email/messages/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flagged,
          importance: flagged ? importance : "normal",
        }),
      }
    )

    if (!response.ok) {
      throw new Error(`Flag update failed with status ${response.status}`)
    }
  } catch (error) {
    console.warn("Flag update fell back to local state:", error.message)
  }

  return { messages: applyLocal(), source: "backend" }
}

export const markMessageSeen = (id) => {
  const messages = readStore(STORAGE_KEYS.inbox, SEED_INBOX)
    .map(normalizeMessage)
    .map((message) => (message.id === id ? { ...message, seen: true } : message))

  writeStore(STORAGE_KEYS.inbox, messages)

  return messages
}

