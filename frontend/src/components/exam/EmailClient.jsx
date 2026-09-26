import { useEffect, useMemo, useRef, useState } from "react"
import RichBodyEditor from "./RichBodyEditor"
import {
  fetchInbox,
  fetchSent,
  isEmailBackendLive,
  loadDraft,
  markMessageSeen,
  saveDraft,
  sendMessage,
  setMessageImportance,
} from "../../services/emailService"
import "./email.css"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024

const EMPTY_DRAFT = {
  from: "candidate@office.com",
  to: "",
  subject: "",
  body: "",
  importance: "normal",
}

const formatSize = (bytes) => {
  const value = Number(bytes) || 0

  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`

  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

const formatDate = (iso) => {
  const date = new Date(iso)

  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString(undefined, { day: "2-digit", month: "short" })
}

const stripHtml = (value) => String(value || "").replace(/<[^>]*>/g, " ").trim()

const FOLDERS = [
  { id: "inbox", label: "Inbox" },
  { id: "sent", label: "Sent" },
]

/**
 * In-app email client for Part E.
 *
 * Compose/send/attach/flag all live inside the exam frame. Messages are
 * posted to the Node backend for grading; when the API is unreachable the
 * component works against localStorage so the candidate is never blocked.
 */
function EmailClient() {
  const [folder, setFolder] = useState("inbox")
  const [inbox, setInbox] = useState([])
  const [sent, setSent] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [view, setView] = useState("list")
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [attachments, setAttachments] = useState([])
  const [notice, setNotice] = useState(null)
  const [sending, setSending] = useState(false)
  const [richOpen, setRichOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const fileRef = useRef(null)

  // Load the inbox once: backend first, local mirror as the fallback.
  useEffect(() => {
    let cancelled = false

    fetchInbox().then(({ messages }) => {
      if (cancelled) return

      setInbox(messages)
      setSent(fetchSent())
      setDraft({ ...EMPTY_DRAFT, ...(loadDraft() || {}) })
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [])

  const messages = folder === "sent" ? sent : inbox
  const selected = messages.find((message) => message.id === selectedId) || null
  const offline = !isEmailBackendLive()

  const invoicePending = useMemo(
    () =>
      inbox.some(
        (message) =>
          /invoice/i.test(message.subject) &&
          !message.flagged &&
          message.importance !== "high"
      ),
    [inbox]
  )


  const openMessage = (id) => {
    setSelectedId(id)

    if (folder === "inbox") {
      setInbox(markMessageSeen(id))
    }

    setView("reading")
  }

  const startCompose = () => {
    setDraft({ ...EMPTY_DRAFT, ...(loadDraft() || {}) })
    setAttachments([])
    setNotice(null)
    setRichOpen(false)
    setView("compose")
  }

  const updateDraft = (patch) => {
    setDraft((current) => {
      const next = { ...current, ...patch }

      saveDraft(next)

      return next
    })
  }

  const handleFiles = (event) => {
    const picked = Array.from(event.target.files || [])
    const accepted = []
    const rejected = []

    picked.forEach((file) => {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        rejected.push(file.name)
      } else {
        accepted.push(file)
      }
    })

    setAttachments((current) => [...current, ...accepted])

    if (rejected.length) {
      setNotice({
        tone: "warn",
        text: `Skipped ${rejected.join(", ")} - each attachment must be under 2 MB.`,
      })
    }

    event.target.value = ""
  }

  const removeAttachment = (index) =>
    setAttachments((current) => current.filter((_, position) => position !== index))

  const toggleFlag = async () => {
    if (!selected) return

    const flagged = !(selected.flagged || selected.importance === "high")
    const { messages: next } = await setMessageImportance(selected.id, flagged, "high")

    setInbox(next)
    setNotice(
      flagged
        ? { tone: "success", text: 'Marked as High importance. Task 3 is satisfied.' }
        : { tone: "info", text: "Importance reset to Normal." }
    )
  }

  const handleSend = async (event) => {
    event.preventDefault()

    if (sending) return

    const to = draft.to.trim()
    const subject = draft.subject.trim()
    const body = draft.body.trim()

    if (!EMAIL_RE.test(to)) {
      setNotice({ tone: "error", text: "Enter a valid recipient address." })

      return
    }

    if (!subject) {
      setNotice({ tone: "error", text: "Add a subject before sending." })

      return
    }

    if (!stripHtml(body)) {
      setNotice({ tone: "error", text: "Write the message body before sending." })

      return
    }

    setSending(true)

    const result = await sendMessage({
      from: draft.from.trim() || "candidate@office.com",
      to,
      subject,
      body,
      attachments,
    })

    setSending(false)
    setSent(fetchSent())
    setAttachments([])
    setDraft({ ...EMPTY_DRAFT, from: draft.from })
    saveDraft({ ...EMPTY_DRAFT, from: draft.from })
    setRichOpen(false)
    setFolder("sent")
    setView("list")
    setNotice(
      result.delivered
        ? { tone: "success", text: `Message sent to ${to}.` }
        : {
            tone: "warn",
            text: `Saved to Sent locally - the grading API was unreachable (${result.error}).`,
          }
    )
  }

  const noticeBanner = notice && (
    <div className={`email-notice email-notice-${notice.tone}`} role="status">
      <span>{notice.text}</span>
      <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">
        ×
      </button>
    </div>
  )

  const listPane = (
    <div className="email-list">
      <div className="email-list-head">
        <span>{folder === "sent" ? "Sent" : "Inbox"}</span>
        <span className="email-count">{messageCount}</span>
      </div>

      {loading ? (
        <p className="email-empty">Loading messages...</p>
      ) : messageCount === 0 ? (
        <p className="email-empty">
          {folder === "sent"
            ? "No sent messages yet. Compose one to complete task 1."
            : "The inbox is empty."}
        </p>
      ) : (
        <ul className="email-items">
          {messages.map((message) => {
            const important = message.flagged || message.importance === "high"

            return (
              <li key={message.id}>
                <button
                  type="button"
                  onClick={() => openMessage(message.id)}
                  className={`email-item${message.id === selectedId ? " email-item-active" : ""}${message.seen ? "" : " email-item-unread"}`}
                >
                  <div className="email-item-top">
                    <span className="email-item-from">{message.from}</span>
                    <span className="email-item-date">{formatDate(message.date)}</span>
                  </div>

                  <div className="email-item-subject">
                    {important && (
                      <span className="email-pill email-pill-high" title="High importance">
                        High
                      </span>
                    )}
                    {message.subject}
                  </div>

                  <div className="email-item-meta">
                    {message.preview}
                    {message.hasAttachment && (
                      <span className="email-clip" title="Has attachment">
                        📎
                      </span>
                    )}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )

  const readingPane = selected && (
    <div className="email-reading">
      <div className="email-reading-head">
        <div>
          <h4 className="email-reading-subject">{selected.subject}</h4>
          <p className="email-reading-meta">
            From <strong>{selected.from}</strong> to {selected.to}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`email-pill ${
              selected.flagged || selected.importance === "high"
                ? "email-pill-high"
                : "email-pill-muted"
            }`}
          >
            {selected.flagged || selected.importance === "high"
              ? "High importance"
              : "Normal importance"}
          </span>

          {folder === "inbox" && (
            <button
              type="button"
              onClick={toggleFlag}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-secondary transition hover:bg-page"
            >
              {selected.flagged || selected.importance === "high"
                ? "Clear High importance"
                : "Mark High importance"}
            </button>
          )}
        </div>
      </div>

      <div
        className="email-reading-body"
        dangerouslySetInnerHTML={{
          __html: selected.body || "<p>(empty body)</p>",
        }}
      />

      {selected.attachments?.length > 0 && (
        <div className="email-attachments">
          {selected.attachments.map((file) => (
            <span key={file.name} className="email-chip">
              📎 {file.name}
              <em>{formatSize(file.size)}</em>
            </span>
          ))}
        </div>
      )}
    </div>
  )
  const composePane = (
    <form className="email-compose" onSubmit={handleSend}>
      <div className="email-field">
        <label htmlFor="email-from">From</label>
        <input
          id="email-from"
          type="email"
          value={draft.from}
          onChange={(event) => updateDraft({ from: event.target.value })}
          placeholder="you@office.com"
        />
      </div>

      <div className="email-field">
        <label htmlFor="email-to">
          To <span className="email-req">*</span>
        </label>
        <input
          id="email-to"
          type="email"
          required
          value={draft.to}
          onChange={(event) => updateDraft({ to: event.target.value })}
          placeholder="manager@office.com"
        />
      </div>

      <div className="email-field">
        <label htmlFor="email-subject">
          Subject <span className="email-req">*</span>
        </label>
        <input
          id="email-subject"
          type="text"
          required
          value={draft.subject}
          onChange={(event) => updateDraft({ subject: event.target.value })}
          placeholder="Weekly Report"
        />
      </div>

      <div className="email-field">
        <div className="email-field-row">
          <label htmlFor="email-body">
            Body <span className="email-req">*</span>
          </label>

          <button
            type="button"
            onClick={() => setRichOpen((open) => !open)}
            className="text-xs font-semibold text-brand hover:underline"
          >
            {richOpen ? "Hide rich editor" : "Rich editor"}
          </button>
        </div>

        <textarea
          id="email-body"
          required
          rows={7}
          value={draft.body}
          onChange={(event) => updateDraft({ body: event.target.value })}
          placeholder="Dear Manager,&#10;&#10;Please find the weekly report attached."
        />

        <p className="email-hint">
          Task 2 requires the body to start with &ldquo;Dear Manager&rdquo;.
        </p>
      </div>

      {richOpen && (
        <RichBodyEditor
          onHtml={(html) => updateDraft({ body: html })}
          onClose={() => setRichOpen(false)}
        />
      )}



